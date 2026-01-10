import type {
  AssetJson,
  HostToWebviewMessage,
  PluginMetadata,
  WebviewToHostMessage,
  DirectoryEntry
} from "@protocol/messages";
import { EventEmitter } from "./event-emitter";

declare function acquireVsCodeApi<TState = unknown>(): {
  postMessage: (message: unknown) => void;
  getState(): TState | undefined;
  setState(data: TState): void;
};

// Custom error types for better error handling
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export class FileAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileAccessError";
  }
}

export interface FilePickerOptions {
  canSelectMany?: boolean;
  openLabel?: string;
  filters?: Record<string, string[]>;
  defaultUri?: string;
}

export interface SaveDialogOptions {
  filters?: Record<string, string[]>;
  defaultUri?: string;
  defaultFilename?: string;
}

/**
 * Centralized message service for webview-to-host communication.
 * Provides async methods for request-response patterns and EventEmitter for subscriptions.
 * Singleton instance available via MessageService.instance
 */
export class MessageService {
  static instance: MessageService = new MessageService();

  private vscode = acquireVsCodeApi<{
    content: AssetJson | null;
    plugin: PluginMetadata | null;
    mode: "editor" | "tool";
  }>();
  
  private requestIdCounter = 0;
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (reason?: unknown) => void;
      timeoutId: ReturnType<typeof setTimeout>;
    }
  >();

  // Event emitters for host → webview messages
  readonly onInit = new EventEmitter<{ documentUri: string; content: AssetJson; plugin: PluginMetadata }>();
  readonly onInitTool = new EventEmitter<{ plugin: PluginMetadata }>();
  readonly onApplyContent = new EventEmitter<{ content: AssetJson }>();
  readonly onError = new EventEmitter<{ message: string }>();
  readonly onReady = new EventEmitter<void>();

  private constructor() {
    this.setupMessageListener();
  }

  /**
   * Set up the global message listener to route all host messages.
   */
  private setupMessageListener(): void {
    const handleMessage = (event: MessageEvent<HostToWebviewMessage>) => {
      const message = event.data;
      try {
        this.routeMessage(message);
      } catch (error) {
        console.error("Error routing message:", error);
      }
    };

    window.addEventListener("message", handleMessage as EventListener);
  }

  /**
   * Route messages to appropriate handlers (event emitters or pending request resolvers).
   */
  private routeMessage(message: HostToWebviewMessage): void {
    switch (message.kind) {
      case "init":
        this.onInit.emit({ documentUri: message.documentUri, content: message.content, plugin: message.plugin });
        break;
      case "initTool":
        this.onInitTool.emit({ plugin: message.plugin });
        break;
      case "applyContent":
        this.onApplyContent.emit({ content: message.content });
        break;
      case "error":
        this.onError.emit({ message: message.message });
        break;
      case "fileContent":
      case "imageData":
      case "filePicked":
      case "fileWritten":
      case "saveDialogResult":
      case "directoryListing":
        // Route to pending request handlers
        this.resolvePendingRequest(message);
        break;
      default:
        break;
    }
  }

  /**
   * Resolve a pending request from a host response message.
   */
  private resolvePendingRequest(message: any): void {
    const pending = this.pendingRequests.get(message.requestId);
    if (!pending) return;

    clearTimeout(pending.timeoutId);
    this.pendingRequests.delete(message.requestId);

    if (message.success) {
      if (message.kind === "fileContent") {
        pending.resolve(message.content);
      } else if (message.kind === "imageData") {
        pending.resolve(message.dataUrl);
      } else if (message.kind === "filePicked") {
        pending.resolve(message.paths);
      } else if (message.kind === "fileWritten") {
        pending.resolve(undefined);
      } else if (message.kind === "saveDialogResult") {
        pending.resolve(message.path);
      } else if (message.kind === "directoryListing") {
        pending.resolve(message.entries);
      }
    } else {
      pending.reject(new FileAccessError(message.error));
    }
  }

  /**
   * Create a request ID and track the pending request with timeout.
   */
  private trackRequest<T>(timeoutMs: number): { requestId: string; promise: Promise<T> } {
    const requestId = String(this.requestIdCounter++);
    const promise = new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new TimeoutError(`Request timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      this.pendingRequests.set(requestId, { 
        resolve: resolve as (value: unknown) => void, 
        reject,
        timeoutId
      });
    });

    return { requestId, promise };
  }

  /**
   * Read a file.
   * Works in both asset editor mode (relative to document) and tool mode (relative to workspace).
   * @throws FileAccessError if the host reports an error
   * @throws TimeoutError if the request times out (10 seconds)
   */
  async readFile(filePath: string, encoding: "text" | "binary" = "text"): Promise<string> {
    const { requestId, promise } = this.trackRequest<string>(10000);
    this.vscode.postMessage({
      kind: "readFile",
      requestId,
      filePath,
      encoding
    });
    return promise;
  }

  /**
   * Read an image file and return as a data URL.
   * @throws FileAccessError if the host reports an error
   * @throws TimeoutError if the request times out (10 seconds)
   */
  async readImage(filePath: string): Promise<string> {
    const { requestId, promise } = this.trackRequest<string>(10000);
    this.vscode.postMessage({
      kind: "readImage",
      requestId,
      filePath
    });
    return promise;
  }

  /**
   * Write a file.
   * Works in both asset editor mode (relative to document) and tool mode (relative to workspace).
   * @throws FileAccessError if the host reports an error
   * @throws TimeoutError if the request times out (10 seconds)
   */
  async writeFile(filePath: string, content: string, encoding: "text" | "binary" = "text"): Promise<void> {
    const { requestId, promise } = this.trackRequest<undefined>(10000);
    this.vscode.postMessage({
      kind: "writeFile",
      requestId,
      filePath,
      content,
      encoding
    });
    await promise;
  }

  /**
   * Show VS Code's native file picker and return selected file paths.
   * Works in both asset editor mode (paths relative to document) and tool mode (workspace-relative paths).
   * @throws FileAccessError if the host reports an error or user cancels
   * @throws TimeoutError if the request times out (30 seconds)
   */
  async pickFile(options?: FilePickerOptions): Promise<string[]> {
    const { requestId, promise } = this.trackRequest<string[]>(30000);
    this.vscode.postMessage({
      kind: "pickFile",
      requestId,
      options
    });
    return promise;
  }

  /**
   * Show VS Code's native save dialog.
   * Only available in standalone tool mode.
   * @throws FileAccessError if the host reports an error
   * @throws TimeoutError if the request times out (60 seconds)
   * @returns Absolute path to selected save location, or null if cancelled
   */
  async showSaveDialog(options?: SaveDialogOptions): Promise<string | null> {
    const { requestId, promise } = this.trackRequest<string | null>(60000);
    this.vscode.postMessage({
      kind: "showSaveDialog",
      requestId,
      filters: options?.filters,
      defaultUri: options?.defaultUri,
      defaultFilename: options?.defaultFilename
    });
    return promise;
  }

  /**
   * Get directory listing.
   * Works in both asset editor mode (relative to document) and tool mode (relative to workspace).
   * @throws FileAccessError if the host reports an error
   * @throws TimeoutError if the request times out (10 seconds)
   */
  async getDirectory(dirPath: string): Promise<DirectoryEntry[]> {
    const { requestId, promise } = this.trackRequest<DirectoryEntry[]>(10000);
    this.vscode.postMessage({
      kind: "getDirectory",
      requestId,
      dirPath
    });
    return promise;
  }

  /**
   * Show a VS Code notification toast.
   */
  showNotification(type: "info" | "warning" | "error", message: string): void {
    this.vscode.postMessage({
      kind: "showNotification",
      type,
      message
    });
  }

  /**
   * Notify host that content has changed.
   */
  notifyContentChanged(content: AssetJson): void {
    this.vscode.postMessage({
      kind: "contentChanged",
      content
    });
  }

  /**
   * Notify host that the save button was clicked.
   */
  notifyRequestSave(): void {
    this.vscode.postMessage({
      kind: "requestSave"
    });
  }

  /**
   * Notify host that the webview is ready.
   */
  notifyReady(): void {
    this.vscode.postMessage({
      kind: "ready"
    });
  }

  /**
   * Get persisted state from VS Code.
   */
  getState(): { content: AssetJson | null; plugin: PluginMetadata | null; mode: "editor" | "tool" } | undefined {
    return this.vscode.getState();
  }

  /**
   * Persist state to VS Code.
   */
  setState(data: { content: AssetJson | null; plugin: PluginMetadata | null; mode: "editor" | "tool" }): void {
    this.vscode.setState(data);
  }
}
