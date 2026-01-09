import {
  AssetEditorPlugin,
  AssetEditorPluginDescriptor,
  AssetData,
  StandaloneToolPlugin,
  HeadlessTool,
  Plugin
} from "./asset-editor-plugin";
import { exampleAssetPlugin } from "./example/example-asset-plugin";
import { assetGeneratorTool } from "./example/asset-generator-tool";
import { spriteFontTool } from "./sprite-font-tool";
import { spriteFontPreviewPlugin } from "./spritefont-preview-plugin";
import { tilesetTool } from "./tools/tileset-tool";

const editorPlugins: AssetEditorPlugin[] = [exampleAssetPlugin, spriteFontPreviewPlugin];
const toolPlugins: StandaloneToolPlugin[] = [assetGeneratorTool, spriteFontTool];
const headlessTools: HeadlessTool[] = [tilesetTool];

// ===== Editor Plugin Functions =====

export function listPlugins(): AssetEditorPluginDescriptor[] {
  return editorPlugins.map((plugin) => plugin.metadata);
}

export function getPluginDescriptor(type: string): AssetEditorPluginDescriptor {
  const plugin = editorPlugins.find((entry) => entry.metadata.type === type);
  if (!plugin) {
    throw new Error(`No asset editor plugin registered for type '${type}'.`);
  }
  return plugin.metadata;
}

export function getDefaultContentForType<T extends AssetData>(
  type: string
): T | undefined {
  const plugin = editorPlugins.find((entry) => entry.metadata.type === type);
  return plugin?.createDefault() as T | undefined;
}

export function hasPlugin(type: string): boolean {
  return editorPlugins.some((entry) => entry.metadata.type === type);
}

// ===== Tool Plugin Functions =====

export function getToolPlugins(): StandaloneToolPlugin[] {
  return toolPlugins;
}

export function getToolPlugin(type: string): StandaloneToolPlugin | undefined {
  return toolPlugins.find((tool) => tool.metadata.type === type);
}

// ===== Headless Tool Functions =====

export function getHeadlessTools(): HeadlessTool[] {
  return headlessTools;
}

export function getHeadlessTool(type: string): HeadlessTool | undefined {
  return headlessTools.find((tool) => tool.metadata.type === type);
}
