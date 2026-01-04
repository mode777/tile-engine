# Tile Engine Asset Editor

Production-ready VS Code extension that provides a custom editor for `.asset` JSON files using a compile-time plugin system and a SolidJS-powered WebView UI.

## Architecture

```
+-------------------------+        +-------------------+
| VS Code Extension Host  |        | WebView (Vite +   |
|                         |        | SolidJS)          |
|  - activation/registry  |        |                   |
|  - AssetEditorProvider  |<-----> |  message channel  |
|  - AssetDocument IO     |        |  plugin UI        |
|  - plugin metadata      |        |  state handling   |
+-------------------------+        +-------------------+
          |                                      |
          | compile-time plugins                 | compile-time plugins
          v                                      v
    extension/src/plugins                  webview/src/plugins
```

### Custom Editor Flow
- User opens `*.asset` → `AssetEditorProvider` loads JSON via `AssetDocument`.
- Provider resolves plugin by `json.type` using the compile-time registry.
- WebView is created, HTML points to built `webview/dist/main.js`.
- WebView posts `ready`; host replies with `init` (document URI, parsed content, plugin metadata).
- Plugin UI renders content, emits `contentChanged`; host marks document dirty and handles saves.
- Host pushes `applyContent` when the file is reverted/saved externally to keep UI in sync.

### Plugin Resolution
- Plugins are registered at build time; no runtime discovery.
- Host metadata registry: `extension/src/plugins/registry.ts` (throws if a type is unknown).
- WebView runtime registry: `webview/src/plugins/registry.ts` (register components on load).
- Example plugin type: `example` with default shape defined in `extension/src/plugins/example/example-asset-plugin.ts` and UI in `webview/src/plugins/example/example-asset-plugin.tsx`.

### Messaging Protocol
Defined in `extension/src/protocol/messages.ts` and shared with the WebView via Vite alias `@protocol`.
- Host → WebView: `init`, `applyContent`, `error`.
- WebView → Host: `ready`, `contentChanged`, `requestSave`.

### Adding a New Plugin
1. **Host metadata**: Create `extension/src/plugins/<YourPlugin>.ts` exporting `AssetEditorPlugin` with `metadata` and `createDefault`. Register it in `extension/src/plugins/registry.ts`.
2. **WebView UI**: Create `webview/src/plugins/<your>/Plugin.tsx` exporting `WebviewAssetPlugin` with Solid component and register it in `webview/src/plugins/registry.ts`.
3. **Data contract**: Ensure your JSON includes `{"type": "yourType"}` and any additional fields your plugin expects.
4. **Build**: Rebuild WebView (`npm run build` in `webview`) and extension (`npm run compile` in `extension`).

### File and Image Reading
Plugins can read files and images from the project relative to the currently edited document using the `file-utils` module:

```typescript
import { readFile, readImage } from "./file-utils";

// Read a text file relative to the document directory
const content = await readFile("../sibling-file.json");

// Read an image and get a data URL for display
const dataUrl = await readImage("../assets/icon.png");
```

The host automatically:
- Resolves relative paths from the document's directory
- Prevents directory traversal attacks (paths with `..` are validated)
- Converts images to base64 data URLs with proper MIME types
- Handles errors and timeouts gracefully

See `webview/src/plugins/example/example-asset-plugin.tsx` for a working example that loads and displays both files and images.

## Development
- Prereqs: Node.js 18+ and npm.
- Install deps:
  - `cd extension && npm install`
  - `cd webview && npm install`
- Build WebView: `cd webview && npm run build` (outputs to `webview/dist`).
- Build Extension: `cd extension && npm run compile` (outputs to `extension/dist`).
- Run/Debug: open the repo in VS Code and use the **Extension: Debug** configuration (F5). It runs the `build:all` task first (builds WebView then compiles the extension) and launches an Extension Development Host.

## Project Layout
- Extension host: `extension/src` (activation, custom editor provider, document IO, plugin metadata, protocol).
- WebView UI: `webview/src` (SolidJS app, plugin components, registry, message handling).
- Protocol types: `extension/src/protocol/messages.ts` (shared via Vite alias `@protocol`).

## Notes
- `.asset` files must be valid JSON with a root `type` string. Unknown types fail fast on open.
- No plugin code touches VS Code APIs; interaction is via typed message passing.
- Generated Vite build artifacts are addressed with stable filenames (`main.js`, `style.css`, chunk files under `chunks/`).
