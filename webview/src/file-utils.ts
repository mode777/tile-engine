import type { HostToWebviewMessage } from "@protocol/messages";

declare function acquireVsCodeApi<TState = unknown>(): {
  postMessage: (message: unknown) => void;
  getState(): TState | undefined;
  setState(data: TState): void;
};

export const vscode = acquireVsCodeApi();

let requestIdCounter = 0;
const pendingRequests = new Map<
  string,
  {
    resolve: (value: string) => void;
    reject: (reason?: unknown) => void;
  }
>();

/**
 * Read a text file relative to the currently edited document.
 * @param relativePath Path relative to the document directory (e.g., "../sibling.json")
 * @returns The file contents as a string
 */
export function readFile(relativePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const requestId = String(requestIdCounter++);
    pendingRequests.set(requestId, { resolve, reject });

    vscode.postMessage({
      kind: "readFile",
      requestId,
      relativePath
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error(`Timeout reading file: ${relativePath}`));
      }
    }, 10000);
  });
}

/**
 * Read an image file relative to the currently edited document.
 * @param relativePath Path relative to the document directory (e.g., "../assets/icon.png")
 * @returns A data URL that can be used as an image src
 */
export function readImage(relativePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const requestId = String(requestIdCounter++);
    pendingRequests.set(requestId, { resolve, reject });

    vscode.postMessage({
      kind: "readImage",
      requestId,
      relativePath
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error(`Timeout reading image: ${relativePath}`));
      }
    }, 10000);
  });
}

/**
 * Handle responses from the host for file/image read requests.
 * Call this in your message handler.
 */
export function handleFileUtilsMessage(message: HostToWebviewMessage): void {
  if (message.kind === "fileContent") {
    const pending = pendingRequests.get(message.requestId);
    if (pending) {
      pendingRequests.delete(message.requestId);
      if (message.success) {
        pending.resolve(message.content);
      } else {
        pending.reject(new Error(message.error));
      }
    }
  } else if (message.kind === "imageData") {
    const pending = pendingRequests.get(message.requestId);
    if (pending) {
      pendingRequests.delete(message.requestId);
      if (message.success) {
        pending.resolve(message.dataUrl);
      } else {
        pending.reject(new Error(message.error));
      }
    }
  }
}
