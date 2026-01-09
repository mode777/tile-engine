import * as path from "path";
import * as vscode from "vscode";

/**
 * Normalize and validate a relative path.
 * Ensures the path is relative (not absolute) for portability.
 * @throws Error if path is absolute
 */
export function normalizeRelativePath(relativePath: string): string {
  const normalized = path.normalize(relativePath);
  if (path.isAbsolute(normalized)) {
    throw new Error("Invalid path: must use relative paths for portability");
  }
  return normalized;
}

/**
 * Convert absolute URIs to relative paths from a base directory.
 * Normalizes to forward slashes for consistency.
 */
export function toRelativePaths(baseDir: string, uris: vscode.Uri[]): string[] {
  return uris.map(uri => {
    const relative = path.relative(baseDir, uri.fsPath);
    // Normalize to forward slashes for consistency
    return relative.replace(/\\/g, "/");
  });
}

/**
 * Resolve a workspace-relative path to an absolute URI.
 * If the path is already absolute, use it directly.
 * @throws Error if no workspace folder is open
 */
export function resolveWorkspacePath(filePath: string): vscode.Uri {
  if (path.isAbsolute(filePath)) {
    return vscode.Uri.file(filePath);
  }

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    throw new Error("No workspace folder open");
  }

  return vscode.Uri.joinPath(workspaceFolder.uri, filePath);
}
