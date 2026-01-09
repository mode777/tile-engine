import { AssetData, AssetEditorPlugin } from "../../plugin-system/types";

export interface ExampleAsset extends AssetData {
  type: "example";
  name: string;
  value: number;
  enabled: boolean;
}

export const exampleAssetPlugin: AssetEditorPlugin<ExampleAsset> = {
  metadata: {
    mode: "editor",
    type: "example",
    title: "Example Asset",
    description: "Demonstration plugin for Tile Engine assets."
  },
  createDefault: () => ({
    type: "example",
    name: "New Asset",
    value: 1,
    enabled: true
  })
};
