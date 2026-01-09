# Tile Engine Asset Editor

Production-ready VS Code extension that provides a custom editor for `.asset` JSON files and standalone tools using a compile-time plugin system and a SolidJS-powered WebView UI.

## Architecture

```
+-------------------------+        +-------------------+
| VS Code Extension Host  |        | WebView (Vite +   |
|                         |        | SolidJS)          |
|  - activation/registry  |        |                   |
|  - AssetEditorProvider  |<-----> |  message channel  |
|  - StandaloneToolProvider|       |  plugin UI        |
|  - AssetDocument IO     |        |  state handling   |
|  - plugin metadata      |        |  mode detection   |
+-------------------------+        +-------------------+
          |                                      |
          | compile-time plugins                 | compile-time plugins
          v                                      v
    extension/src/plugins                  webview/src/plugins
```

### Plugin Types

The extension now supports **two types of plugins**:

1. **Editor Plugins** (mode: `"editor"`): File-based custom editors that open and edit `.asset` files
   - Activated when opening files matching `*.asset`
   - Tied to a specific document/file
   - Support save/revert operations
   - File operations are relative to the document's directory

2. **Standalone Tools** (mode: `"tool"`): Command-triggered webviews that perform workspace-wide operations
   - Activated via Command Palette (e.g., "Tile Engine: Generate Asset")
   - Not tied to any specific file
   - Can read/write any workspace file using absolute or workspace-relative paths
   - Singleton instances (re-opening focuses existing panel)
   - Support lifecycle hooks (`onOpen`, `onClose`)

### Custom Editor Flow (Editor Plugins)
- User opens `*.asset` → `AssetEditorProvider` loads JSON via `AssetDocument`.
- Provider resolves plugin by `json.type` using the compile-time registry.
- WebView is created, HTML points to built `webview/dist/index.js`.
- WebView posts `ready`; host replies with `init` (document URI, parsed content, plugin metadata).
- Plugin UI renders content, emits `contentChanged`; host marks document dirty and handles saves.
- Host pushes `applyContent` when the file is reverted/saved externally to keep UI in sync.

### Standalone Tool Flow (Tool Plugins)
- User executes command via Command Palette (e.g., "Tile Engine: Generate Asset").
- Extension checks if tool panel is already open; if so, focuses it (singleton behavior).
- Otherwise, creates new webview panel with `StandaloneToolProvider`.
- WebView posts `ready`; host replies with `initTool` (plugin metadata only, no document).
- Tool UI renders without save button or document toolbar.
- Tool can use workspace file APIs (`readWorkspaceFile`, `writeWorkspaceFile`, `showSaveDialog`).
- Lifecycle hooks (`onOpen`, `onClose`) are invoked when panel opens/closes.

### Plugin Resolution
- Plugins are registered at build time; no runtime discovery.
- Host metadata registry: `extension/src/plugins/registry.ts`
  - Editor plugins: `getPluginDescriptor(type)`, `listPlugins()`, `hasPlugin(type)`
  - Tool plugins: `getToolPlugins()`, `getToolPlugin(type)`
- WebView runtime registry: `webview/src/plugins/registry.ts`
  - Editor plugins: `resolvePlugin.register(plugin)`
  - Tool plugins: `resolvePlugin.registerTool(plugin)`
  - Lookup: `resolvePlugin.get(type)` (checks both registries)
- Example editor plugin: type `"example"` defined in `extension/src/plugins/example/example-asset-plugin.ts` and UI in `webview/src/plugins/example/example-asset-plugin.tsx`.
- Example tool plugin: type `"asset-generator"` defined in `extension/src/plugins/example/asset-generator-tool.ts` and UI in `webview/src/plugins/example/asset-generator-tool.tsx`.

### Messaging Protocol
Defined in `extension/src/protocol/messages.ts` and shared with the WebView via Vite alias `@protocol`.

**Host → WebView:**
- `init`: Initialize editor with document content and plugin metadata
- `initTool`: Initialize standalone tool with plugin metadata (no document)
- `applyContent`: Sync external changes to editor content
- `error`: Display error message
- `fileContent`, `imageData`, `filePicked`: File operation responses (editor mode)
- `workspaceFileContent`, `workspaceFileWritten`: Workspace file operation responses (tool mode)
- `saveDialogResult`: Save dialog result (tool mode)

