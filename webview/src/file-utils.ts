import type { HostToWebviewMessage } from "@protocol/messages";

declare function acquireVsCodeApi<TState = unknown>(): {
  postMessage: (message: unknown) => void;
  getState(): TState | undefined;
  setState(data: TState): void;
};

export const vscode = acquireVsCodeApi();

let requestIdCounter = 0;
const pendingRequests = new Map<
  string,
  {
    resolve: (value: string | string[]) => void;
    reject: (reason?: unknown) => void;
  }
>();

/**
 * Read a text file relative to the currently edited document.
 * @param relativePath Path relative to the document directory (e.g., "../sibling.json")
 * @returns The file contents as a string
 */
export function readFile(relativePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const requestId = String(requestIdCounter++);
    pendingRequests.set(requestId, { resolve: resolve as (value: string | string[]) => void, reject });

    vscode.postMessage({
      kind: "readFile",
      requestId,
      relativePath
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error(`Timeout reading file: ${relativePath}`));
      }
    }, 10000);
  });
}

/**
 * Read an image file relative to the currently edited document.
 * @param relativePath Path relative to the document directory (e.g., "../assets/icon.png")
 * @returns A data URL that can be used as an image src
 */
export function readImage(relativePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const requestId = String(requestIdCounter++);
    pendingRequests.set(requestId, { resolve: resolve as (value: string | string[]) => void, reject });

    vscode.postMessage({
      kind: "readImage",
      requestId,
      relativePath
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error(`Timeout reading image: ${relativePath}`));
      }
    }, 10000);
  });
}

/**
 * Handle responses from the host for file/image read requests.
 * Call this in your message handler.
 */
export function handleFileUtilsMessage(message: HostToWebviewMessage): void {
  if (message.kind === "fileContent") {
    const pending = pendingRequests.get(message.requestId);
    if (pending) {
      pendingRequests.delete(message.requestId);
      if (message.success) {
        pending.resolve(message.content);
      } else {
        pending.reject(new Error(message.error));
      }
    }
  } else if (message.kind === "imageData") {
    const pending = pendingRequests.get(message.requestId);
    if (pending) {
      pendingRequests.delete(message.requestId);
      if (message.success) {
        pending.resolve(message.dataUrl);
      } else {
        pending.reject(new Error(message.error));
      }
    }
  } else if (message.kind === "filePicked") {
    const pending = pendingRequests.get(message.requestId);
    if (pending) {
      pendingRequests.delete(message.requestId);
      if (message.success) {
        pending.resolve(message.paths);
      } else {
        pending.reject(new Error(message.error));
      }
    }
  } else if (message.kind === "workspaceFileContent") {
    const pending = pendingRequests.get(message.requestId);
    if (pending) {
      pendingRequests.delete(message.requestId);
      if (message.success) {
        pending.resolve(message.content);
      } else {
        pending.reject(new Error(message.error));
      }
    }
  } else if (message.kind === "workspaceFileWritten") {
    const pending = pendingRequests.get(message.requestId);
    if (pending) {
      pendingRequests.delete(message.requestId);
      if (message.success) {
        pending.resolve("");
      } else {
        pending.reject(new Error(message.error));
      }
    }
  } else if (message.kind === "saveDialogResult") {
    const pending = pendingRequests.get(message.requestId);
    if (pending) {
      pendingRequests.delete(message.requestId);
      if (message.success) {
        pending.resolve(message.path ?? "");
      } else {
        pending.reject(new Error(message.error));
      }
    }
  }
}

export interface FilePickerOptions {
  /** Allow selecting multiple files (default: false) */
  canSelectMany?: boolean;
  /** Label for the open button (default: "Select") */
  openLabel?: string;
  /** File type filters, e.g., { 'Images': ['png', 'jpg'], 'All Files': ['*'] } */
  filters?: Record<string, string[]>;
  /** Default directory to open (absolute path) */
  defaultUri?: string;
}

/**
 * Show VS Code's native file picker and return selected file paths.
 * Paths are returned relative to the currently edited document's directory.
 * @param options Configuration for the file picker
 * @returns Array of relative paths to selected files (or single-element array if canSelectMany is false)
 */
export function pickFile(options?: FilePickerOptions): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const requestId = String(requestIdCounter++);
    pendingRequests.set(requestId, { resolve: resolve as (value: string | string[]) => void, reject });

    vscode.postMessage({
      kind: "pickFile",
      requestId,
      options
    });

    // Timeout after 30 seconds (file picker might take longer)
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error("Timeout waiting for file selection"));
      }
    }, 30000);
  });
}

/**
 * Read a file from the workspace (absolute or workspace-relative path).
 * Only available in standalone tool mode.
 * @param path Absolute path or workspace-relative path (e.g., "assets/data.json")
 * @param encoding Text or binary encoding (binary returns Base64 string)
 * @returns The file contents
 */
export function readWorkspaceFile(
  path: string,
  encoding: "text" | "binary" = "text"
): Promise<string> {
  return new Promise((resolve, reject) => {
    const requestId = String(requestIdCounter++);
    pendingRequests.set(requestId, { resolve: resolve as (value: string | string[]) => void, reject });

    vscode.postMessage({
      kind: "readWorkspaceFile",
      requestId,
      path,
      encoding
    });

    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error(`Timeout reading workspace file: ${path}`));
      }
    }, 10000);
  });
}

/**
 * Write a file to the workspace (absolute or workspace-relative path).
 * Only available in standalone tool mode.
 * @param path Absolute path or workspace-relative path
 * @param content File content (Base64 string if encoding is binary)
 * @param encoding Text or binary encoding
 */
export function writeWorkspaceFile(
  path: string,
  content: string,
  encoding: "text" | "binary" = "text"
): Promise<void> {
  return new Promise((resolve, reject) => {
    const requestId = String(requestIdCounter++);
    pendingRequests.set(requestId, { 
      resolve: () => resolve() as unknown as (value: string | string[]) => void, 
      reject 
    });

    vscode.postMessage({
      kind: "writeWorkspaceFile",
      requestId,
      path,
      content,
      encoding
    });

    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error(`Timeout writing workspace file: ${path}`));
      }
    }, 10000);
  });
}

export interface SaveDialogOptions {
  /** File type filters, e.g., { 'Images': ['png', 'jpg'], 'All Files': ['*'] } */
  filters?: Record<string, string[]>;
  /** Default directory to open (absolute or workspace-relative path) */
  defaultUri?: string;
  /** Default filename to suggest */
  defaultFilename?: string;
}

/**
 * Show VS Code's native save dialog.
 * Only available in standalone tool mode.
 * @param options Configuration for the save dialog
 * @returns Absolute path to selected save location, or null if cancelled
 */
export function showSaveDialog(options?: SaveDialogOptions): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const requestId = String(requestIdCounter++);
    pendingRequests.set(requestId, { 
      resolve: (value) => resolve(value === "" ? null : value as string) as unknown as (value: string | string[]) => void, 
      reject 
    });

    vscode.postMessage({
      kind: "showSaveDialog",
      requestId,
      filters: options?.filters,
      defaultUri: options?.defaultUri,
      defaultFilename: options?.defaultFilename
    });

    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error("Timeout waiting for save dialog"));
      }
    }, 60000); // Longer timeout for user interaction
  });
}

/**
 * Show a VS Code notification toast.
 * @param type Notification type (info, warning, error)
 * @param message Message to display
 */
export function showNotification(
  type: "info" | "warning" | "error",
  message: string
): void {
  vscode.postMessage({
    kind: "showNotification",
    type,
    message
  });
}
