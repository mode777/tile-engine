import * as vscode from "vscode";
import { AssetData } from "../plugin-system/types";
import { isAssetJson } from "../protocol/messages";

export class AssetDocument implements vscode.CustomDocument {
  public static async create(
    uri: vscode.Uri,
    backupId?: string
  ): Promise<AssetDocument> {
    const dataFile = typeof backupId === "string" ? vscode.Uri.parse(backupId) : uri;
    const fileData = await AssetDocument.readFile(dataFile);
    return new AssetDocument(uri, fileData);
  }

  private static async readFile(uri: vscode.Uri): Promise<AssetData> {
    const bytes = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(bytes).toString("utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown JSON parse error";
      throw new Error(`Failed to parse JSON for ${uri.toString()}: ${message}`);
    }

    if (!isAssetJson(parsed)) {
      throw new Error(`Asset file ${uri.toString()} must be a JSON object with a string 'type' property.`);
    }

    return parsed;
  }

  private readonly _uri: vscode.Uri;
  private _data: AssetData;

  private readonly _onDidDispose = new vscode.EventEmitter<void>();
  public readonly onDidDispose = this._onDidDispose.event;

  private readonly _onDidChange = new vscode.EventEmitter<AssetData>();
  public readonly onDidChange = this._onDidChange.event;

  private constructor(uri: vscode.Uri, data: AssetData) {
    this._uri = uri;
    this._data = data;
  }

  public get uri(): vscode.Uri {
    return this._uri;
  }

  public get data(): AssetData {
    return this._data;
  }

  public update(newData: AssetData): void {
    this._data = newData;
    this._onDidChange.fire(this._data);
  }

  public async revert(): Promise<void> {
    const diskData = await AssetDocument.readFile(this._uri);
    this.update(diskData);
  }

  public async save(destination?: vscode.Uri): Promise<void> {
    const target = destination ?? this._uri;
    const contents = Buffer.from(JSON.stringify(this._data, null, 2));
    await vscode.workspace.fs.writeFile(target, contents);
  }

  public dispose(): void {
    this._onDidDispose.fire();
    this._onDidDispose.dispose();
    this._onDidChange.dispose();
  }
}
