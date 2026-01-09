import { createSignal, onMount, createEffect, Show, type Component } from "solid-js";
import type { SpriteFontAsset as BaseSpriteFont } from "@common/sprite-font";
import { layoutText } from "@common/sprite-font-layout";
import type { PluginComponentProps, WebviewAssetPlugin } from "../registry";
import { readImage } from "../../file-utils";
import type { AssetJson } from "@protocol/messages";

// Add index signature to satisfy AssetJson constraint
type SpriteFontAsset = BaseSpriteFont & { [key: string]: unknown };

const SpriteFontPreviewComponent: Component<PluginComponentProps<SpriteFontAsset>> = (props) => {
  const [atlasImg, setAtlasImg] = createSignal<HTMLImageElement | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [loadError, setLoadError] = createSignal<string | null>(null);
  const [inputText, setInputText] = createSignal("The quick brown fox jumps over the lazy dog.\n0123456789");
  const [scale, setScale] = createSignal(2);
  const [tintColor, setTintColor] = createSignal("#ffffff");
  // Track canvas reactively so first draw happens when it mounts
  const [canvasEl, setCanvasEl] = createSignal<HTMLCanvasElement | null>(null);
  const LAYOUT_MAX_WIDTH = 600;

  onMount(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const imgDataUrl = await readImage(props.value.image);
      
      const imgElement = new Image();
      imgElement.onload = () => {
        setAtlasImg(imgElement);
        setIsLoading(false);
      };
      imgElement.onerror = () => {
        setLoadError("Failed to load sprite atlas image");
        setIsLoading(false);
      };
      imgElement.src = imgDataUrl;
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load image");
      setIsLoading(false);
    }
  });

  createEffect(() => {
    const img = atlasImg();
    const canvas = canvasEl();
    const txt = inputText();
    const color = tintColor();
    // Also track loading state to re-run when it flips
    const loading = isLoading();
    if (!img || !canvas || loading) return;
    drawTextPreview(canvas, img, txt, color);
  });

  const drawTextPreview = (
    canvas: HTMLCanvasElement,
    atlasImage: HTMLImageElement,
    text: string,
    colorHex: string
  ) => {
    const fontAsset = props.value;
    const lines = layoutText(text, LAYOUT_MAX_WIDTH, fontAsset);
    
    // Determine canvas size
    const widest = lines.reduce((max, ln) => Math.max(max, ln.width), 1);
    const totalH = lines.reduce((sum, ln) => sum + ln.height, 0);
    
    canvas.width = widest;
    canvas.height = totalH || fontAsset.info.lineHeight;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    // Render each line
    let yPos = 0;
    for (const ln of lines) {
      for (const gl of ln.glyphs) {
        const m = gl.metrics;
        
        // Source rect in atlas (vertically stacked pages)
        const pageYOffset = m.page * fontAsset.pages.height;
        const srcX = m.x;
        const srcY = pageYOffset + m.y;
        
        // Destination position
        const dstX = gl.x + m.xOffset;
        const dstY = yPos + fontAsset.info.baseline + m.yOffset;
        
        ctx.drawImage(
          atlasImage,
          srcX, srcY, m.width, m.height,
          dstX, dstY, m.width, m.height
        );
      }
      yPos += ln.height;
    }
    // Tint pass: multiply selected color using destination alpha mask
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";
  };


  return (
    <div class="spritefont-preview">
      <style nonce={props.nonce}>{styles}</style>
      
      <Show when={loadError()}>
        <div class="error-box">{loadError()}</div>
      </Show>
      
      <Show when={isLoading()}>
        <div class="loading-box">Loading sprite atlas...</div>
      </Show>
      
      <Show when={!isLoading() && !loadError()}>
        <div class="controls-panel">
          <div class="control-row">
            <label>
              Preview Text:
              <textarea
                value={inputText()}
                onInput={(e) => setInputText(e.currentTarget.value)}
                rows={4}
                placeholder="Type text to preview..."
              />
            </label>
          </div>
          
          <div class="control-row">
            <label>
              Zoom: {scale()}x
              <input
                type="range"
                min="1"
                max="8"
                step="1"
                value={scale()}
                onInput={(e) => setScale(parseInt(e.currentTarget.value))}
              />
            </label>
            
            <label>
              Color:
              <input
                type="color"
                value={tintColor()}
                onInput={(e) => setTintColor(e.currentTarget.value)}
              />
            </label>
          </div>
        </div>
        
        <div class="preview-panel">
          <div
            class="canvas-wrapper"
            style={{
              transform: `scale(${scale()})`,
              "transform-origin": "top left"
            }}
          >
            <canvas
              ref={(el) => setCanvasEl(el)}
              style={{
                "image-rendering": "pixelated"
              }}
            />
          </div>
        </div>
        
        <div class="info-panel">
          <div class="info-item">
            <strong>Font:</strong> {props.value.info.face}
          </div>
          <div class="info-item">
            <strong>Size:</strong> {props.value.info.size}px
          </div>
          <div class="info-item">
            <strong>Glyphs:</strong> {Object.keys(props.value.glyphs).length}
          </div>
          <div class="info-item">
            <strong>Pages:</strong> {props.value.info.pages}
          </div>
        </div>
      </Show>
    </div>
  );
};

const styles = `
.spritefont-preview {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 800px;
  color: var(--vscode-editor-foreground);
}

.error-box, .loading-box {
  padding: 1rem;
  border-radius: 6px;
  background: var(--vscode-inputValidation-errorBackground);
  border: 1px solid var(--vscode-inputValidation-errorBorder);
  color: var(--vscode-inputValidation-errorForeground);
}

.loading-box {
  background: var(--vscode-inputValidation-infoBackground);
  border-color: var(--vscode-inputValidation-infoBorder);
  color: var(--vscode-inputValidation-infoForeground);
}

.controls-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: var(--vscode-editorWidget-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
}

.control-row {
  display: flex;
  gap: 2rem;
  align-items: flex-start;
}

.control-row label {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
}

.control-row textarea {
  width: 100%;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
  padding: 0.5rem;
  border-radius: 4px;
  font-family: inherit;
  resize: vertical;
}

.control-row input[type="range"] {
  width: 100%;
}

.control-row input[type="color"] {
  width: 60px;
  height: 32px;
  border: 1px solid var(--vscode-input-border);
  border-radius: 4px;
  cursor: pointer;
}

.preview-panel {
  padding: 1rem;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  overflow: auto;
  min-height: 200px;
}

.canvas-wrapper {
  display: inline-block;
}

.info-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  padding: 1rem;
  background: var(--vscode-editorWidget-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  font-size: 0.9rem;
}

.info-item {
  display: flex;
  gap: 0.5rem;
}

.info-item strong {
  color: var(--vscode-descriptionForeground);
}
`;

export const spriteFontPreviewPlugin: WebviewAssetPlugin<SpriteFontAsset> = {
  metadata: {
    type: "spritefont",
    title: "Sprite Font Preview",
    readonly: true
  },
  Component: SpriteFontPreviewComponent
};
