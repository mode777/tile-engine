import * as vscode from "vscode";
import {
  HostToWebviewMessage,
  WebviewToHostMessage
} from "../protocol/messages";
import { AssetDocument } from "./asset-document";
import { getPluginDescriptor } from "../plugin-system/registry";
import { BaseWebviewProvider } from "../framework/base-webview-provider";
import { AssetEditorHandler } from "./asset-editor-handler";
import { DocumentPathContext } from "../framework/path-context";

export class AssetEditorProvider extends BaseWebviewProvider
  implements vscode.CustomEditorProvider<AssetDocument>
{
  public static readonly viewType = "tile-engine.assetEditor";

  private readonly onDidChangeCustomDocumentEmitter =
    new vscode.EventEmitter<vscode.CustomDocumentContentChangeEvent<AssetDocument>>();

  public readonly onDidChangeCustomDocument =
    this.onDidChangeCustomDocumentEmitter.event;

  private handlers: AssetEditorHandler | undefined;

  constructor(context: vscode.ExtensionContext) {
    super(context, async (message: WebviewToHostMessage) => {
      if (this.handlers) {
        await this.handlers.dispatch(message);
      }
    });
  }

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

    webview.html = this.getHtmlForWebview(webview, "Asset Editor");

    const plugin = getPluginDescriptor(document.data.type);

    // Set up handlers for this document
    const pathContext = new DocumentPathContext(document.uri);
    this.handlers = new AssetEditorHandler(document, webview, this.context, pathContext);

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
        if (message.kind === "ready") {
          postInit();
        } else {
          await this.handlers?.dispatch(message);
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
      this.handlers = undefined;
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
}
