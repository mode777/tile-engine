import * as vscode from "vscode";
import * as path from "path";
import { HostToWebviewMessage, WebviewToHostMessage } from "../protocol/messages";
import { AssetDocument } from "./asset-document";
import { getMimeType } from "../framework/mime-types";
import { normalizeRelativePath, toRelativePaths } from "../framework/path-utils";

/**
 * Handles webview messages for the asset editor.
 * Each handler method corresponds to a message type from the webview.
 */
export class AssetEditorHandlers {
  constructor(
    private document: AssetDocument,
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
      case "contentChanged":
        this.document.update(message.content);
        break;
      case "requestSave":
        await this.handleRequestSave();
        break;
      case "readFile":
        await this.handleReadFile(message.relativePath, message.requestId);
        break;
      case "readImage":
        await this.handleReadImage(message.relativePath, message.requestId);
        break;
      case "pickFile":
        await this.handlePickFile(message.requestId, message.options);
        break;
      default:
        // No-op for unknown messages to keep the channel resilient
        break;
    }
  }

  private async handleRequestSave(): Promise<void> {
    await this.document.save();
  }

  private async handleReadFile(
    relativePath: string,
    requestId: string
  ): Promise<void> {
    try {
      const normalized = normalizeRelativePath(relativePath);
      const docDir = vscode.Uri.joinPath(this.document.uri, "..");
      const targetUri = vscode.Uri.joinPath(docDir, normalized);

      const bytes = await vscode.workspace.fs.readFile(targetUri);
      const content = Buffer.from(bytes).toString("utf8");

      const response: HostToWebviewMessage = {
        kind: "fileContent",
        requestId,
        success: true,
        content
      };
      this.webview.postMessage(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const response: HostToWebviewMessage = {
        kind: "fileContent",
        requestId,
        success: false,
        error: errorMessage
      };
      this.webview.postMessage(response);
    }
  }

  private async handleReadImage(
    relativePath: string,
    requestId: string
  ): Promise<void> {
    try {
      const normalized = normalizeRelativePath(relativePath);
      const docDir = vscode.Uri.joinPath(this.document.uri, "..");
      const targetUri = vscode.Uri.joinPath(docDir, normalized);

      const bytes = await vscode.workspace.fs.readFile(targetUri);
      const base64 = Buffer.from(bytes).toString("base64");

      const ext = path.extname(relativePath).toLowerCase();
      const mimeType = getMimeType(ext);
      const dataUrl = `data:${mimeType};base64,${base64}`;

      const response: HostToWebviewMessage = {
        kind: "imageData",
        requestId,
        success: true,
        dataUrl
      };
      this.webview.postMessage(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const response: HostToWebviewMessage = {
        kind: "imageData",
        requestId,
        success: false,
        error: errorMessage
      };
      this.webview.postMessage(response);
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
      const docDir = vscode.Uri.joinPath(this.document.uri, "..");

      const pickerOptions: vscode.OpenDialogOptions = {
        canSelectMany: options?.canSelectMany ?? false,
        openLabel: options?.openLabel ?? "Select",
        defaultUri: options?.defaultUri ? vscode.Uri.file(options.defaultUri) : docDir
      };

      if (options?.filters) {
        pickerOptions.filters = options.filters;
      }

      const result = await vscode.window.showOpenDialog(pickerOptions);

      if (result && result.length > 0) {
        const relativePaths = toRelativePaths(docDir.fsPath, result);

        const response: HostToWebviewMessage = {
          kind: "filePicked",
          requestId,
          success: true,
          paths: relativePaths
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
}
