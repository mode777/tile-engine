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

const registry = new Map<string, WebviewAssetPlugin>();

function register(plugin: WebviewAssetPlugin): void {
  registry.set(plugin.metadata.type, plugin);
}

function get(type: string): WebviewAssetPlugin | undefined {
  return registry.get(type);
}

export const resolvePlugin = { register, get };
