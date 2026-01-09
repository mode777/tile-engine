import * as vscode from "vscode";
import { generateHtmlWithCSP } from "./html-generator";
import { WebviewToHostMessage } from "../protocol/messages";

/**
 * Base class for webview providers.
 * Handles common lifecycle management: panel creation, disposal, subscription cleanup.
 * Subclasses inject their message dispatcher via constructor.
 */
export abstract class BaseWebviewProvider {
  protected panel: vscode.WebviewPanel | undefined;
  private messageSubscription: vscode.Disposable | undefined;

  constructor(
    protected context: vscode.ExtensionContext,
    private messageDispatcher: (message: WebviewToHostMessage) => Promise<void>
  ) {}

  /**
   * Create a webview panel with standard configuration.
   */
  protected createPanel(
    title: string,
    viewType: string,
    column: vscode.ViewColumn = vscode.ViewColumn.Active
  ): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(viewType, title, column, {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "webview", "dist")
      ],
      retainContextWhenHidden: true
    });

    this.panel = panel;
    this.setupMessageHandling(panel.webview);
    this.setupDisposal(panel);

    return panel;
  }

  /**
   * Set up message handling for a webview.
   */
  private setupMessageHandling(webview: vscode.Webview): void {
    this.messageSubscription = webview.onDidReceiveMessage(
      async (message: WebviewToHostMessage) => {
        try {
          await this.messageDispatcher(message);
        } catch (error) {
          console.error("Error handling webview message:", error);
        }
      }
    );
  }

  /**
   * Set up disposal handlers.
   */
  private setupDisposal(panel: vscode.WebviewPanel): void {
    panel.onDidDispose(() => {
      this.dispose();
    });
  }

  /**
   * Generate HTML for a webview with CSP and script.
   */
  protected getHtmlForWebview(webview: vscode.Webview, title: string): string {
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

  /**
   * Clean up subscriptions and state.
   */
  protected dispose(): void {
    this.messageSubscription?.dispose();
    this.panel = undefined;
  }
}
