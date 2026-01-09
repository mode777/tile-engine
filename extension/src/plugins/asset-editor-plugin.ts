import * as vscode from "vscode";
import { PluginMetadata } from "../protocol/messages";

export interface AssetData {
  type: string;
  [key: string]: unknown;
}

export interface AssetEditorPluginDescriptor extends PluginMetadata {
  mode: "editor";
}

export interface AssetEditorPlugin<T extends AssetData = AssetData> {
  readonly metadata: AssetEditorPluginDescriptor;
  readonly createDefault: () => T;
}

export interface StandaloneToolPluginDescriptor extends PluginMetadata {
  mode: "tool";
  /** Command ID following pattern: tile-engine.tools.<name> */
  commandId: string;
  /** Title displayed in command palette with "Tile Engine: " prefix */
  title: string;
}

export interface StandaloneToolPlugin {
  readonly metadata: StandaloneToolPluginDescriptor;
  /** Optional lifecycle hook called when the tool panel is opened */
  readonly onOpen?: () => void | Promise<void>;
  /** Optional lifecycle hook called when the tool panel is closed */
  readonly onClose?: () => void | Promise<void>;
}

export interface HeadlessToolDescriptor extends PluginMetadata {
  mode: "headless";
  /** Command ID following pattern: tile-engine.tools.<name> */
  commandId: string;
  /** Title displayed in command palette with "Tile Engine: " prefix */
  title: string;
}

export interface HeadlessTool {
  readonly metadata: HeadlessToolDescriptor;
  /** Execute the headless tool without a webview */
  readonly execute: (context: vscode.ExtensionContext) => Promise<void>;
}

export type Plugin = AssetEditorPlugin | StandaloneToolPlugin | HeadlessTool;
