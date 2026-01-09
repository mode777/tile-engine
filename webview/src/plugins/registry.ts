import type { Component } from "solid-js";
import type { AssetJson, PluginMetadata } from "@protocol/messages";

export interface PluginComponentProps<T extends AssetJson = AssetJson> {
  value: T;
  onChange: (next: T) => void;
  nonce: string;
}

export interface WebviewAssetPlugin<T extends AssetJson = AssetJson> {
  metadata: PluginMetadata;
  Component: Component<PluginComponentProps<T>>;
}

const editorRegistry = new Map<string, WebviewAssetPlugin>();
const toolRegistry = new Map<string, WebviewAssetPlugin>();

function register(plugin: WebviewAssetPlugin): void {
  editorRegistry.set(plugin.metadata.type, plugin);
}

function registerTool(plugin: WebviewAssetPlugin): void {
  toolRegistry.set(plugin.metadata.type, plugin);
}

function get(type: string): WebviewAssetPlugin | undefined {
  // Check editor registry first, then tool registry
  return editorRegistry.get(type) ?? toolRegistry.get(type);
}

export const resolvePlugin = { register, registerTool, get };
