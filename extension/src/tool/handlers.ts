import * as vscode from "vscode";
import * as path from "path";
import { HostToWebviewMessage, WebviewToHostMessage } from "../protocol/messages";
import { resolveWorkspacePath, toRelativePaths } from "../framework/path-utils";

/**
 * Handles webview messages for standalone tools.
 * Each handler method corresponds to a message type from the webview.
 */
export class StandaloneToolHandlers {
  constructor(
    private webview: vscode.Webview,
    private context: vscode.ExtensionContext
  ) {}

  /**
   * Dispatch messages to appropriate handlers.
   */
  async dispatch(message: WebviewToHostMessage): Promise<void> {
    switch (message.kind) {
      case "ready":
        // Ready message is handled by provider
        break;
      case "readWorkspaceFile":
        await this.handleReadWorkspaceFile(
          message.requestId,
          message.path,
          message.encoding
        );
        break;
      case "writeWorkspaceFile":
        await this.handleWriteWorkspaceFile(
          message.requestId,
          message.path,
          message.content,
          message.encoding
        );
        break;
      case "showSaveDialog":
        await this.handleShowSaveDialog(
          message.requestId,
          message.filters,
          message.defaultUri,
          message.defaultFilename
        );
        break;
      case "pickFile":
        await this.handlePickFile(message.requestId, message.options);
        break;
      case "showNotification":
        this.handleShowNotification(message.type, message.message);
        break;
      default:
        console.warn("Unknown message from tool webview:", message);
        break;
    }
  }

  private async handleReadWorkspaceFile(
    requestId: string,
    filePath: string,
    encoding: "text" | "binary"
  ): Promise<void> {
    try {
      const uri = resolveWorkspacePath(filePath);
      const fileData = await vscode.workspace.fs.readFile(uri);

      let content: string;
      if (encoding === "binary") {
        content = Buffer.from(fileData).toString("base64");
      } else {
        content = Buffer.from(fileData).toString("utf-8");
      }

      const response: HostToWebviewMessage = {
        kind: "workspaceFileContent",
        requestId,
        success: true,
        content
      };
      this.webview.postMessage(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const response: HostToWebviewMessage = {
        kind: "workspaceFileContent",
        requestId,
        success: false,
        error: errorMessage
      };
      this.webview.postMessage(response);
    }
  }

  private async handleWriteWorkspaceFile(
    requestId: string,
    filePath: string,
    content: string,
    encoding: "text" | "binary"
  ): Promise<void> {
    try {
      const uri = resolveWorkspacePath(filePath);

      let data: Uint8Array;
      if (encoding === "binary") {
        data = Buffer.from(content, "base64");
      } else {
        data = Buffer.from(content, "utf-8");
      }

      await vscode.workspace.fs.writeFile(uri, data);

      const response: HostToWebviewMessage = {
        kind: "workspaceFileWritten",
        requestId,
        success: true
      };
      this.webview.postMessage(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const response: HostToWebviewMessage = {
        kind: "workspaceFileWritten",
        requestId,
        success: false,
        error: errorMessage
      };
      this.webview.postMessage(response);
    }
  }

  private async handleShowSaveDialog(
    requestId: string,
    filters?: Record<string, string[]>,
    defaultUri?: string,
    defaultFilename?: string
  ): Promise<void> {
    try {
      let saveUri: vscode.Uri | undefined;

      if (defaultUri) {
        saveUri = resolveWorkspacePath(defaultUri);
      } else if (defaultFilename && vscode.workspace.workspaceFolders?.[0]) {
        saveUri = vscode.Uri.joinPath(
          vscode.workspace.workspaceFolders[0].uri,
          defaultFilename
        );
      }

      const uri = await vscode.window.showSaveDialog({
        defaultUri: saveUri,
        filters: filters || { "All Files": ["*"] }
      });

      const response: HostToWebviewMessage = {
        kind: "saveDialogResult",
        requestId,
        success: true,
        path: uri ? uri.fsPath : null
      };
      this.webview.postMessage(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const response: HostToWebviewMessage = {
        kind: "saveDialogResult",
        requestId,
        success: false,
        error: errorMessage
      };
      this.webview.postMessage(response);
    }
  }

  private handleShowNotification(
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

  private async handlePickFile(
    requestId: string,
    options?: {
      canSelectMany?: boolean;
      openLabel?: string;
      filters?: Record<string, string[]>;
      defaultUri?: string;
    }
  ): Promise<void> {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
      const pickerOptions: vscode.OpenDialogOptions = {
        canSelectMany: options?.canSelectMany ?? false,
        openLabel: options?.openLabel ?? "Select",
        defaultUri: options?.defaultUri
          ? resolveWorkspacePath(options.defaultUri)
          : workspaceFolder,
        filters: options?.filters
      };

      const result = await vscode.window.showOpenDialog(pickerOptions);

      if (result && result.length > 0) {
        let paths: string[];
        if (workspaceFolder) {
          paths = toRelativePaths(workspaceFolder.fsPath, result);
        } else {
          paths = result.map(uri => uri.fsPath);
        }

        const response: HostToWebviewMessage = {
          kind: "filePicked",
          requestId,
          success: true,
          paths
        };
        this.webview.postMessage(response);
      } else {
        const response: HostToWebviewMessage = {
          kind: "filePicked",
          requestId,
          success: false,
          error: "File selection cancelled"
        };
        this.webview.postMessage(response);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const response: HostToWebviewMessage = {
        kind: "filePicked",
        requestId,
        success: false,
        error: errorMessage
      };
      this.webview.postMessage(response);
    }
  }

  private createErrorResponse<K extends HostToWebviewMessage["kind"]>(
    kind: K,
    requestId: string,
    error: string | Error
  ): HostToWebviewMessage {
    const errorMessage = error instanceof Error ? error.message : error;
    return {
      kind,
      requestId,
      success: false,
      error: errorMessage
    } as HostToWebviewMessage;
  }
}
