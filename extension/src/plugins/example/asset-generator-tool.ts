import { StandaloneToolPlugin } from "../asset-editor-plugin";

export const assetGeneratorTool: StandaloneToolPlugin = {
  metadata: {
    mode: "tool",
    type: "asset-generator",
    commandId: "tile-engine.tools.generateAsset",
    title: "Generate Asset",
    description: "Generate and save example asset files."
  },
  onOpen: async () => {
    console.log("Asset Generator tool opened");
  },
  onClose: () => {
    console.log("Asset Generator tool closed");
  }
};
