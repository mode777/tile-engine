import * as vscode from "vscode";
import * as path from "path";
import {
  HostToWebviewMessage,
  WebviewToHostMessage
} from "../protocol/messages";
import { AssetDocument } from "./asset-document";
import { getPluginDescriptor } from "../plugins/registry";

export class AssetEditorProvider
  implements vscode.CustomEditorProvider<AssetDocument>
{
  public static readonly viewType = "tile-engine.assetEditor";

  private readonly onDidChangeCustomDocumentEmitter =
    new vscode.EventEmitter<vscode.CustomDocumentContentChangeEvent<AssetDocument>>();

  public readonly onDidChangeCustomDocument =
    this.onDidChangeCustomDocumentEmitter.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new AssetEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(
      AssetEditorProvider.viewType,
      provider,
      {
        supportsMultipleEditorsPerDocument: false
      }
    );
  }

  public async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext
  ): Promise<AssetDocument> {
    const document = await AssetDocument.create(uri, openContext.backupId);
    // Validate plugin availability early to fail fast.
    getPluginDescriptor(document.data.type);
    return document;
  }

  public async resolveCustomEditor(
    document: AssetDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    const webview = webviewPanel.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "webview", "dist")
      ]
    };

    webview.html = this.getHtmlForWebview(webview);

    const plugin = getPluginDescriptor(document.data.type);

    const postInit = () => {
      const message: HostToWebviewMessage = {
        kind: "init",
        documentUri: document.uri.toString(),
        content: document.data,
        plugin
      };
      webview.postMessage(message);
    };

    const messageSubscription = webview.onDidReceiveMessage(
      async (message: WebviewToHostMessage) => {
        switch (message.kind) {
          case "ready": {
            postInit();
            break;
          }
          case "contentChanged": {
            document.update(message.content);
            this.onDidChangeCustomDocumentEmitter.fire({
              document
            });
            break;
          }
          case "requestSave": {
            await this.saveCustomDocument(document);
            break;
          }
          case "readFile": {
            await this.handleReadFile(webview, document.uri, message.requestId, message.relativePath);
            break;
          }
          case "readImage": {
            await this.handleReadImage(webview, document.uri, message.requestId, message.relativePath);
            break;
          }
          default: {
            // No-op for unknown messages to keep the channel resilient.
            break;
          }
        }
      }
    );

    const changeSubscription = document.onDidChange((content) => {
      const message: HostToWebviewMessage = {
        kind: "applyContent",
        content
      };
      webview.postMessage(message);
    });

    webviewPanel.onDidDispose(() => {
      messageSubscription.dispose();
      changeSubscription.dispose();
    });
  }

  public async saveCustomDocument(
    document: AssetDocument,
    cancellation?: vscode.CancellationToken
  ): Promise<void> {
    if (cancellation?.isCancellationRequested) {
      return;
    }
    await document.save();
  }

  public async saveCustomDocumentAs(
    document: AssetDocument,
    destination: vscode.Uri,
    cancellation?: vscode.CancellationToken
  ): Promise<void> {
    if (cancellation?.isCancellationRequested) {
      return;
    }
    await document.save(destination);
  }

  public async revertCustomDocument(
    document: AssetDocument,
    cancellation?: vscode.CancellationToken
  ): Promise<void> {
    if (cancellation?.isCancellationRequested) {
      return;
    }
    await document.revert();
  }

  public async backupCustomDocument(
    document: AssetDocument,
    context: vscode.CustomDocumentBackupContext,
    cancellation?: vscode.CancellationToken
  ): Promise<vscode.CustomDocumentBackup> {
    if (cancellation?.isCancellationRequested) {
      throw new Error("Backup cancelled");
    }

    await document.save(context.destination);
    return {
      id: context.destination.toString(),
      delete: () => vscode.workspace.fs.delete(context.destination)
    };
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "webview", "dist", "main.js")
    );

    const nonce = getNonce();

    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} blob: data:`,
      `style-src 'nonce-${nonce}' 'unsafe-inline' ${webview.cspSource}`,
      `script-src 'nonce-${nonce}'`,
      `connect-src ${webview.cspSource} https://*.vscode-cdn.net https://file+.vscode-resource.vscode-cdn.net`
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Asset Editor</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">window.__webviewNonce__ = "${nonce}";</script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private async handleReadFile(
    webview: vscode.Webview,
    documentUri: vscode.Uri,
    requestId: string,
    relativePath: string
  ): Promise<void> {
    try {
      // Prevent directory traversal attacks
      const normalized = path.normalize(relativePath);
      if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
        throw new Error("Invalid path: cannot read files outside the document directory");
      }

      const docDir = vscode.Uri.joinPath(documentUri, "..");
      const targetUri = vscode.Uri.joinPath(docDir, normalized);

      const bytes = await vscode.workspace.fs.readFile(targetUri);
      const content = Buffer.from(bytes).toString("utf8");

      const message: HostToWebviewMessage = {
        kind: "fileContent",
        requestId,
        success: true,
        content
      };
      webview.postMessage(message);
    } catch (error) {
      const message: HostToWebviewMessage = {
        kind: "fileContent",
        requestId,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error reading file"
      };
      webview.postMessage(message);
    }
  }

  private async handleReadImage(
    webview: vscode.Webview,
    documentUri: vscode.Uri,
    requestId: string,
    relativePath: string
  ): Promise<void> {
    try {
      // Prevent directory traversal attacks
      const normalized = path.normalize(relativePath);
      if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
        throw new Error("Invalid path: cannot read files outside the document directory");
      }

      const docDir = vscode.Uri.joinPath(documentUri, "..");
      const targetUri = vscode.Uri.joinPath(docDir, normalized);

      const bytes = await vscode.workspace.fs.readFile(targetUri);
      const base64 = Buffer.from(bytes).toString("base64");

      // Infer MIME type from file extension
      const ext = path.extname(relativePath).toLowerCase();
      const mimeType = this.getMimeType(ext);
      const dataUrl = `data:${mimeType};base64,${base64}`;

      const message: HostToWebviewMessage = {
        kind: "imageData",
        requestId,
        success: true,
        dataUrl
      };
      webview.postMessage(message);
    } catch (error) {
      const message: HostToWebviewMessage = {
        kind: "imageData",
        requestId,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error reading image"
      };
      webview.postMessage(message);
    }
  }

  private getMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".bmp": "image/bmp",
      ".ico": "image/x-icon"
    };
    return mimeTypes[ext] || "application/octet-stream";
  }
}

function getNonce(): string {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 32 })
    .map(() => possible.charAt(Math.floor(Math.random() * possible.length)))
    .join("");
}
