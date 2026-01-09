import * as vscode from "vscode";
import { WebviewToHostMessage } from "../protocol/messages";
import { CommonHandler } from "../framework/common-handler";
import { PathContext } from "../framework/path-context";

/**
 * Handles webview messages for standalone tools.
 * Inherits common file operations from CommonHandler and implements tool-specific behavior.
 */
export class StandaloneToolHandler extends CommonHandler {
  constructor(
    webview: vscode.Webview,
    context: vscode.ExtensionContext,
    pathContext: PathContext
  ) {
    super(webview, context, pathContext);
  }

  /**
   * Dispatch messages to appropriate handlers.
   */
  async dispatch(message: WebviewToHostMessage): Promise<void> {
    switch (message.kind) {
      case "ready":
        // Ready message is handled by provider
        break;
      case "showSaveDialog":
        await this.handleShowSaveDialog(
          message.requestId,
          message.filters,
          message.defaultUri,
          message.defaultFilename
        );
        break;
      default:
        // Let parent handle common messages (pickFile, showNotification, readFile, readImage, writeFile)
        await super.dispatch(message);
        break;
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
        saveUri = this.pathContext.resolveUri(defaultUri);
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

      const response = {
        kind: "saveDialogResult" as const,
        requestId,
        success: true as const,
        path: uri ? uri.fsPath : null
      };
      this.postMessage(response);
    } catch (error) {
      this.postError(
        "saveDialogResult",
        requestId,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}
