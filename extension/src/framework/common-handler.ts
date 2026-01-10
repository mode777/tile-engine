import * as vscode from "vscode";
import * as path from "path";
import { HostToWebviewMessage, WebviewToHostMessage } from "../protocol/messages";
import { PathContext } from "./path-context";
import { getMimeType } from "./mime-types";
import { normalizeRelativePath } from "./path-utils";

/**
 * Base handler for webview messages shared across different plugin types.
 * Handles common messages and can be overridden by subclasses for additional message types.
 */
export class CommonHandler {
  constructor(
    protected webview: vscode.Webview,
    protected context: vscode.ExtensionContext,
    protected pathContext: PathContext
  ) {}

  /**
   * Dispatch messages to appropriate handlers.
   * Handles common messages (pickFile, showNotification, readFile, readImage, writeFile, getDirectory).
   * Subclasses should override to handle their own messages and call super.dispatch() for unhandled ones.
   */
  async dispatch(message: WebviewToHostMessage): Promise<void> {
    switch (message.kind) {
      case "pickFile":
        await this.handlePickFile(message.requestId, message.options);
        break;
      case "showNotification":
        this.handleShowNotification(message.type, message.message);
        break;
      case "readFile":
        await this.handleReadFile(message.requestId, message.filePath, message.encoding);
        break;
      case "readImage":
        await this.handleReadImage(message.requestId, message.filePath);
        break;
      case "writeFile":
        await this.handleWriteFile(
          message.requestId,
          message.filePath,
          message.content,
          message.encoding
        );
        break;
      case "getDirectory":
        await this.handleGetDirectory(message.requestId, message.dirPath);
        break;
      default:
        // Subclasses should handle other message types
        break;
    }
  }

  /**
   * Handle file picker dialog - shared across all handler types.
   */
  protected async handlePickFile(
    requestId: string,
    options?: {
      canSelectMany?: boolean;
      openLabel?: string;
      filters?: Record<string, string[]>;
      defaultUri?: string;
    }
  ): Promise<void> {
    try {
      const baseUri = this.pathContext.getBaseUri();
      const defaultUri = options?.defaultUri
        ? this.pathContext.resolveUri(options.defaultUri)
        : baseUri;

      const pickerOptions: vscode.OpenDialogOptions = {
        canSelectMany: options?.canSelectMany ?? false,
        openLabel: options?.openLabel ?? "Select",
        defaultUri,
        filters: options?.filters
      };

      const result = await vscode.window.showOpenDialog(pickerOptions);

      if (result && result.length > 0) {
        const paths = this.pathContext.toRelativePaths(result);

        const response: HostToWebviewMessage = {
          kind: "filePicked",
          requestId,
          success: true,
          paths
        };
        this.postMessage(response);
      } else {
        this.postError("filePicked", requestId, "File selection cancelled");
      }
    } catch (error) {
      this.postError(
        "filePicked",
        requestId,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Handle notification requests - shared across all handler types.
   */
  protected handleShowNotification(
    type: "info" | "warning" | "error",
    message: string
  ): void {
    switch (type) {
      case "info":
        vscode.window.showInformationMessage(message);
        break;
      case "warning":
        vscode.window.showWarningMessage(message);
        break;
      case "error":
        vscode.window.showErrorMessage(message);
        break;
    }
  }

  /**
   * Handle file reading - shared across all handler types.
   */
  protected async handleReadFile(
    requestId: string,
    filePath: string,
    encoding: "text" | "binary" = "text"
  ): Promise<void> {
    try {
      const targetUri = path.isAbsolute(filePath)
        ? vscode.Uri.file(filePath)
        : vscode.Uri.joinPath(
            this.pathContext.getBaseUri(),
            normalizeRelativePath(filePath)
          );

      const bytes = await vscode.workspace.fs.readFile(targetUri);
      const content = encoding === "binary" 
        ? Buffer.from(bytes).toString("base64")
        : Buffer.from(bytes).toString("utf8");

      const response: HostToWebviewMessage = {
        kind: "fileContent",
        requestId,
        success: true,
        content
      };
      this.postMessage(response);
    } catch (error) {
      this.postError(
        "fileContent",
        requestId,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Handle image reading - shared across all handler types.
   */
  protected async handleReadImage(
    requestId: string,
    filePath: string
  ): Promise<void> {
    try {
      const targetUri = path.isAbsolute(filePath)
        ? vscode.Uri.file(filePath)
        : vscode.Uri.joinPath(
            this.pathContext.getBaseUri(),
            normalizeRelativePath(filePath)
          );

      const bytes = await vscode.workspace.fs.readFile(targetUri);
      const base64 = Buffer.from(bytes).toString("base64");

      const ext = path.extname(filePath).toLowerCase();
      const mimeType = getMimeType(ext);
      const dataUrl = `data:${mimeType};base64,${base64}`;

      const response: HostToWebviewMessage = {
        kind: "imageData",
        requestId,
        success: true,
        dataUrl
      };
      this.postMessage(response);
    } catch (error) {
      this.postError(
        "imageData",
        requestId,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Handle file writing - shared across all handler types.
   */
  protected async handleWriteFile(
    requestId: string,
    filePath: string,
    content: string,
    encoding: "text" | "binary"
  ): Promise<void> {
    try {
      const targetUri = path.isAbsolute(filePath)
        ? vscode.Uri.file(filePath)
        : vscode.Uri.joinPath(
            this.pathContext.getBaseUri(),
            normalizeRelativePath(filePath)
          );

      let data: Uint8Array;
      if (encoding === "binary") {
        data = Buffer.from(content, "base64");
      } else {
        data = Buffer.from(content, "utf-8");
      }

      await vscode.workspace.fs.writeFile(targetUri, data);

      const response: HostToWebviewMessage = {
        kind: "fileWritten",
        requestId,
        success: true
      };
      this.postMessage(response);
    } catch (error) {
      this.postError(
        "fileWritten",
        requestId,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Handle directory listing - shared across all handler types.
   */
  protected async handleGetDirectory(
    requestId: string,
    dirPath: string
  ): Promise<void> {
    try {
      const targetUri = path.isAbsolute(dirPath)
        ? vscode.Uri.file(dirPath)
        : vscode.Uri.joinPath(
            this.pathContext.getBaseUri(),
            normalizeRelativePath(dirPath)
          );

      const entries = await vscode.workspace.fs.readDirectory(targetUri);
      const directoryEntries = entries.map(([name, fileType]) => ({
        name,
        isDirectory: fileType === vscode.FileType.Directory
      }));

      const response: HostToWebviewMessage = {
        kind: "directoryListing",
        requestId,
        success: true,
        entries: directoryEntries
      };
      this.postMessage(response);
    } catch (error) {
      this.postError(
        "directoryListing",
        requestId,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Send a message to the webview.
   */
  protected postMessage(message: HostToWebviewMessage): void {
    this.webview.postMessage(message);
  }

  /**
   * Send an error response to the webview.
   */
  protected postError(
    kind: "filePicked" | "fileContent" | "imageData" | "fileWritten" | "saveDialogResult" | "directoryListing",
    requestId: string,
    error: string
  ): void {
    const response: HostToWebviewMessage = {
      kind,
      requestId,
      success: false,
      error
    } as HostToWebviewMessage;
    this.postMessage(response);
  }
}
