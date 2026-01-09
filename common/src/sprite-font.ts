/**
 * Shared types for sprite font asset serialization.
 * Used by both the generator tool and the runtime.
 */

export interface GlyphBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface GlyphMetrics {
  codepoint: number;
  xAdvance: number;
  xOffset: number;
  yOffset: number;
  baseline: number;
  bounds: GlyphBounds;
  kerning: Record<number, number>;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type FontStyle = "normal" | "italic";
export type FontWeight = "normal" | "bold";

export interface SpriteFontAsset {
  type: "spritefont";
  info: {
    face: string;
    size: number;
    style: FontStyle;
    weight: FontWeight;
    pages: number;
    lineHeight: number;
    baseline: number;
    padding: number;
    antialias: boolean;
  };
  image: string;
  glyphs: Record<string, GlyphMetrics>;
  pages: { width: number; height: number };
}
