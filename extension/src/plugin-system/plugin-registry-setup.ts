import { AssetEditorPlugin, StandaloneToolPlugin, HeadlessTool } from "./types";
import { initializeRegistry, getToolPlugins, getHeadlessTools } from "./registry";

import { exampleAssetPlugin } from "../plugins/example/example-asset-plugin";
import { assetGeneratorTool } from "../plugins/example/asset-generator-tool";
import { spriteFontTool } from "../plugins/sprite-font/sprite-font-tool";
import { spriteFontPreviewPlugin } from "../plugins/sprite-font/sprite-font-preview-plugin";
import { tilesetTool } from "../plugins/tools/tileset-tool";

/**
 * Set up the plugin registry.
 * This is the single point where all plugins are registered.
 * Called once during extension activation.
 */
export function setupPluginRegistry(): void {
  const editorPlugins: AssetEditorPlugin[] = [
    exampleAssetPlugin,
    spriteFontPreviewPlugin
  ];

  const toolPlugins: StandaloneToolPlugin[] = [
    assetGeneratorTool,
    spriteFontTool
  ];

  const headlessTools: HeadlessTool[] = [tilesetTool];

  initializeRegistry(editorPlugins, toolPlugins, headlessTools);
}

// Re-export registry functions for use in extension.ts
export { getToolPlugins, getHeadlessTools };
