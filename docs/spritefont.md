# Sprite Font Resource

The sprite font resource (`.asset` files with `type: "spritefont"`) converts TrueType or OpenType fonts into optimized bitmap spritesheets for rendering text in games and applications.

## Overview

A sprite font asset consists of:
- **PNG spritesheet**: Rasterized glyphs packed into 256×256-pixel pages, stacked vertically
- **Metadata file** (`.asset`): JSON containing glyph metrics, kerning data, and atlas information

This format enables efficient text rendering without runtime font loading, ideal for performance-critical or offline-capable applications.

## Accessing the Sprite Font Generator

### Via Command Palette

1. Open VS Code and press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
2. Search for **"Tile Engine: Sprite Font Generator"**
3. Press Enter to open the generator tool in a new webview panel

### Notes
- The generator is a standalone tool, not tied to any open document
- If already open, the Command Palette command will focus the existing panel
- File operations use workspace-relative or absolute paths

## Using the Sprite Font Generator

### Step 1: Load a Font
1. Click the **"Select Font"** button
2. Choose a TrueType (`.ttf`) or OpenType (`.otf`) file from your workspace
3. The tool displays the loaded font name and is ready for configuration

### Step 2: Configure Output
Customize the following settings:

#### Font Rendering
- **Font Size**: Rasterization size in pixels (default: 32)
- **Style**: Normal or italic (requires font support)
- **Weight**: Normal or bold (requires font support)

#### Glyph Coverage
The tool includes glyphs from multiple sources:
- **Required Presets** (always included):
  - Digits: `0-9`
  - Uppercase: `A-Z`
  - Lowercase: `a-z`
  - Whitespace: space, tab, non-breaking space
  - Fallback: `?` (for missing glyphs)

- **Optional Presets** (toggleable):
  - **ASCII Printable**: All printable ASCII characters (U+0020–U+007E)
  - **Latin-1 Supplement**: Extended Latin characters (U+00A0–U+00FF)
  - **Punctuation**: Standalone punctuation marks

- **Custom Ranges**: Add additional codepoints by entering ranges in the textarea:
  - Format: `start-end` (inclusive), separated by `,` or `;`
  - Hexadecimal (prefix with `0x`): `0x100-0x17f`
  - Decimal: `256-383`
  - Example: `0x100-0x17f, 192-255` includes Latin Extended-A and custom decimal range

#### Packing & Rendering
- **Padding**: Pixel border around each glyph (default: 1)
- **Kerning**: Enable/disable pair-based glyph adjustment (default: enabled)
- **Anti-aliasing**: Smooth glyph edges or enable 1-bit monochrome threshold (default: enabled/smooth)

### Step 3: Generate & Export
1. Click the **"Generate Sprite Font"** button
2. A save dialog appears—choose location and filename (e.g., `myfont.png`)
3. Two files are created:
   - **PNG spritesheet**: `myfont.png` (binary image data)
   - **Metadata**: `myfont.asset` (JSON with glyph metrics and atlas info)

The status bar displays:
- Glyph count and page count during generation
- Completion message with file paths on success

## Output Format

### Asset File Structure (`.asset`)

```json
{
  "type": "spritefont",
  "info": {
    "face": "Roboto",
    "size": 32,
    "style": "normal",
    "weight": "normal",
    "pages": 1,
    "lineHeight": 38,
    "baseline": 25,
    "padding": 1,
    "antialias": true
  },
  "image": "myfont.png",
  "glyphs": {
    "65": {
      "codepoint": 65,
      "xAdvance": 20,
      "xOffset": 1,
      "yOffset": -25,
      "baseline": 25,
      "bounds": { "xMin": 0, "xMax": 18, "yMin": -25, "yMax": 0 },
      "kerning": { "86": -2 },
      "page": 0,
      "x": 10,
      "y": 5,
      "width": 20,
      "height": 26
    }
  },
  "pages": {
    "width": 256,
    "height": 256
  }
}
```

### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Always `"spritefont"` |
| `info.face` | string | Font family name |
| `info.size` | number | Rasterized font size in pixels |
| `info.style` | string | `"normal"` or `"italic"` |
| `info.weight` | string | `"normal"` or `"bold"` |
| `info.pages` | number | Total page count in spritesheet |
| `info.lineHeight` | number | Recommended line spacing in pixels |
| `info.baseline` | number | Baseline offset in pixels (from top) |
| `info.padding` | number | Pixel padding around each glyph |
| `info.antialias` | boolean | Whether anti-aliasing was applied |
| `image` | string | Filename of PNG spritesheet (relative to asset) |
| `glyphs` | object | Map of codepoint (as string) to `GlyphMetrics` |
| `pages` | object | `{ width, height }` of stacked spritesheet |

