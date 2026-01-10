import type { Component } from "solid-js";
import { createSignal } from "solid-js";
import type { AssetJson } from "@protocol/messages";
import { MessageService } from "../../services/message-service";
import type { PluginComponentProps, WebviewAssetPlugin } from "../registry";

export type AssetGeneratorData = AssetJson & {
  type: "asset-generator";
};

const AssetGeneratorComponent: Component<PluginComponentProps<AssetGeneratorData>> = (
  props
) => {
  const [generating, setGenerating] = createSignal(false);

  const generateAndSaveAsset = async () => {
    setGenerating(true);
    try {
      // Generate the example asset data
      const assetData = {
        type: "example",
        name: "Generated Asset",
        value: Math.floor(Math.random() * 100),
        enabled: true
      };

      // Show save dialog
      const savePath = await MessageService.instance.showSaveDialog({
        filters: {
          "Asset Files": ["asset"],
          "JSON Files": ["json"]
        },
        defaultFilename: "generated-asset.asset"
      });

      if (!savePath) {
        // User cancelled
        MessageService.instance.showNotification("info", "Asset generation cancelled");
        return;
      }

      // Write the file
      const content = JSON.stringify(assetData, null, 2);
      await MessageService.instance.writeFile(savePath, content, "text");

      MessageService.instance.showNotification("info", `Asset saved to ${savePath}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate asset";
      MessageService.instance.showNotification("error", message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ margin: "0 0 1rem 0" }}>Asset Generator</h1>
      <p style={{ color: "var(--vscode-descriptionForeground)", "margin-bottom": "2rem" }}>
        Generate a new example asset file and save it to your workspace.
      </p>

      <button
        onClick={generateAndSaveAsset}
        disabled={generating()}
        style={{
          background: generating() 
            ? "var(--vscode-button-secondaryBackground)" 
            : "var(--vscode-button-background)",
          color: "var(--vscode-button-foreground)",
          border: "1px solid var(--vscode-button-border, transparent)",
          "border-radius": "4px",
          padding: "0.5rem 1.5rem",
          "font-size": "1rem",
          cursor: generating() ? "not-allowed" : "pointer"
        }}
      >
        {generating() ? "Generating..." : "Generate & Save Asset"}
      </button>

      <div style={{ "margin-top": "2rem", padding: "1rem", background: "var(--vscode-textCodeBlock-background)", "border-radius": "4px" }}>
        <h3 style={{ margin: "0 0 0.5rem 0", "font-size": "0.9rem" }}>Generated Asset Preview:</h3>
        <pre style={{ margin: "0", "font-size": "0.85rem", color: "var(--vscode-editor-foreground)" }}>
{`{
  "type": "example",
  "name": "Generated Asset",
  "value": <random number>,
  "enabled": true
}`}
        </pre>
      </div>
    </div>
  );
};

export const assetGeneratorPlugin: WebviewAssetPlugin<AssetGeneratorData> = {
  metadata: {
    type: "asset-generator",
    title: "Asset Generator",
    description: "Generate and save example asset files."
  },
  Component: AssetGeneratorComponent
};