**WebView → Host:**
- `ready`: Webview initialized and ready
- `contentChanged`: User edited content (editor mode)
- `requestSave`: Request explicit save (editor mode)
- `readFile`, `readImage`, `pickFile`: File operations relative to document (editor mode)
- `readWorkspaceFile`, `writeWorkspaceFile`: Workspace-wide file operations (tool mode)
- `showSaveDialog`: Show native save dialog with filters (tool mode)
- `showNotification`: Display VS Code notification toast (tool mode)

### Adding a New Editor Plugin
1. **Host metadata**: Create `extension/src/plugins/<YourPlugin>.ts` exporting `AssetEditorPlugin` with:
   ```typescript
   export const yourPlugin: AssetEditorPlugin<YourAsset> = {
     metadata: {
       mode: "editor",
       type: "your-type",
       title: "Your Asset",
       description: "Description of your asset type"
     },
     createDefault: () => ({ type: "your-type", /* ... */ })
   };
   ```
   Register it in `extension/src/plugins/registry.ts` in the `editorPlugins` array.

2. **WebView UI**: Create `webview/src/plugins/<your>/your-plugin.tsx` exporting `WebviewAssetPlugin` with Solid component:
   ```tsx
   export const yourPlugin: WebviewAssetPlugin<YourAsset> = {
3. **Data contract**: Ensure your JSON includes `{"type": "your-type"}` and any additional fields.
4. **Build**: Rebuild WebView (`npm run build` in `webview`) and extension (`npm run compile` in `extension`).
 1. **Editor Plugins** (mode: `"editor"`): File-based custom editors that open and edit `.asset` files
    - Activated when opening files matching `*.asset`
    - Tied to a specific document/file
    - Support save/revert operations
    - File operations are relative to the document's directory
 
 2. **Standalone Tools** (mode: `"tool"`): Command-triggered webviews that perform workspace-wide operations
    - Activated via Command Palette (e.g., "Tile Engine: Generate Asset")
    - Not tied to any specific file
    - Can read/write any workspace file using absolute or workspace-relative paths
    - Singleton instances (re-opening focuses existing panel)
    - Support lifecycle hooks (`onOpen`, `onClose`)
 
 3. **Headless Tools** (mode: `"headless"`): Command-triggered tools without a webview UI
    - Activated via Command Palette (e.g., "Tile Engine: Create Tileset")
    - Execute logic directly without displaying a UI panel
    - Can prompt for input/output using VS Code's native dialogs (`showSaveDialog`, `showInputBox`, etc.)
    - Useful for simple file generation, batch operations, or quick workflows
    - Execute synchronously without state management
 
 ### Custom Editor Flow (Editor Plugins)

### Adding a New Standalone Tool
1. **Host metadata**: Create `extension/src/plugins/tools/<your-tool>.ts` exporting `StandaloneToolPlugin`:
     metadata: {
       mode: "tool",
 - Headless tools: `getHeadlessTools()`, `getHeadlessTool(type)`
       commandId: "tile-engine.tools.yourTool", // Must start with "tile-engine.tools."
       title: "Your Tool Name",
       description: "Description of your tool"
     },
     onOpen: async () => { /* Optional initialization */ },
     onClose: () => { /* Optional cleanup */ }
   };
   ```
   Register it in `extension/src/plugins/registry.ts` in the `toolPlugins` array.

2. **WebView UI**: Create `webview/src/plugins/tools/<your-tool>.tsx` exporting `WebviewAssetPlugin`:
   ```tsx
   export const yourToolPlugin: WebviewAssetPlugin<YourToolData> = {
     metadata: { type: "your-tool", title: "Your Tool Name" },
     Component: YourToolComponent
   };
   ```
   Register it in `webview/src/plugins/registry.ts` in the `registeredToolPlugins` array.

3. **Command registration**: Add the command to `extension/package.json`:
   ```json
   {
     "contributes": {
       "commands": [
         {
           "command": "tile-engine.tools.yourTool",
           "title": "Tile Engine: Your Tool Name"
         }
       ]
     }
   }
   ```

