import * as vscode from "vscode";
import { normalizeRelativePath, resolveWorkspacePath, toRelativePaths } from "./path-utils";

/**
 * Abstracts path resolution strategies for different plugin contexts.
 * Allows handlers to work with workspace-relative or document-relative paths
 * without needing to know which context they're in.
 */
export interface PathContext {
  /**
   * Get the base URI from which relative paths are resolved.
   */
  getBaseUri(): vscode.Uri;

  /**
   * Resolve a path string to an absolute URI.
   */
  resolveUri(filePath: string): vscode.Uri;

  /**
   * Convert absolute URIs to relative paths from the base URI.
   */
  toRelativePaths(uris: vscode.Uri[]): string[];
}

/**
 * Workspace-relative path context.
 * Paths are resolved relative to the workspace root.
 */
export class WorkspacePathContext implements PathContext {
  constructor(private context: vscode.ExtensionContext) {}

  getBaseUri(): vscode.Uri {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error("No workspace folder open");
    }
    return workspaceFolder.uri;
  }

  resolveUri(filePath: string): vscode.Uri {
    return resolveWorkspacePath(filePath);
  }

  toRelativePaths(uris: vscode.Uri[]): string[] {
    return toRelativePaths(this.getBaseUri().fsPath, uris);
  }
}

/**
 * Document-directory-relative path context.
 * Paths are resolved relative to the document's parent directory.
 */
export class DocumentPathContext implements PathContext {
  constructor(private documentUri: vscode.Uri) {}

  getBaseUri(): vscode.Uri {
    return vscode.Uri.joinPath(this.documentUri, "..");
  }

  resolveUri(filePath: string): vscode.Uri {
    const normalized = normalizeRelativePath(filePath);
    return vscode.Uri.joinPath(this.getBaseUri(), normalized);
  }

  toRelativePaths(uris: vscode.Uri[]): string[] {
    return toRelativePaths(this.getBaseUri().fsPath, uris);
  }
}
