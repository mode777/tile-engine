import * as vscode from "vscode";
import * as path from "path";
import {
  HostToWebviewMessage,
  WebviewToHostMessage
} from "../protocol/messages";
import { StandaloneToolPlugin } from "../plugins/asset-editor-plugin";

/**
 * Manages standalone tool webview panels (non-file-editing plugins).
 * Ensures singleton instances per tool type and handles workspace-wide file operations.
 */
export class StandaloneToolProvider {
  private readonly openPanels = new Map<string, vscode.WebviewPanel>();

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

    panel.webview.html = this.getHtmlForWebview(panel.webview);

    const postInit = () => {
      const message: HostToWebviewMessage = {
        kind: "initTool",
        plugin: plugin.metadata
      };
      panel.webview.postMessage(message);
    };

    const messageSubscription = panel.webview.onDidReceiveMessage(
      async (message: WebviewToHostMessage) => {
        switch (message.kind) {
          case "ready": {
            postInit();
            break;
          }
          case "readWorkspaceFile": {
            await this.handleReadWorkspaceFile(
              panel.webview,
              message.requestId,
              message.path,
              message.encoding
            );
            break;
          }
          case "writeWorkspaceFile": {
            await this.handleWriteWorkspaceFile(
              panel.webview,
              message.requestId,
              message.path,
              message.content,
              message.encoding
            );
            break;
          }
          case "showSaveDialog": {
            await this.handleShowSaveDialog(
              panel.webview,
              message.requestId,
              message.filters,
              message.defaultUri,
              message.defaultFilename
            );
            break;
          }
          case "pickFile": {
            await this.handlePickFile(
              panel.webview,
              message.requestId,
              message.options
            );
            break;
          }
          case "showNotification": {
            this.handleShowNotification(message.type, message.message);
            break;
          }
          default: {
            console.warn("Unknown message from tool webview:", message);
            break;
          }
        }
      }
    );

    panel.onDidDispose(() => {
      messageSubscription.dispose();
      this.openPanels.delete(plugin.metadata.commandId);
      plugin.onClose?.();
    });

    // Call optional onOpen lifecycle hook
    await plugin.onOpen?.();
  }

  private async handleReadWorkspaceFile(
    webview: vscode.Webview,
    requestId: string,
    filePath: string,
    encoding: "text" | "binary"
  ): Promise<void> {
    try {
      const uri = this.resolveWorkspacePath(filePath);
      const fileData = await vscode.workspace.fs.readFile(uri);

      let content: string;
      if (encoding === "binary") {
        // Convert to Base64 for JSON serialization
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
      webview.postMessage(response);
    } catch (error) {
      const response: HostToWebviewMessage = {
        kind: "workspaceFileContent",
        requestId,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
      webview.postMessage(response);
    }
  }

  private async handleWriteWorkspaceFile(
    webview: vscode.Webview,
    requestId: string,
    filePath: string,
    content: string,
    encoding: "text" | "binary"
  ): Promise<void> {
    try {
      const uri = this.resolveWorkspacePath(filePath);

      let data: Uint8Array;
      if (encoding === "binary") {
        // Decode from Base64
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
      webview.postMessage(response);
    } catch (error) {
      const response: HostToWebviewMessage = {
        kind: "workspaceFileWritten",
        requestId,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
      webview.postMessage(response);
    }
  }

  private async handleShowSaveDialog(
    webview: vscode.Webview,
    requestId: string,
    filters?: Record<string, string[]>,
    defaultUri?: string,
    defaultFilename?: string
  ): Promise<void> {
    try {
      let saveUri: vscode.Uri | undefined;
      
      if (defaultUri) {
        saveUri = this.resolveWorkspacePath(defaultUri);
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
      webview.postMessage(response);
    } catch (error) {
      const response: HostToWebviewMessage = {
        kind: "saveDialogResult",
        requestId,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
      webview.postMessage(response);
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
    webview: vscode.Webview,
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
          ? this.resolveWorkspacePath(options.defaultUri)
          : workspaceFolder,
        filters: options?.filters
      };

      const result = await vscode.window.showOpenDialog(pickerOptions);

      if (result && result.length > 0) {
        const paths = result.map((uri) => {
          if (workspaceFolder) {
            const relative = path.relative(workspaceFolder.fsPath, uri.fsPath);
            return relative.replace(/\\/g, "/");
          }
          return uri.fsPath;
        });

        const response: HostToWebviewMessage = {
          kind: "filePicked",
          requestId,
          success: true,
          paths
        };
        webview.postMessage(response);
      } else {
        const response: HostToWebviewMessage = {
          kind: "filePicked",
          requestId,
          success: false,
          error: "File selection cancelled"
        };
        webview.postMessage(response);
      }
    } catch (error) {
      const response: HostToWebviewMessage = {
        kind: "filePicked",
        requestId,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error picking file"
      };
      webview.postMessage(response);
    }
  }

  /**
   * Resolve a workspace-relative path to an absolute URI.
   * If the path is already absolute, use it directly.
   */
  private resolveWorkspacePath(filePath: string): vscode.Uri {
    if (path.isAbsolute(filePath)) {
      return vscode.Uri.file(filePath);
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error("No workspace folder open");
    }

    return vscode.Uri.joinPath(workspaceFolder.uri, filePath);
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "webview",
        "dist",
        "main.js"
      )
    );

    const nonce = getNonce();

    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} blob: data:`,
      `style-src 'nonce-${nonce}' 'unsafe-inline' ${webview.cspSource}`,
      `script-src 'nonce-${nonce}'`,
      `connect-src ${webview.cspSource} https://*.vscode-cdn.net`
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tile Engine Tool</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">window.__webviewNonce__ = "${nonce}";</script>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