4. **Build**: Rebuild WebView and extension as above.
### Adding a New Headless Tool
1. **Host metadata**: Create `extension/src/plugins/tools/<your-tool>.ts` exporting `HeadlessTool`:
   ```typescript
   import * as vscode from "vscode";
   import { HeadlessTool } from "../asset-editor-plugin";

   export const yourTool: HeadlessTool = {
     metadata: {
       mode: "headless",
       type: "your-tool",
       commandId: "tile-engine.tools.yourTool", // Must start with "tile-engine.tools."
       title: "Your Tool Name",
       description: "Description of your tool"
     },
     execute: async (context: vscode.ExtensionContext) => {
       // Execute tool logic directly
       // Use VS Code APIs: vscode.window.showSaveDialog(), vscode.window.showInputBox(), etc.
       const userInput = await vscode.window.showInputBox({ prompt: "Enter value:" });
       if (userInput) {
         // Perform operations...
         vscode.window.showInformationMessage(`Done: ${userInput}`);
       }
     }
   };
   ```
   Register it in `extension/src/plugins/registry.ts` in the `headlessTools` array.

2. **Command registration**: Add the command to `extension/package.json`:
   ```json
   {
     "contributes": {
       "commands": [
         {
           "command": "tile-engine.tools.yourTool",
           "title": "Tile Engine: Your Tool Name"
         }
       ]
     }
   }
   ```

3. **Build**: Rebuild the extension (`npm run compile` in `extension`). No webview build is needed.


### File and Image Reading (Editor Mode)
Editor plugins can read files and images relative to the currently edited document using the `file-utils` module:

```typescript
import { readFile, readImage, pickFile } from "./file-utils";

// Read a text file relative to the document directory
const content = await readFile("../sibling-file.json");

// Read an image and get a data URL for display
const dataUrl = await readImage("../assets/icon.png");

// Show VS Code's native file picker
const paths = await pickFile({
  canSelectMany: false,
  openLabel: "Select File",
  filters: {
    'Images': ['png', 'jpg', 'jpeg'],
    'All Files': ['*']
  }
});
// Returns array of paths relative to the document directory
```

**Path Requirements:** All file operations use relative paths (starting from the document's directory) to ensure portability of asset files across different machines and operating systems.

### Workspace File Operations (Tool Mode)
Standalone tools can read and write files anywhere in the workspace using absolute or workspace-relative paths:

```typescript
import { 
  readWorkspaceFile, 
  writeWorkspaceFile, 
  showSaveDialog,
  showNotification 
} from "./file-utils";

// Read a workspace file (text)
const content = await readWorkspaceFile("assets/data.json", "text");

// Read a binary file (returns Base64 string)
const binaryData = await readWorkspaceFile("images/icon.png", "binary");

// Write a workspace file (text)
await writeWorkspaceFile("output/result.json", JSON.stringify(data), "text");

// Write a binary file (Base64 string)
await writeWorkspaceFile("output/image.png", base64Data, "binary");

// Show save dialog
const savePath = await showSaveDialog({
  filters: {
    'Asset Files': ['asset'],
    'JSON Files': ['json']
  },
  defaultFilename: "generated-asset.asset"
});

if (savePath) {
  await writeWorkspaceFile(savePath, content, "text");
  showNotification("info", `File saved to ${savePath}`);
}
```

**Path Requirements:**
- Paths can be absolute (e.g., `/Users/name/project/file.json`) or workspace-relative (e.g., `assets/data.json`)
- Workspace-relative paths are resolved from the first workspace folder
- Binary content is transferred as Base64 strings for JSON serialization

**Save Dialog Options:**
- `filters`: File type filters, e.g., `{ 'Images': ['png', 'jpg'], 'All Files': ['*'] }`
- `defaultUri`: Default directory to open (absolute or workspace-relative)
- `defaultFilename`: Suggested filename

**Notifications:**
- `showNotification(type, message)`: Display VS Code toast notification
- Types: `"info"`, `"warning"`, `"error"`

See `webview/src/plugins/example/asset-generator-tool.tsx` for a complete example.

## Documentation

Resource guides for asset types and tools:

- [Sprite Font Resource](docs/spritefont.md) — Generate bitmap spritesheets from TrueType/OpenType fonts
  - How to access and use the sprite font generator tool
  - Asset format reference and field documentation
  - Tips for font selection, packing, and performance
  - Example code for consuming sprite fonts in games/applications

More resource documentation will be added as new asset types are implemented.

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
