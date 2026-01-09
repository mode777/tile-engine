import { createMemo, createSignal, onCleanup, onMount, Show } from "solid-js";
import type { JSX } from "solid-js";
import type {
  AssetJson,
  HostToWebviewMessage,
  PluginMetadata,
  WebviewToHostMessage
} from "@protocol/messages";
import { resolvePlugin, type WebviewAssetPlugin } from "./plugins/registry";
import { examplePlugin } from "./plugins/example/example-asset-plugin";
import { assetGeneratorPlugin } from "./plugins/example/asset-generator-tool";
import { spriteFontPlugin } from "./plugins/sprite-font/sprite-font-tool";
import { spriteFontPreviewPlugin } from "./plugins/sprite-font/sprite-font-preview";
import { handleFileUtilsMessage, vscode } from "./file-utils";

// Ensure plugins are registered at module load time.
const registeredEditorPlugins: WebviewAssetPlugin<AssetJson>[] = [
  examplePlugin as WebviewAssetPlugin<AssetJson>,
  spriteFontPreviewPlugin as unknown as WebviewAssetPlugin<AssetJson>
];
registeredEditorPlugins.forEach((plugin) => resolvePlugin.register(plugin));

const registeredToolPlugins: WebviewAssetPlugin<AssetJson>[] = [
  assetGeneratorPlugin as WebviewAssetPlugin<AssetJson>,
  spriteFontPlugin as WebviewAssetPlugin<AssetJson>
];
registeredToolPlugins.forEach((plugin) => resolvePlugin.registerTool(plugin));

const cspNonce = (window as typeof window & { __webviewNonce__?: string })
  .__webviewNonce__ ?? "";

interface EditorState {
  content: AssetJson | null;
  plugin: PluginMetadata | null;
  mode: "editor" | "tool";
}

export default function App(): JSX.Element {
  const [content, setContent] = createSignal<AssetJson | null>(null);
  const [pluginMeta, setPluginMeta] = createSignal<PluginMetadata | null>(null);
  const [status, setStatus] = createSignal<string>("Waiting for host…");
  const [mode, setMode] = createSignal<"editor" | "tool">("editor");

  const plugin = createMemo(() => {
    const meta = pluginMeta();
    if (!meta) return undefined;
    return resolvePlugin.get(meta.type);
  });

  const handleMessage = (event: MessageEvent<HostToWebviewMessage>) => {
    const message = event.data;
    switch (message.kind) {
      case "init": {
        setContent(message.content);
        setPluginMeta(message.plugin);
        setStatus("Editing asset");
        setMode("editor");
        vscode.setState({ content: message.content, plugin: message.plugin, mode: "editor" });
        break;
      }
      case "initTool": {
        setPluginMeta(message.plugin);
        setStatus("Tool ready");
        setMode("tool");
        vscode.setState({ content: null, plugin: message.plugin, mode: "tool" });
        break;
      }
      case "applyContent": {
        setContent(message.content);
        setStatus("Content synchronized");
        vscode.setState({ content: message.content, plugin: pluginMeta(), mode: mode() });
        break;
      }
      case "error": {
        setStatus(`Error: ${message.message}`);
        break;
      }
      case "fileContent":
      case "imageData":
      case "filePicked":
      case "workspaceFileContent":
      case "workspaceFileWritten":
      case "saveDialogResult": {
        // Handle file/image read responses and file picker results
        handleFileUtilsMessage(message);
        break;
      }
      default:
        break;
    }
  };

  onMount(() => {
    const cached = vscode.getState() as EditorState | undefined;
    if (cached?.content) {
      setContent(cached.content);
      setPluginMeta(cached.plugin ?? null);
      setMode(cached.mode ?? "editor");
    }

    window.addEventListener("message", handleMessage as EventListener);
    vscode.postMessage({ kind: "ready" });
  });

  onCleanup(() => {
    window.removeEventListener("message", handleMessage as EventListener);
  });

  const handleChange = (next: AssetJson) => {
    setContent(next);
    vscode.setState({ content: next, plugin: pluginMeta(), mode: mode() });
    vscode.postMessage({ kind: "contentChanged", content: next });
  };

  return (
    <div class="app">
      <Show when={mode() === "editor"}>
        <header class="toolbar">
          <div>
            <strong>{pluginMeta()?.title ?? "Asset"}</strong>
            <small class="subtitle">{pluginMeta()?.description ?? status()}</small>
          </div>
          <Show when={!pluginMeta()?.readonly}>
            <button
              class="save"
              onClick={() => vscode.postMessage({ kind: "requestSave" })}
            >
              Save
            </button>
          </Show>
        </header>
      </Show>
      <main class="content">
        <Show when={(mode() === "editor" && content() && plugin()) || (mode() === "tool" && plugin())} fallback={<p>{status()}</p>}>
          {(resolvedPlugin) => {
            const PluginComponent = resolvedPlugin().Component;
            const value = mode() === "editor" ? content()! : { type: pluginMeta()?.type ?? "" };
            return (
              <PluginComponent
                value={value}
                nonce={cspNonce}
                onChange={handleChange}
              />
            );
          }}
        </Show>
      </main>
      <style nonce={cspNonce}>{baseStyles}</style>
    </div>
  );
}

const baseStyles = `
:root {
  color-scheme: light dark;
  font-family: Inter, system-ui, -apple-system, sans-serif;
}
body, .app {
  margin: 0;
  padding: 0;
  background: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--vscode-panel-border);
}
.toolbar .subtitle {
  display: block;
  color: var(--vscode-descriptionForeground);
  margin-top: 0.25rem;
}
.content {
  padding: 1rem;
}
button.save {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: 1px solid var(--vscode-button-border, transparent);
  border-radius: 4px;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
}
button.save:hover {
  background: var(--vscode-button-hoverBackground);
}
`; 