#### Glyph Metrics Object

| Field | Type | Description |
|-------|------|-------------|
| `codepoint` | number | Unicode codepoint (0–1,114,111) |
| `xAdvance` | number | Horizontal advance width (pixels) |
| `xOffset` | number | Glyph x-offset from origin (pixels) |
| `yOffset` | number | Glyph y-offset from origin (pixels) |
| `baseline` | number | Baseline offset (pixels from top) |
| `bounds` | object | `{ xMin, xMax, yMin, yMax }` bounding box |
| `kerning` | object | Map of codepoint to adjustment value |
| `page` | number | Page index in stacked spritesheet (0-based) |
| `x` | number | Glyph x-position on page (pixels) |
| `y` | number | Glyph y-position on page (pixels) |
| `width` | number | Glyph width including padding (pixels) |
| `height` | number | Glyph height including padding (pixels) |

### Multi-Page Atlas Layout

All pages in a sprite font atlas are stored in a single PNG image, **stacked vertically**. Each page is 256×256 pixels. When rendering glyphs, you must calculate the Y-offset for the page:

```
pageOffsetY = glyph.page * pageHeight
```

**Example:** If a glyph is on page 2 at position `y: 50`:
- Page height: 256px
- Page offset: `2 × 256 = 512px`
- Final Y position in atlas: `512 + 50 = 562px`

This vertical stacking allows efficient storage and loading of large character sets while maintaining compatibility with standard image formats. The spritesheet PNG file dimensions will be `256 × (256 × pageCount)` pixels.

**Visual layout:**
```
┌─────────────┐
│   Page 0    │  Y: 0-255
│  (256×256)  │
├─────────────┤
│   Page 1    │  Y: 256-511
│  (256×256)  │
├─────────────┤
│   Page 2    │  Y: 512-767
│  (256×256)  │
└─────────────┘
```

## Consuming Sprite Fonts

Sprite font assets can be imported and used by game engines or rendering libraries. The shared types are available from the `common` package:

```typescript
import type { SpriteFontAsset, GlyphMetrics } from "@common/sprite-font";

async function loadSpriteFont(assetPath: string): Promise<SpriteFontAsset> {
  const response = await fetch(assetPath);
  return response.json();
}

async function renderText(text: string, asset: SpriteFontAsset): Promise<HTMLCanvasElement> {
  // Load PNG image
  const image = new Image();
  image.src = asset.image;
  await new Promise(resolve => image.onload = resolve);

  // Calculate total width
  let totalWidth = 0;
  for (const char of text) {
    const cp = char.charCodeAt(0);
    const metrics = asset.glyphs[cp.toString()];
    totalWidth += metrics?.xAdvance ?? 0;
  }

  // Render to canvas
  const canvas = document.createElement("canvas");
  canvas.width = totalWidth;
  canvas.height = asset.info.lineHeight;
  const ctx = canvas.getContext("2d")!;

  let x = 0;
  for (const char of text) {
    const cp = char.charCodeAt(0);
    const metrics = asset.glyphs[cp.toString()];
    if (metrics) {
      // Calculate Y-offset for vertically stacked pages
      const pageYOffset = metrics.page * asset.pages.height;
      ctx.drawImage(
        image,
        metrics.x, pageYOffset + metrics.y,  // Source position with page offset
        metrics.width, metrics.height,
        x + metrics.xOffset, asset.info.baseline + metrics.yOffset,
        metrics.width, metrics.height
      );
      x += metrics.xAdvance;
    }
  }

  return canvas;
}
```

## Tips & Best Practices

### Font Selection
- Use **high-quality fonts** with complete glyph coverage for better results
- Test with both serif and sans-serif fonts; rendering quality varies
- Ensure the font has a complete fallback glyph (`?`) for missing characters

### Performance
- Generate **larger pages** (256×256) to reduce texture memory overhead
- **Disable kerning** if not needed; it increases metadata size
- Use **monochrome mode** (anti-aliasing off) for pixel-art or retro aesthetics

### Customization
- **Custom ranges** are useful for non-Latin scripts or special symbol sets
- **Padding** of 1–2 pixels prevents color bleeding on atlas edges (important for hardware filtering)
- **Multiple fonts**: Generate separate sprite fonts for different sizes/styles rather than resizing

### Troubleshooting
- **Missing glyphs**: Check that optional presets or custom ranges include the needed codepoints
- **Large file size**: Reduce font size or disable kerning
- **Blurry rendering**: Enable anti-aliasing (default); ensure target application uses nearest-neighbor filtering for pixel fonts

## Related Resources
- [Asset File Format](../README.md#asset-file-format) — Overview of `.asset` files
- [Tile Engine Extension Architecture](../README.md#architecture) — Plugin system details
