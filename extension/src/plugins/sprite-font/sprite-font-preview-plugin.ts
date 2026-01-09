import { AssetEditorPlugin, AssetData } from "../../plugin-system/types";

interface SpriteFontAsset extends AssetData {
  type: "spritefont";
  info: {
    face: string;
    size: number;
    style: "normal" | "italic";
    weight: "normal" | "bold";
    pages: number;
    lineHeight: number;
    baseline: number;
    padding: number;
    antialias: boolean;
  };
  image: string;
  glyphs: Record<string, unknown>;
  pages: { width: number; height: number };
}

export const spriteFontPreviewPlugin: AssetEditorPlugin<SpriteFontAsset> = {
  metadata: {
    mode: "editor",
    type: "spritefont",
    title: "Sprite Font Preview",
    description: "Preview and test sprite font assets",
    readonly: true
  },
  createDefault: () => ({
    type: "spritefont",
    info: {
      face: "Default Font",
      size: 16,
      style: "normal",
      weight: "normal",
      pages: 1,
      lineHeight: 20,
      baseline: 16,
      padding: 1,
      antialias: true
    },
    image: "font.png",
    glyphs: {},
    pages: { width: 256, height: 256 }
  })
};
