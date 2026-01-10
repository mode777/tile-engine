import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import type { Component } from "solid-js";
import opentype, { type Font, type Glyph } from "opentype.js";
import type { AssetJson } from "@protocol/messages";
import { MessageService } from "../../services/message-service";
import type { PluginComponentProps, WebviewAssetPlugin } from "../registry";
import type {
  SpriteFontAsset,
  GlyphMetrics,
  GlyphBounds,
  FontStyle,
  FontWeight
} from "@common/sprite-font";

const PAGE_SIZE = 256;
const REQUIRED_PRESETS = ["digits", "upper", "lower", "whitespace"] as const;
const OPTIONAL_PRESETS = ["ascii", "latin1", "punctuation"] as const;

const styles = `
.sprite-font {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  color: var(--vscode-editor-foreground);
}

.sprite-font .header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.sprite-font h1 {
  margin: 0;
  font-size: 1.4rem;
}

.sprite-font p {
  margin: 0.2rem 0 0;
  color: var(--vscode-descriptionForeground);
}

.panel {
  border: 1px solid var(--vscode-panel-border);
  background: var(--vscode-editorWidget-background);
  border-radius: 6px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.row label {
  width: 140px;
  color: var(--vscode-descriptionForeground);
}

.row .value {
  flex: 1;
  font-weight: 600;
}

.control-group {
  display: flex;
  gap: 0.5rem;
}

input[type="number"],
input[type="text"],
select {
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
  padding: 0.35rem 0.5rem;
  border-radius: 4px;
}

button.primary {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: 1px solid var(--vscode-button-border, transparent);
  border-radius: 4px;
  padding: 0.5rem 0.9rem;
  cursor: pointer;
}

button.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.35rem;
  flex: 1;
}

.checkbox {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--vscode-editor-foreground);
}

.required {
  color: var(--vscode-descriptionForeground);
  font-size: 0.85rem;
}

.row.stats {
  justify-content: space-between;
  font-weight: 600;
}

.actions {
  display: flex;
  justify-content: flex-end;
}

.actions button + button {
  margin-left: 0.5rem;
}

.footnote {
  color: var(--vscode-descriptionForeground);
  font-size: 0.85rem;
  margin-top: 0.5rem;
}

.preview-panel {
  border: 1px solid var(--vscode-panel-border);
  background: #000000;
  border-radius: 6px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;
}

.preview-canvas {
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
  border: 1px solid var(--vscode-panel-border);
  background: #000000;
}

.preview-label {
  color: var(--vscode-descriptionForeground);
  font-size: 0.9rem;
  align-self: flex-start;
}
`;

type RequiredPreset = (typeof REQUIRED_PRESETS)[number];
type OptionalPreset = (typeof OPTIONAL_PRESETS)[number];
type CodepointPreset = RequiredPreset | OptionalPreset;

interface SpriteFontValue extends AssetJson {
  type: "sprite-font";
}

// Tool-specific types (not part of serialized format)
interface GlyphBitmap {
  codepoint: number;
  canvas: HTMLCanvasElement;
  metrics: Omit<GlyphMetrics, "page" | "x" | "y">;
}

interface Shelf {
  y: number;
  height: number;
  x: number;
}

interface PageLayout {
  index: number;
  shelves: Shelf[];
  usedHeight: number;
}

interface PackedGlyph extends GlyphBitmap {
  page: number;
  x: number;
  y: number;
}

const presetDefinitions: Record<CodepointPreset, { label: string; codes: number[] }> = {
  digits: { label: "Digits 0-9", codes: range(0x30, 0x39) },
  upper: { label: "Uppercase A-Z", codes: range(0x41, 0x5a) },
  lower: { label: "Lowercase a-z", codes: range(0x61, 0x7a) },
  whitespace: { label: "Whitespace (space, tab, NBSP)", codes: [0x20, 0x09, 0xa0] },
  ascii: { label: "ASCII Printable", codes: range(0x20, 0x7e) },
  latin1: { label: "Latin-1 Supplement", codes: range(0xa0, 0xff) },
  punctuation: { label: "Punctuation", codes: [...range(0x21, 0x2f), ...range(0x3a, 0x40), ...range(0x5b, 0x60), ...range(0x7b, 0x7e)] }
};

