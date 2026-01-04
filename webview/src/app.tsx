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
import { handleFileUtilsMessage, vscode } from "./file-utils";

// Ensure plugins are registered at module load time.
const registeredPlugins: WebviewAssetPlugin<AssetJson>[] = [examplePlugin as WebviewAssetPlugin<AssetJson>];
registeredPlugins.forEach((plugin) => resolvePlugin.register(plugin));

const cspNonce = (window as typeof window & { __webviewNonce__?: string })
  .__webviewNonce__ ?? "";

interface EditorState {
  content: AssetJson | null;
  plugin: PluginMetadata | null;
}

export default function App(): JSX.Element {
  const [content, setContent] = createSignal<AssetJson | null>(null);
  const [pluginMeta, setPluginMeta] = createSignal<PluginMetadata | null>(null);
  const [status, setStatus] = createSignal<string>("Waiting for host…");

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
        vscode.setState({ content: message.content, plugin: message.plugin });
        break;
      }
      case "applyContent": {
        setContent(message.content);
        setStatus("Content synchronized");
        vscode.setState({ content: message.content, plugin: pluginMeta() });
        break;
      }
      case "error": {
        setStatus(`Error: ${message.message}`);
        break;
      }
      case "fileContent":
      case "imageData": {
        // Handle file/image read responses
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
    }

    window.addEventListener("message", handleMessage as EventListener);
    vscode.postMessage({ kind: "ready" });
  });

  onCleanup(() => {
    window.removeEventListener("message", handleMessage as EventListener);
  });

  const handleChange = (next: AssetJson) => {
    setContent(next);
    vscode.setState({ content: next, plugin: pluginMeta() });
    vscode.postMessage({ kind: "contentChanged", content: next });
  };

  return (
    <div class="app">
      <header class="toolbar">
        <div>
          <strong>{pluginMeta()?.title ?? "Asset"}</strong>
          <small class="subtitle">{pluginMeta()?.description ?? status()}</small>
        </div>
        <button
          class="save"
          onClick={() => vscode.postMessage({ kind: "requestSave" })}
        >
          Save
        </button>
      </header>
      <main class="content">
        <Show when={content() && plugin()} fallback={<p>{status()}</p>}>
          {(resolvedPlugin) => {
            const PluginComponent = resolvedPlugin().Component;
            const value = content()!;
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
