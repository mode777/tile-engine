import { PluginMetadata } from "../protocol/messages";

export interface AssetData {
  type: string;
  [key: string]: unknown;
}

export interface AssetEditorPluginDescriptor extends PluginMetadata {}

export interface AssetEditorPlugin<T extends AssetData = AssetData> {
  readonly metadata: AssetEditorPluginDescriptor;
  readonly createDefault: () => T;
}
