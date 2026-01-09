/**
 * Sprite font text layout and word wrapping utilities.
 */
import type { SpriteFontAsset, GlyphMetrics } from "./sprite-font";

export interface PlacedGlyph {
  metrics: GlyphMetrics;
  x: number;
  y: number;
}

export interface TextLine {
  glyphs: PlacedGlyph[];
  width: number;
  height: number;
  baseline: number;
}

/**
 * Breaks text into lines with word wrapping.
 */
export function layoutText(
  text: string,
  maxWidth: number,
  asset: SpriteFontAsset
): TextLine[] {
  const result: TextLine[] = [];
  const wrappingEnabled = maxWidth > 0;
  const rowHeight = asset.info.lineHeight;
  const baselineOffset = asset.info.baseline;
  
  // Handle each paragraph separately
  const paragraphs = text.split(/\r?\n/);
  
  for (const para of paragraphs) {
    if (!para) {
      // Blank line
      result.push({ glyphs: [], width: 0, height: rowHeight, baseline: baselineOffset });
      continue;
    }
    
    // Break into word and space segments
    const segments = breakIntoSegments(para);
    
    // Build lines from segments
    const paraLines = buildLinesFromSegments(segments, wrappingEnabled, maxWidth, asset, rowHeight, baselineOffset);
    result.push(...paraLines);
  }
  
  return result;
}

function breakIntoSegments(text: string): string[] {
  const segments: string[] = [];
  let buffer = "";
  let wasSpace = false;
  
  for (const ch of text) {
    const isSpace = /\s/.test(ch);
    
    if (buffer && isSpace !== wasSpace) {
      segments.push(buffer);
      buffer = "";
    }
    
    buffer += ch;
    wasSpace = isSpace;
  }
  
  if (buffer) segments.push(buffer);
  return segments;
}

function buildLinesFromSegments(
  segments: string[],
  wrap: boolean,
  maxW: number,
  asset: SpriteFontAsset,
  rowH: number,
  baselineOff: number
): TextLine[] {
  const lines: TextLine[] = [];
  let currentGlyphs: PlacedGlyph[] = [];
  let xPosition = 0;
  let lineWidth = 0;
  let lastCP: number | null = null;
  
  const commitLine = () => {
    lines.push({
      glyphs: currentGlyphs,
      width: lineWidth,
      height: rowH,
      baseline: baselineOff
    });
    currentGlyphs = [];
    xPosition = 0;
    lineWidth = 0;
    lastCP = null;
  };
  
  for (const seg of segments) {
    const { glyphs: segGlyphs, width: segW, finalCP } = measureSegment(seg, xPosition, asset, lastCP);
    
    // Check if we need to wrap
    if (wrap && xPosition + segW > maxW && currentGlyphs.length > 0) {
      commitLine();
      // Re-measure segment from x=0
      const remeasured = measureSegment(seg, 0, asset, null);
      currentGlyphs.push(...remeasured.glyphs);
      xPosition = remeasured.width;
      lineWidth = remeasured.width;
      lastCP = remeasured.finalCP;
    } else {
      currentGlyphs.push(...segGlyphs);
      xPosition += segW;
      lineWidth = xPosition;
      lastCP = finalCP;
    }
  }
  
  // Commit final line
  if (currentGlyphs.length > 0) {
    commitLine();
  }
  
  return lines;
}

function measureSegment(
  segment: string,
  startX: number,
  asset: SpriteFontAsset,
  prevCP: number | null
): { glyphs: PlacedGlyph[]; width: number; finalCP: number | null } {
  const glyphs: PlacedGlyph[] = [];
  let x = 0;
  let cp = prevCP;
  
  for (const ch of segment) {
    const charCode = ch.charCodeAt(0);
    const key = charCode.toString();
    let glyph = asset.glyphs[key];
    
    // Use fallback '?' if missing
    if (!glyph) {
      glyph = asset.glyphs["63"];
      if (!glyph) continue;
    }
    
    // Add kerning adjustment
    const kern = (cp !== null && glyph.kerning?.[cp]) ? glyph.kerning[cp] : 0;
    
    glyphs.push({
      metrics: glyph,
      x: startX + x + kern,
      y: 0
    });
    
    x += glyph.xAdvance + kern;
    cp = charCode;
  }
  
  return { glyphs, width: x, finalCP: cp };
}
