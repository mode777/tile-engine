import * as vscode from "vscode";
import { WebviewToHostMessage } from "../protocol/messages";
import { AssetDocument } from "./asset-document";
import { CommonHandler } from "../framework/common-handler";
import { PathContext } from "../framework/path-context";

/**
 * Handles webview messages for the asset editor.
 * Inherits common file operations from CommonHandler and implements asset-editor-specific behavior.
 */
export class AssetEditorHandler extends CommonHandler {
  constructor(
    private document: AssetDocument,
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
      case "contentChanged":
        this.document.update(message.content);
        break;
      case "requestSave":
        await this.handleRequestSave();
        break;
      default:
        // Let parent handle common messages (pickFile, showNotification, readFile, readImage, writeFile)
        await super.dispatch(message);
        break;
    }
  }

  private async handleRequestSave(): Promise<void> {
    await this.document.save();
  }
}
