import * as vscode from "vscode";
import {
  HostToWebviewMessage,
  WebviewToHostMessage
} from "../protocol/messages";
import { StandaloneToolPlugin } from "../plugin-system/types";
import { StandaloneToolHandlers } from "./handlers";
import { generateHtmlWithCSP } from "../framework/html-generator";

/**
 * Manages standalone tool webview panels (non-file-editing plugins).
 * Ensures singleton instances per tool type and handles workspace-wide file operations.
 */
export class StandaloneToolProvider {
  private readonly openPanels = new Map<string, vscode.WebviewPanel>();
  private readonly handlersMap = new Map<string, StandaloneToolHandlers>();

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Open a standalone tool panel. If already open, focus the existing panel.
   * @param plugin The tool plugin to open
   */
  public async openTool(plugin: StandaloneToolPlugin): Promise<void> {
    const existingPanel = this.openPanels.get(plugin.metadata.commandId);
    if (existingPanel) {
      existingPanel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      plugin.metadata.commandId,
      plugin.metadata.title,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, "webview", "dist")
        ],
        retainContextWhenHidden: true
      }
    );

    this.openPanels.set(plugin.metadata.commandId, panel);

    // Set up HTML
    panel.webview.html = this.getHtmlForWebview(
      panel.webview,
      plugin.metadata.title
    );

    // Create handlers for this panel
    const handlers = new StandaloneToolHandlers(panel.webview, this.context);
    this.handlersMap.set(plugin.metadata.commandId, handlers);

    const postInit = () => {
      const message: HostToWebviewMessage = {
        kind: "initTool",
        plugin: plugin.metadata
      };
      panel.webview.postMessage(message);
    };

    const messageSubscription = panel.webview.onDidReceiveMessage(
      async (message: WebviewToHostMessage) => {
        if (message.kind === "ready") {
          postInit();
        } else {
          await handlers.dispatch(message);
        }
      }
    );

    panel.onDidDispose(() => {
      messageSubscription.dispose();
      this.openPanels.delete(plugin.metadata.commandId);
      this.handlersMap.delete(plugin.metadata.commandId);
      plugin.onClose?.();
    });

    // Call optional onOpen lifecycle hook
    await plugin.onOpen?.();
  }

  private getHtmlForWebview(webview: vscode.Webview, title: string): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "webview",
        "dist",
        "main.js"
      )
    );

    return generateHtmlWithCSP(webview, scriptUri, title);
  }
}

