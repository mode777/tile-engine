import * as vscode from "vscode";
import { HeadlessTool } from "../asset-editor-plugin";

export const tilesetTool: HeadlessTool = {
  metadata: {
    mode: "headless",
    type: "tileset",
    commandId: "tile-engine.tools.createTileset",
    title: "Create Tileset",
    description: "Create a new tileset asset file"
  },
  execute: async (context: vscode.ExtensionContext) => {
    try {
      // Get the default workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage("No workspace folder is open.");
        return;
      }

      // Show save dialog
      const fileUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.joinPath(workspaceFolder.uri, "tileset.asset"),
        filters: {
          "Asset Files": ["asset"],
          "All Files": ["*"]
        },
        saveLabel: "Create"
      });

      if (!fileUri) {
        // User cancelled
        return;
      }

      // Create the tileset asset with minimal content
      const tilesetContent = JSON.stringify({ type: "tileset" }, null, 2);

      // Write the file
      await vscode.workspace.fs.writeFile(fileUri, Buffer.from(tilesetContent));

      // Show success notification
      vscode.window.showInformationMessage(`Tileset asset created at ${fileUri.fsPath}`);

      // Open the created file in editor
      await vscode.commands.executeCommand("vscode.open", fileUri);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create tileset asset";
      vscode.window.showErrorMessage(`Error creating tileset: ${message}`);
    }
  }
};
