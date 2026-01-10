export interface AssetJson {
  type: string;
  // Additional properties are plugin-defined
  [key: string]: unknown;
}

export interface PluginMetadata {
  type: string;
  title: string;
  description?: string;
  readonly?: boolean;
}

export interface DirectoryEntry {
  name: string;
  isDirectory: boolean;
}

export type HostToWebviewMessage =
  | {
      kind: "init";
      documentUri: string;
      content: AssetJson;
      plugin: PluginMetadata;
    }
  | {
      kind: "initTool";
      plugin: PluginMetadata;
    }
  | {
      kind: "applyContent";
      content: AssetJson;
    }
  | {
      kind: "error";
      message: string;
    }
  | {
      kind: "fileContent";
      requestId: string;
      success: true;
      content: string;
    }
  | {
      kind: "fileContent";
      requestId: string;
      success: false;
      error: string;
    }
  | {
      kind: "imageData";
      requestId: string;
      success: true;
      dataUrl: string;
    }
  | {
      kind: "imageData";
      requestId: string;
      success: false;
      error: string;
    }
  | {
      kind: "filePicked";
      requestId: string;
      success: true;
      paths: string[];
    }
  | {
      kind: "filePicked";
      requestId: string;
      success: false;
      error: string;
    }
  | {
      kind: "fileWritten";
      requestId: string;
      success: true;
    }
  | {
      kind: "fileWritten";
      requestId: string;
      success: false;
      error: string;
    }
  | {
      kind: "saveDialogResult";
      requestId: string;
      success: true;
      path: string | null;
    }
  | {
      kind: "saveDialogResult";
      requestId: string;
      success: false;
      error: string;
    }
  | {
      kind: "directoryListing";
      requestId: string;
      success: true;
      entries: DirectoryEntry[];
    }
  | {
      kind: "directoryListing";
      requestId: string;
      success: false;
      error: string;
    };

export type WebviewToHostMessage =
  | { kind: "ready" }
  | {
      kind: "contentChanged";
      content: AssetJson;
    }
  | { kind: "requestSave" }
  | {
      kind: "readFile";
      requestId: string;
      filePath: string;
      encoding?: "text" | "binary";
    }
  | {
      kind: "readImage";
      requestId: string;
      filePath: string;
    }
  | {
      kind: "writeFile";
      requestId: string;
      filePath: string;
      content: string;
      encoding: "text" | "binary";
    }
  | {
      kind: "pickFile";
      requestId: string;
      options?: {
        canSelectMany?: boolean;
        openLabel?: string;
        filters?: Record<string, string[]>;
        defaultUri?: string;
      };
    }
  | {
      kind: "showSaveDialog";
      requestId: string;
      filters?: Record<string, string[]>;
      defaultUri?: string;
      defaultFilename?: string;
    }
  | {
      kind: "showNotification";
      type: "info" | "warning" | "error";
      message: string;
    }
  | {
      kind: "getDirectory";
      requestId: string;
      dirPath: string;
    };

export function isAssetJson(value: unknown): value is AssetJson {
  return Boolean(
    value &&
      typeof value === "object" &&
      "type" in (value as Record<string, unknown>) &&
      typeof (value as Record<string, unknown>).type === "string"
  );
}
