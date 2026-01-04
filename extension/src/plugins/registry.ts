import {
  AssetEditorPlugin,
  AssetEditorPluginDescriptor,
  AssetData
} from "./asset-editor-plugin";
import { exampleAssetPlugin } from "./example/example-asset-plugin";

const plugins: AssetEditorPlugin[] = [exampleAssetPlugin];

export function listPlugins(): AssetEditorPluginDescriptor[] {
  return plugins.map((plugin) => plugin.metadata);
}

export function getPluginDescriptor(type: string): AssetEditorPluginDescriptor {
  const plugin = plugins.find((entry) => entry.metadata.type === type);
  if (!plugin) {
    throw new Error(`No asset editor plugin registered for type '${type}'.`);
  }
  return plugin.metadata;
}

export function getDefaultContentForType<T extends AssetData>(
  type: string
): T | undefined {
  const plugin = plugins.find((entry) => entry.metadata.type === type);
  return plugin?.createDefault() as T | undefined;
}

export function hasPlugin(type: string): boolean {
  return plugins.some((entry) => entry.metadata.type === type);
}
