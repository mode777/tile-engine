/**
 * Generate a cryptographically random nonce for CSP headers.
 * Used to allow inline scripts while maintaining security.
 */
export function getNonce(): string {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 32 })
    .map(() => possible.charAt(Math.floor(Math.random() * possible.length)))
    .join("");
}
