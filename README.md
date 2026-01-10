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

### Plugin System

The extension uses a **compile-time plugin registry** with three plugin types: Editor Plugins, Standalone Tools, and Headless Tools. All plugins are registered explicitly in `extension/src/plugin-system/plugin-registry-setup.ts` at compile-time.

**→ See [Authoring Plugins](docs/authoring-plugins.md)** for complete documentation on plugin architecture, lifecycle, development workflow, and step-by-step examples for each plugin type.

### Messaging Protocol

Webview-to-host communication is handled via `MessageService`, a singleton that provides async request-response patterns with automatic timeout management.

**→ See [MessageService API Documentation](docs/message-service-api.md)** for complete API reference, all available operations, error handling, and path handling details (document-relative for editors, workspace-relative for tools).

**Quick example:**
```typescript
import { MessageService } from "./services/message-service";

// Read a file (relative to document in editor, workspace in tool)
const content = await MessageService.instance.readFile("data.json");

// Write a file
await MessageService.instance.writeFile("output.json", jsonString);

// Show file picker
const files = await MessageService.instance.pickFile({ canSelectMany: true });

// Show notification
MessageService.instance.showNotification("info", "Operation complete");
```

## Documentation

Comprehensive guides and API references:

- **[Authoring Plugins](docs/authoring-plugins.md)** — Complete plugin development guide
  - Plugin types (Editor, Standalone Tool, Headless Tool)
  - Plugin lifecycle and flows
  - Step-by-step guides for creating each plugin type
  - Best practices and troubleshooting

- **[MessageService API](docs/message-service-api.md)** — Webview-to-host communication
  - File operations (read, write, image handling)
  - Dialog operations (file picker, save dialog)
  - Directory listing
  - Notifications and lifecycle events
  - Error handling and timeout management

- **[Sprite Font Resource](docs/spritefont.md)** — Bitmap font generation
  - How to access and use the sprite font generator
  - Asset format reference
  - Tips for font selection and packing
  - Example code for consuming sprites

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
