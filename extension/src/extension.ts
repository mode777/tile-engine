import * as vscode from "vscode";
import { AssetEditorProvider } from "./asset-editor/asset-editor-provider";
import { StandaloneToolProvider } from "./tool/standalone-tool-provider";
import { getToolPlugins, getHeadlessTools } from "./plugins/registry";

export function activate(context: vscode.ExtensionContext): void {
  // Register custom editor for file-based asset editing
  context.subscriptions.push(AssetEditorProvider.register(context));

  // Register standalone tool commands
  const toolProvider = new StandaloneToolProvider(context);
  const toolPlugins = getToolPlugins();

  for (const plugin of toolPlugins) {
    // Validate command ID pattern
    if (!plugin.metadata.commandId.startsWith("tile-engine.tools.")) {
      console.error(
        `Tool plugin "${plugin.metadata.title}" has invalid commandId: ${plugin.metadata.commandId}. ` +
        `Must follow pattern: tile-engine.tools.<name>`
      );
      continue;
    }

    const disposable = vscode.commands.registerCommand(
      plugin.metadata.commandId,
      async () => {
        await toolProvider.openTool(plugin);
      }
    );
    context.subscriptions.push(disposable);
  }

  // Register headless tool commands
  const headlessTools = getHeadlessTools();

  for (const tool of headlessTools) {
    // Validate command ID pattern
    if (!tool.metadata.commandId.startsWith("tile-engine.tools.")) {
      console.error(
        `Headless tool "${tool.metadata.title}" has invalid commandId: ${tool.metadata.commandId}. ` +
        `Must follow pattern: tile-engine.tools.<name>`
      );
      continue;
    }

    const disposable = vscode.commands.registerCommand(
      tool.metadata.commandId,
      async () => {
        await tool.execute(context);
      }
    );
    context.subscriptions.push(disposable);
  }
}

export function deactivate(): void {
  // Nothing to dispose explicitly.
}
