import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [solidPlugin()],
  resolve: {
    alias: {
      "@protocol": path.resolve(__dirname, "../extension/src/protocol")
    }
  },
  build: {
    // Emit build output where the extension can load it via extensionUri/webview/dist
    outDir: "../extension/webview/dist",
    // Inline sourcemaps to avoid CSP/network fetch issues in VS Code webviews
    sourcemap: "inline",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "index.html"),
      output: {
        entryFileNames: "main.js",
        chunkFileNames: "chunks/[name].js",
        assetFileNames: "assets/[name][extname]"
      }
    }
  }
});
