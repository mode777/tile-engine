import * as vscode from "vscode";
import { AssetEditorProvider } from "./asset-editor/asset-editor-provider";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(AssetEditorProvider.register(context));
}

export function deactivate(): void {
  // Nothing to dispose explicitly.
}
