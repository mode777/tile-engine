import * as vscode from "vscode";
import { getNonce } from "./nonce";

/**
 * Generate HTML with CSP headers for a webview.
 * @param webview The webview to generate HTML for
 * @param scriptUri The URI to the main script (should be webview-relative)
 * @param title The title to display in the HTML
 */
export function generateHtmlWithCSP(
  webview: vscode.Webview,
  scriptUri: vscode.Uri,
  title: string
): string {
  const nonce = getNonce();

  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} blob: data:`,
    `style-src 'nonce-${nonce}' 'unsafe-inline' ${webview.cspSource}`,
    `script-src 'nonce-${nonce}'`,
    `connect-src ${webview.cspSource} https://*.vscode-cdn.net`
  ].join("; ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">window.__webviewNonce__ = "${nonce}";</script>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
}