const defaultOptionalPresets: OptionalPreset[] = ["ascii"];

function range(start: number, end: number): number[] {
  const items: number[] = [];
  for (let i = start; i <= end; i++) items.push(i);
  return items;
}

function uniqueSorted(values: Iterable<number>): number[] {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function parseCustomRanges(input: string): number[] {
  if (!input.trim()) return [];
  const parts = input.split(/[;,]+/).map((part) => part.trim()).filter(Boolean);
  const codes: number[] = [];

  for (const part of parts) {
    const [startStr, endStr] = part.split("-").map((s) => s.trim());
    const parse = (value: string) =>
      value.startsWith("0x") ? parseInt(value, 16) : parseInt(value, 10);

    if (!endStr) {
      const cp = parse(startStr);
      if (!Number.isNaN(cp)) codes.push(cp);
    } else {
      const start = parse(startStr);
      const end = parse(endStr);
      if (!Number.isNaN(start) && !Number.isNaN(end)) {
        codes.push(...range(Math.min(start, end), Math.max(start, end)));
      }
    }
  }

  return uniqueSorted(codes);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function formatCodepoint(cp: number): string {
  return `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
}

const SpriteFontToolComponent: Component<PluginComponentProps<SpriteFontValue>> = (
  props
) => {
  const [font, setFont] = createSignal<Font | null>(null);
  const [fontFamily, setFontFamily] = createSignal<string | null>(null);
  const [fontName, setFontName] = createSignal<string | null>(null);
  const [fontPath, setFontPath] = createSignal<string | null>(null);
  const [fontSize, setFontSize] = createSignal<number>(32);
  const [fontStyle, setFontStyle] = createSignal<FontStyle>("normal");
  const [fontWeight, setFontWeight] = createSignal<FontWeight>("normal");
  const [optionalPresets, setOptionalPresets] = createSignal<Set<OptionalPreset>>(new Set(defaultOptionalPresets));
  const [customRanges, setCustomRanges] = createSignal<string>("");
  const [padding, setPadding] = createSignal<number>(1);
  const [antialias, setAntialias] = createSignal<boolean>(true);
  const [includeKerning, setIncludeKerning] = createSignal<boolean>(true);
  const [status, setStatus] = createSignal<string>("Select a font to begin.");
  const [busy, setBusy] = createSignal<boolean>(false);
  const [glyphCount, setGlyphCount] = createSignal<number>(0);
  const [pageCount, setPageCount] = createSignal<number>(0);
  const [previewCanvas, setPreviewCanvas] = createSignal<HTMLCanvasElement | null>(null);
  let previewTarget: HTMLCanvasElement | null = null;

  const codepoints = createMemo(() => {
    const selected: CodepointPreset[] = [
      ...REQUIRED_PRESETS,
      ...Array.from(optionalPresets().values())
    ];
    const codes = selected.flatMap((preset) => presetDefinitions[preset].codes);
    const custom = parseCustomRanges(customRanges());
    const merged = uniqueSorted([...codes, ...custom, 0x3f]);
    return merged;
  });

  const lineHeight = createMemo(() => {
    const f = font();
    if (!f) return 0;
    const scale = fontSize() / f.unitsPerEm;
    return Math.ceil((f.ascender - f.descender) * scale + padding() * 2);
  });

  const baselinePx = createMemo(() => {
    const f = font();
    if (!f) return 0;
    const scale = fontSize() / f.unitsPerEm;
    return Math.ceil(f.ascender * scale + padding());
  });

  const toggleOptionalPreset = (preset: OptionalPreset) => {
    const next = new Set(optionalPresets());
    if (next.has(preset)) {
      next.delete(preset);
    } else {
      next.add(preset);
    }
    setOptionalPresets(next);
  };

  const pickFont = async () => {
    try {
      setBusy(true);
      setStatus("Opening font picker…");
      const [picked] = await MessageService.instance.pickFile({
        filters: { Fonts: ["ttf", "otf"] },
        canSelectMany: false
      });
      if (!picked) {
        setStatus("Font selection cancelled.");
        return;
      }

      const binary = await MessageService.instance.readFile(picked, "binary");
      const bytes = base64ToUint8Array(binary);
      const parsed = opentype.parse(bytes.buffer);

      const family = `SpriteFont-${Math.random().toString(36).slice(2, 8)}`;
      const fontSource = bytes.buffer as ArrayBuffer;
      const fontFace = new FontFace(family, fontSource);
      await fontFace.load();
      const fontFaceSet = document.fonts as FontFaceSet & { add?: (font: FontFace) => void };
      fontFaceSet.add?.(fontFace);

      const name =
        parsed.names.fullName?.en ??
        parsed.names.fontFamily?.en ??
        parsed.names.postScriptName?.en ??
        "Custom Font";
      setFont(parsed);
      setFontFamily(family);
      setFontName(name);
      setFontPath(picked);
      setStatus(`Loaded font ${name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load font";
      MessageService.instance.showNotification("error", message);
      setStatus(message);
      setFont(null);
      setFontFamily(null);
    } finally {
      setBusy(false);
    }
  };

  const measureGlyph = (
    glyph: Glyph,
    fallbackGlyph: Glyph,
    f: Font
  ): GlyphBitmap => {
    const scale = fontSize() / f.unitsPerEm;
    const paddingPx = padding();
    const isTab = glyph.unicode === 0x09;
    const isSpace = glyph.unicode === 0x20 || glyph.unicode === 0xa0;
    const renderGlyph = isTab ? fallbackGlyph : glyph;
    const spaceGlyph = f.charToGlyph(" ") || fallbackGlyph;
    const spaceAdvanceWidth = (spaceGlyph.advanceWidth ?? f.unitsPerEm) * scale;
    const bbox = renderGlyph.getBoundingBox();
    const xMin = bbox.x1 * scale;
    const xMax = bbox.x2 * scale;
    const yMin = bbox.y1 * scale;
    const yMax = bbox.y2 * scale;
    const width = Math.max(
      1,
      Math.ceil((isSpace || isTab ? spaceAdvanceWidth : xMax - xMin) + paddingPx * 2)
    );
    const ascent = f.ascender * scale;
    const descent = Math.abs(f.descender * scale);
    const height = Math.max(
      1,
      Math.ceil((isSpace || isTab ? ascent + descent : yMax - yMin) + paddingPx * 2)
    );

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    ctx.fillStyle = "white";
    ctx.textBaseline = "alphabetic";
    ctx.font = `${fontStyle()} ${fontWeight()} ${fontSize()}px "${fontFamily() ?? ""}"`;

    const xDraw = -xMin + paddingPx;
    const yDraw = yMax + paddingPx;

    if (isSpace) {
      // Space/NBSP: no drawing, but keep metrics
    } else if (isTab) {
      // Tab: render four spaces worth of advance but draw nothing
    } else {
      ctx.fillText(String.fromCodePoint(renderGlyph.unicode ?? 0x3f), xDraw, yDraw);
    }

    if (!antialias()) {
      const img = ctx.getImageData(0, 0, width, height);
      const data = img.data;
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha > 127) {
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
          data[i + 3] = 255;
        } else {
          data[i + 3] = 0;
        }
      }
      ctx.putImageData(img, 0, 0);
    }

    const advanceBase = (renderGlyph.advanceWidth ?? f.unitsPerEm) * scale;
    const xAdvance = isTab ? spaceAdvanceWidth * 4 : advanceBase;

    const kerning: Record<number, number> = {};
    if (includeKerning()) {
      for (const cp of codepoints()) {
        const otherGlyph = f.charToGlyph(String.fromCodePoint(cp)) || fallbackGlyph;
        const kern = f.getKerningValue(renderGlyph, otherGlyph) * scale;
        if (kern !== 0) {
          kerning[cp] = kern;
        }
      }
    }

    return {
      codepoint: glyph.unicode ?? 0x3f,
      canvas,
      metrics: {
        codepoint: glyph.unicode ?? 0x3f,
        xAdvance,
        xOffset: Math.floor(xMin) - paddingPx,
        yOffset: Math.floor(-yMax) - paddingPx,
        baseline: Math.ceil(ascent + paddingPx),
        bounds: { xMin, xMax, yMin, yMax },
        kerning,
        width,
        height
      }
    };
  };

  const packGlyphs = (glyphs: GlyphBitmap[]): PackedGlyph[] => {
    const sorted = [...glyphs].sort((a, b) => b.metrics.height - a.metrics.height);
    const pages: PageLayout[] = [{ index: 0, shelves: [], usedHeight: 0 }];
    const placements: PackedGlyph[] = [];

    for (const glyph of sorted) {
      let placed = false;
      for (const page of pages) {
        for (const shelf of page.shelves) {
          if (
            glyph.metrics.width <= PAGE_SIZE - shelf.x &&
            glyph.metrics.height <= shelf.height
          ) {
            placements.push({ ...glyph, page: page.index, x: shelf.x, y: shelf.y });
            shelf.x += glyph.metrics.width;
            placed = true;
            break;
          }
        }
        if (placed) break;

        if (page.usedHeight + glyph.metrics.height <= PAGE_SIZE) {
          const shelf: Shelf = {
            y: page.usedHeight,
            height: glyph.metrics.height,
            x: glyph.metrics.width
          };
          page.shelves.push(shelf);
          placements.push({ ...glyph, page: page.index, x: 0, y: shelf.y });
          page.usedHeight += glyph.metrics.height;
          placed = true;
          break;
        }
      }

      if (!placed) {
        const nextIndex = pages.length;
        pages.push({ index: nextIndex, shelves: [], usedHeight: 0 });
        const page = pages[pages.length - 1];
        if (glyph.metrics.width > PAGE_SIZE || glyph.metrics.height > PAGE_SIZE) {
          throw new Error(
            `Glyph ${formatCodepoint(glyph.codepoint)} does not fit in a ${PAGE_SIZE}x${PAGE_SIZE} page.`
          );
        }
        const shelf: Shelf = {
          y: 0,
          height: glyph.metrics.height,
          x: glyph.metrics.width
        };
        page.shelves.push(shelf);
        placements.push({ ...glyph, page: page.index, x: 0, y: shelf.y });
        page.usedHeight = glyph.metrics.height;
      }
    }

    setPageCount(pages.length);
    return placements;
  };

  const buildAtlas = (placements: PackedGlyph[]) => {
    const aa = antialias();
    const pages: HTMLCanvasElement[] = [];
    const pageContexts: CanvasRenderingContext2D[] = [];
    const maxPage = placements.reduce((max, g) => Math.max(max, g.page), 0);

    for (let i = 0; i <= maxPage; i++) {
      const canvas = document.createElement("canvas");
      canvas.width = PAGE_SIZE;
      canvas.height = PAGE_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
      ctx.imageSmoothingEnabled = aa;
      pages.push(canvas);
      pageContexts.push(ctx);
    }

    for (const glyph of placements) {
      const ctx = pageContexts[glyph.page];
      ctx.drawImage(glyph.canvas, glyph.x, glyph.y);
    }

    const stacked = document.createElement("canvas");
    stacked.width = PAGE_SIZE;
    stacked.height = PAGE_SIZE * pages.length;
    const stackedCtx = stacked.getContext("2d");
    if (!stackedCtx) throw new Error("Canvas not supported");
    stackedCtx.imageSmoothingEnabled = aa;

    pages.forEach((page, idx) => {
      stackedCtx.drawImage(page, 0, idx * PAGE_SIZE);
    });

    return { stacked, pageCount: pages.length };
  };

  const generatePreview = async () => {
    const f = font();
    if (!f || !fontFamily()) {
      setPreviewCanvas(null);
      return;
    }

    try {
      const fallbackGlyph = f.charToGlyph("?");
      if (!fallbackGlyph || fallbackGlyph.unicode === undefined) {
        setPreviewCanvas(null);
        return;
      }

      const glyphBitmaps: GlyphBitmap[] = [];
      for (const cp of codepoints()) {
        const glyph = f.charToGlyph(String.fromCodePoint(cp));
        const sourceGlyph = glyph && glyph.unicode !== undefined ? glyph : fallbackGlyph;
        const measured = measureGlyph(sourceGlyph, fallbackGlyph, f);
        measured.metrics.codepoint = cp;
        glyphBitmaps.push({ ...measured, codepoint: cp });
      }

      const placements = packGlyphs(glyphBitmaps);
      setGlyphCount(placements.length);
      const atlas = buildAtlas(placements);

      // Create 2x zoomed preview with pixelated rendering
      const preview = document.createElement("canvas");
      preview.width = atlas.stacked.width * 2;
      preview.height = atlas.stacked.height * 2;
      const previewCtx = preview.getContext("2d");
      if (!previewCtx) return;

      // Disable image smoothing for pixelated look
      previewCtx.imageSmoothingEnabled = false;
      
      // Black background
      previewCtx.fillStyle = "#000000";
      previewCtx.fillRect(0, 0, preview.width, preview.height);
      
      // Draw atlas at 2x scale
      previewCtx.drawImage(
        atlas.stacked,
        0, 0,
        atlas.stacked.width, atlas.stacked.height,
        0, 0,
        preview.width, preview.height
      );

      setPreviewCanvas(preview);
    } catch (error) {
      console.error("Preview generation failed:", error);
      setPreviewCanvas(null);
    }
  };

  // Paint preview canvas whenever a new preview is generated
  createEffect(() => {
    const preview = previewCanvas();
    if (!preview || !previewTarget) return;

    previewTarget.width = preview.width;
    previewTarget.height = preview.height;
    const ctx = previewTarget.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, previewTarget.width, previewTarget.height);
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, previewTarget.width, previewTarget.height);
    ctx.drawImage(preview, 0, 0);
  });

  const exportSpriteFont = async () => {
    try {
      const f = font();
      if (!f || !fontFamily()) {
        MessageService.instance.showNotification("warning", "Load a font before exporting.");
        return;
      }
      setBusy(true);
      setStatus("Preparing glyphs…");

      const fallbackGlyph = f.charToGlyph("?");
      if (!fallbackGlyph || fallbackGlyph.unicode === undefined) {
        throw new Error("Font is missing a '?' glyph for fallback.");
      }

      const glyphBitmaps: GlyphBitmap[] = [];
      for (const cp of codepoints()) {
        const glyph = f.charToGlyph(String.fromCodePoint(cp));
        const sourceGlyph = glyph && glyph.unicode !== undefined ? glyph : fallbackGlyph;
        const measured = measureGlyph(sourceGlyph, fallbackGlyph, f);
        measured.metrics.codepoint = cp;
        glyphBitmaps.push({ ...measured, codepoint: cp });
      }

      setStatus("Packing atlas…");
      const placements = packGlyphs(glyphBitmaps);
      setGlyphCount(placements.length);

      setStatus("Compositing pages…");
      const atlas = buildAtlas(placements);

      setStatus("Saving files…");
      const savePath = await MessageService.instance.showSaveDialog({
        filters: { PNG: ["png"], "All Files": ["*"] },
        defaultFilename: "sprite-font.png"
      });

      if (!savePath) {
        setStatus("Save cancelled.");
        return;
      }

      const pngPath = savePath.toLowerCase().endsWith(".png") ? savePath : `${savePath}.png`;
      const assetPath = pngPath.replace(/\.png$/i, ".asset");
      const pngFilename = pngPath.split(/[/\\]/).pop() ?? "sprite-font.png";

      const pngData = atlas.stacked.toDataURL("image/png");
      const pngBase64 = pngData.split(",")[1];
      await MessageService.instance.writeFile(pngPath, pngBase64, "binary");

      const glyphRecord: Record<string, GlyphMetrics> = {};
      for (const glyph of placements) {
        glyphRecord[glyph.codepoint.toString()] = {
          ...glyph.metrics,
          page: glyph.page,
          x: glyph.x,
          y: glyph.y
        };
      }

      const metadata: SpriteFontAsset = {
        type: "spritefont",
        info: {
          face: fontName() ?? fontFamily() ?? "SpriteFont",
          size: fontSize(),
          style: fontStyle(),
          weight: fontWeight(),
          pages: atlas.pageCount,
          lineHeight: lineHeight(),
          baseline: baselinePx(),
          padding: padding(),
          antialias: antialias()
        },
        image: pngFilename,
        glyphs: glyphRecord,
        pages: { width: PAGE_SIZE, height: PAGE_SIZE * atlas.pageCount }
      };

      await MessageService.instance.writeFile(assetPath, JSON.stringify(metadata, null, 2), "text");

      MessageService.instance.showNotification("info", `Saved spritesheet to ${pngPath} and metadata to ${assetPath}`);
      setStatus(`Exported ${placements.length} glyphs over ${atlas.pageCount} pages.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export failed";
      MessageService.instance.showNotification("error", message);
      setStatus(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="sprite-font">
      <style nonce={props.nonce}>{styles}</style>
      <div class="header">
        <div>
          <h1>Sprite Font Generator</h1>
          <p>{status()}</p>
        </div>
        <button class="primary" onClick={pickFont} disabled={busy()}>
          {fontName() ? "Change Font" : "Select Font"}
        </button>
      </div>

      <div class="panel">
        <div class="row">
          <label>Font</label>
          <div class="value">{fontName() ?? "No font loaded"}</div>
        </div>
        <div class="row">
          <label>Size</label>
          <input
            type="number"
            min="8"
            max="128"
            value={fontSize()}
            onInput={(e) => setFontSize(parseInt(e.currentTarget.value, 10) || fontSize())}
          />
        </div>
        <div class="row">
          <label>Style</label>
          <div class="control-group">
            <select value={fontStyle()} onChange={(e) => setFontStyle(e.currentTarget.value as FontStyle)}>
              <option value="normal">Normal</option>
              <option value="italic">Italic</option>
            </select>
            <select value={fontWeight()} onChange={(e) => setFontWeight(e.currentTarget.value as FontWeight)}>
              <option value="normal">Normal</option>
              <option value="bold">Bold</option>
            </select>
          </div>
        </div>
        <div class="row">
          <label>Padding</label>
          <input
            type="number"
            min="0"
            max="8"
            value={padding()}
            onInput={(e) => setPadding(parseInt(e.currentTarget.value, 10) || padding())}
          />
        </div>
        <div class="row">
          <label>Kerning</label>
          <label class="checkbox">
            <input
              type="checkbox"
              checked={includeKerning()}
              onChange={(e) => setIncludeKerning(e.currentTarget.checked)}
            />
            Include kerning pairs
          </label>
        </div>
        <div class="row">
          <label>Anti-aliasing</label>
          <label class="checkbox">
            <input
              type="checkbox"
              checked={antialias()}
              onChange={(e) => setAntialias(e.currentTarget.checked)}
            />
            Smooth edges (disable for crisp pixels)
          </label>
        </div>
        <div class="row">
          <label>Codepoint Presets</label>
          <div class="preset-grid">
            <For each={OPTIONAL_PRESETS}>
              {(preset) => (
                <label class="checkbox">
                  <input
                    type="checkbox"
                    checked={optionalPresets().has(preset)}
                    onChange={() => toggleOptionalPreset(preset)}
                  />
                  {presetDefinitions[preset].label}
                </label>
              )}
            </For>
            <div class="required">
              Always included: Digits, Uppercase, Lowercase, Whitespace
            </div>
          </div>
        </div>
        <div class="row">
          <label>Custom Ranges</label>
          <input
            type="text"
            placeholder="e.g. 0x400-0x4FF, 8211"
            value={customRanges()}
            onInput={(e) => setCustomRanges(e.currentTarget.value)}
          />
        </div>
        <div class="row stats">
          <div>Codepoints: {codepoints().length}</div>
          <div>Glyphs: {glyphCount()}</div>
          <div>Pages: {pageCount()}</div>
          <div>Line Height: {lineHeight()}px</div>
        </div>
        <div class="actions">
          <button class="primary" disabled={!font() || busy()} onClick={generatePreview}>
            Refresh Preview
          </button>
          <button class="primary" disabled={!font() || busy()} onClick={exportSpriteFont}>
            {busy() ? "Working…" : "Save Spritefont"}
          </button>
        </div>
        <Show when={fontPath()}>
          <div class="footnote">Source font: {fontPath()}</div>
        </Show>
      </div>

      <Show when={previewCanvas()}>
        <div class="preview-panel">
          <div class="preview-label">Preview (2x zoom, pixelated)</div>
          <canvas
            class="preview-canvas"
            ref={(el) => {
              previewTarget = el;
            }}
          />
        </div>
      </Show>
    </div>
  );
};

export const spriteFontPlugin: WebviewAssetPlugin<SpriteFontValue> = {
  metadata: {
    type: "sprite-font",
    title: "Sprite Font Generator",
    description: "Rasterize fonts into packed spritesheets"
  },
  Component: SpriteFontToolComponent
};
