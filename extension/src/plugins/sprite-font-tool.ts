import { StandaloneToolPlugin } from "./asset-editor-plugin";

export const spriteFontTool: StandaloneToolPlugin = {
  metadata: {
    mode: "tool",
    type: "sprite-font",
    commandId: "tile-engine.tools.spriteFont",
    title: "Sprite Font Generator",
    description: "Generate bitmap sprite fonts from TTF/OTF files."
  },
  onOpen: () => {
    console.log("Sprite Font Generator opened");
  },
  onClose: () => {
    console.log("Sprite Font Generator closed");
  }
};
