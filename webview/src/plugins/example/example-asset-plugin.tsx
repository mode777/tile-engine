import type { Component } from "solid-js";
import { createSignal, Show } from "solid-js";
import type { AssetJson } from "@protocol/messages";
import type { PluginComponentProps, WebviewAssetPlugin } from "../registry";
import { readFile, readImage, pickFile } from "../../file-utils";

export type ExampleAsset = AssetJson & {
  type: "example";
  name?: string;
  value?: number;
  enabled?: boolean;
  linkedFile?: string;
  imagePath?: string;
};

const ExampleAssetComponent: Component<PluginComponentProps<ExampleAsset>> = (
  props
) => {
  const [linkedFileContent, setLinkedFileContent] = createSignal<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const current = () => ({
    type: "example",
    name: props.value.name ?? "Untitled",
    value: typeof props.value.value === "number" ? props.value.value : 0,
    enabled: props.value.enabled ?? true,
    linkedFile: props.value.linkedFile ?? undefined,
    imagePath: props.value.imagePath ?? undefined
  });

  const update = (patch: Partial<ExampleAsset>) => {
    props.onChange({ ...current(), ...patch } as ExampleAsset);
  };

  const loadLinkedFile = async () => {
    if (!current().linkedFile) return;
    setLoading(true);
    setError(null);
    try {
      const content = await readFile(current().linkedFile!);
      setLinkedFileContent(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load file");
    } finally {
      setLoading(false);
    }
  };

  const loadImage = async () => {
    if (!current().imagePath) return;
    setLoading(true);
    setError(null);
    try {
      const dataUrl = await readImage(current().imagePath!);
      setImageDataUrl(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load image");
    } finally {
      setLoading(false);
    }
  };

  const browseForFile = async () => {
    setError(null);
    try {
      const paths = await pickFile({
        openLabel: "Select File",
        filters: {
          "JSON Files": ["json"],
          "Text Files": ["txt", "md"],
          "All Files": ["*"]
        }
      });
      if (paths.length > 0) {
        update({ linkedFile: paths[0] });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pick file");
    }
  };

  const browseForImage = async () => {
    setError(null);
    try {
      const paths = await pickFile({
        openLabel: "Select Image",
        filters: {
          "Images": ["png", "jpg", "jpeg", "gif", "webp", "svg"],
          "All Files": ["*"]
        }
      });
      if (paths.length > 0) {
        update({ imagePath: paths[0] });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pick image");
    }
  };

  return (
    <div class="example-plugin">
      <label class="field">
        <span>Name</span>
        <input
          value={current().name}
          onInput={(event) => update({ name: event.currentTarget.value })}
        />
      </label>
      <label class="field">
        <span>Value</span>
        <input
          type="number"
          value={current().value}
          onInput={(event) => update({ value: Number(event.currentTarget.value) })}
        />
      </label>
      <label class="checkbox">
        <input
          type="checkbox"
          checked={current().enabled}
          onInput={(event) => update({ enabled: event.currentTarget.checked })}
        />
        <span>Enabled</span>
      </label>

      <hr />

      <label class="field">
        <span>Linked File Path (relative, e.g., "../config.json")</span>
        <div class="input-with-button">
          <input
            value={current().linkedFile ?? ""}
            placeholder="e.g., ../data.json"
            onInput={(event) => update({ linkedFile: event.currentTarget.value })}
          />
          <button onClick={browseForFile} class="browse-button">
            Browse...
          </button>
        </div>
        <button onClick={loadLinkedFile} disabled={!current().linkedFile || loading()}>
          {loading() ? "Loading..." : "Load File"}
        </button>
      </label>
      <Show when={linkedFileContent()}>
        <div class="file-content">
          <small>File contents:</small>
          <pre>{linkedFileContent()}</pre>
        </div>
      </Show>

      <hr />

      <label class="field">
        <span>Image Path (relative, e.g., "../assets/icon.png")</span>
        <div class="input-with-button">
          <input
            value={current().imagePath ?? ""}
            placeholder="e.g., ../assets/preview.png"
            onInput={(event) => update({ imagePath: event.currentTarget.value })}
          />
          <button onClick={browseForImage} class="browse-button">
            Browse...
          </button>
        </div>
        <button onClick={loadImage} disabled={!current().imagePath || loading()}>
          {loading() ? "Loading..." : "Load Image"}
        </button>
      </label>
      <Show when={imageDataUrl()}>
        <div class="image-preview">
          <small>Image preview:</small>
          <img src={imageDataUrl()!} alt="preview" />
        </div>
      </Show>

      <Show when={error()}>
        <div class="error-message">{error()}</div>
      </Show>

      <style nonce={props.nonce}>{styles}</style>
    </div>
  );
};

const styles = `
.example-plugin {
  display: grid;
  gap: 0.75rem;
  max-width: 600px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.field input[type="number"],
.field input[type="text"],
.field input {
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-input-border);
  color: var(--vscode-input-foreground);
  padding: 0.35rem 0.5rem;
  border-radius: 4px;
}
.input-with-button {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
}
.input-with-button input {
  flex: 1;
}
.browse-button {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  border: 1px solid var(--vscode-button-border, transparent);
  border-radius: 4px;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  white-space: nowrap;
}
.browse-button:hover {
  background: var(--vscode-button-secondaryHoverBackground);
}
.field button {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: 1px solid var(--vscode-button-border, transparent);
  border-radius: 4px;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  margin-top: 0.5rem;
}
.field button:hover:not(:disabled) {
  background: var(--vscode-button-hoverBackground);
}
.field button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
hr {
  border: none;
  border-top: 1px solid var(--vscode-panel-border);
  margin: 0.5rem 0;
}
.file-content {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
}
.file-content pre {
  margin: 0.5rem 0 0 0;
  overflow-x: auto;
  font-size: 0.85em;
  color: var(--vscode-editor-foreground);
}
.image-preview {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
}
.image-preview img {
  max-width: 100%;
  max-height: 300px;
  margin-top: 0.5rem;
  border-radius: 4px;
}
.error-message {
  padding: 0.5rem;
  background: color-mix(in srgb, var(--vscode-errorForeground) 20%, transparent);
  color: var(--vscode-errorForeground);
  border: 1px solid var(--vscode-errorForeground);
  border-radius: 4px;
  font-size: 0.9em;
}
`;

export const examplePlugin: WebviewAssetPlugin<ExampleAsset> = {
  metadata: {
    type: "example",
    title: "Example Asset",
    description: "Demonstration plugin with file and image reading"
  },
  Component: ExampleAssetComponent
};
