# Authoring Plugins

This guide covers how to create and register plugins for the Tile Engine Asset Editor. The extension supports three plugin types: Editor Plugins, Standalone Tools, and Headless Tools.

## Plugin Types Overview

### 1. Editor Plugins (mode: `"editor"`)
File-based custom editors that open and edit `.asset` files.

**Characteristics:**
- Activated when opening files matching `*.asset`
- Tied to a specific document/file
- Support save/revert operations
- File operations are relative to the document's directory
- Appear as a custom editor tab in VS Code

**Use case:** Creating custom visual editors for specific asset types (sprites, tilesets, configurations, etc.)

---

### 2. Standalone Tools (mode: `"tool"`)
Command-triggered webviews that perform workspace-wide operations.

**Characteristics:**
- Activated via Command Palette (e.g., "Tile Engine: Generate Asset")
- Not tied to any specific file
- Can read/write any workspace file using absolute or workspace-relative paths
- Singleton instances (re-opening focuses existing panel)
- Support lifecycle hooks (`onOpen`, `onClose`)
- Appear as a webview panel

**Use case:** Asset generators, batch processors, utility tools that operate on workspace resources

---

### 3. Headless Tools (mode: `"headless"`)
Command-triggered operations that execute directly without a webview.

**Characteristics:**
- Activated via Command Palette
- Use native VS Code dialogs and input mechanisms
- Direct access to VS Code APIs
- No webview overhead
- Synchronous execution flow

**Use case:** Quick operations, scripts, or tools that don't need a custom UI

---

## Plugin Resolution

Plugins are registered at **compile-time** in a single location: `extension/src/plugin-system/plugin-registry-setup.ts`

**Key principles:**
- No runtime discovery; all plugins must be explicitly imported and initialized during activation
- Host registry access via `extension/src/plugin-system/registry.ts`:
  - Editor plugins: `getPluginDescriptor(type)`, `listPlugins()`, `hasPlugin(type)`, `getDefaultContentForType(type)`
  - Standalone tools: `getToolPlugins()`, `getToolPlugin(type)`
  - Headless tools: `getHeadlessTools()`, `getHeadlessTool(type)`
- WebView runtime registry: `webview/src/plugins/registry.ts`
  - Editor plugins: `resolvePlugin.register(plugin)`
  - Standalone tools: `resolvePlugin.registerTool(plugin)`
  - Lookup: `resolvePlugin.get(type)` (checks both registries)

---

## Adding an Editor Plugin

### Step 1: Create Host Metadata

Create `extension/src/plugins/<category>/<your-plugin>.ts`:

```typescript
import { AssetEditorPlugin } from "../../plugin-system/types";

export interface YourAsset {
  type: "your-type";
  // ... additional fields
}

export const yourPlugin: AssetEditorPlugin<YourAsset> = {
  metadata: {
    mode: "editor",
    type: "your-type",
    title: "Your Asset",
    description: "Description of your asset type",
    readonly: false // Optional: set to true if asset should not be editable
  },
  createDefault: () => ({ 
    type: "your-type",
    // ... default values for your asset fields
  })
};
```

### Step 2: Register Plugin

Add import and registration in `extension/src/plugin-system/plugin-registry-setup.ts`:

```typescript
import { yourPlugin } from "../plugins/<category>/<your-plugin>";

// Inside setupPluginRegistry():
const editorPlugins: AssetEditorPlugin[] = [
  // ... existing plugins
  yourPlugin
];
```

### Step 3: Create WebView UI

Create `webview/src/plugins/<category>/<your-plugin>.tsx` using SolidJS:

```tsx
import { createSignal } from "solid-js";
import { WebviewAssetPlugin } from "../registry";
import { MessageService } from "../../services/message-service";

export const yourPlugin: WebviewAssetPlugin<YourAsset> = {
  metadata: {
    type: "your-type",
    title: "Your Asset"
  },
  Component: (props) => {
    const [content, setContent] = createSignal(props.initialContent);

    const handleChange = (updated: YourAsset) => {
      setContent(updated);
      MessageService.instance.notifyContentChanged(updated);
    };

    return (
      <div>
        {/* Your UI components */}
      </div>
    );
  }
};
```

Register in `webview/src/plugins/registry.ts`:

```typescript
import { yourPlugin } from "./<category>/<your-plugin>";

const registeredPlugins: WebviewAssetPlugin[] = [
  // ... existing plugins
  yourPlugin
];
```

### Step 4: Data Contract

Ensure your `.asset` JSON files include the `type` field:

```json
{
  "type": "your-type",
  "field1": "value",
  "field2": 42
}
```

### Step 5: Build and Test

```bash
cd webview && npm run build
cd ../extension && npm run compile
```

Open VS Code with the extension loaded (F5) and create a `.asset` file with your type.

---

## Adding a Standalone Tool

### Step 1: Create Host Metadata

Create `extension/src/plugins/<category>/<your-tool>.ts`:

```typescript
import { StandaloneToolPlugin } from "../../plugin-system/types";

export const yourTool: StandaloneToolPlugin = {
  metadata: {
    mode: "tool",
    type: "your-tool",
    commandId: "tile-engine.tools.yourTool", // Must start with "tile-engine.tools."
    title: "Your Tool Name",
    description: "Description of your tool"
  },
  onOpen: async (context) => {
    // Optional: initialization when tool panel opens
    console.log("Tool opened");
  },
  onClose: () => {
    // Optional: cleanup when tool panel closes
    console.log("Tool closed");
  }
};
```

### Step 2: Register Plugin

Add import and registration in `extension/src/plugin-system/plugin-registry-setup.ts`:

```typescript
import { yourTool } from "../plugins/<category>/<your-tool>";

// Inside setupPluginRegistry():
const toolPlugins: StandaloneToolPlugin[] = [
  // ... existing tools
  yourTool
];
```

### Step 3: Create WebView UI

Create `webview/src/plugins/<category>/<your-tool>.tsx`:

```tsx
import { createSignal } from "solid-js";
import { WebviewAssetPlugin } from "../registry";
import { MessageService } from "../../services/message-service";

export const yourToolPlugin: WebviewAssetPlugin = {
  metadata: {
    type: "your-tool",
    title: "Your Tool Name"
  },
  Component: (props) => {
    const [status, setStatus] = createSignal("ready");

    const handleExecute = async () => {
      try {
        setStatus("running");
        
        // Use workspace file operations
        const files = await MessageService.instance.pickFile({
          filters: { "JSON": ["json"] }
        });
        
        for (const file of files) {
          const content = await MessageService.instance.readFile(file);
          // Process content...
        }

        // Show save dialog if needed
        const savePath = await MessageService.instance.showSaveDialog({
          defaultFilename: "output.json"
        });

        if (savePath) {
          await MessageService.instance.writeFile(savePath, resultData, "text");
        }

        MessageService.instance.showNotification("info", "Tool completed successfully");
        setStatus("done");
      } catch (error) {
        MessageService.instance.showNotification("error", `Error: ${error.message}`);
        setStatus("error");
      }
    };

    return (
      <div>
        {/* Your tool UI */}
        <button onclick={handleExecute}>Execute</button>
        <p>Status: {status()}</p>
      </div>
    );
  }
};
```

Register in `webview/src/plugins/registry.ts`:

```typescript
import { yourToolPlugin } from "./<category>/<your-tool>";

const registeredToolPlugins: WebviewAssetPlugin[] = [
  // ... existing tool plugins
  yourToolPlugin
];
```

### Step 4: Register Command

Add to `extension/package.json`:

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

### Step 5: Build and Test

```bash
cd webview && npm run build
cd ../extension && npm run compile
```

Run the extension (F5), open Command Palette, and execute "Tile Engine: Your Tool Name".

---

## Adding a Headless Tool

### Step 1: Create Host Metadata

Create `extension/src/plugins/<category>/<your-tool>.ts`:

```typescript
import * as vscode from "vscode";
import { HeadlessTool } from "../../plugin-system/types";

export const yourTool: HeadlessTool = {
  metadata: {
    mode: "headless",
    type: "your-tool",
    commandId: "tile-engine.tools.yourTool", // Must start with "tile-engine.tools."
    title: "Your Tool Name",
    description: "Description of your tool"
  },
  execute: async (context: vscode.ExtensionContext) => {
    // Execute tool logic directly using VS Code APIs
    const userInput = await vscode.window.showInputBox({
      prompt: "Enter a value:"
    });

    if (userInput) {
      // Perform operations
      const folders = vscode.workspace.workspaceFolders;
      if (folders && folders.length > 0) {
        const filePath = vscode.Uri.joinPath(folders[0].uri, "output.json");
        const content = JSON.stringify({ result: userInput }, null, 2);
        await vscode.workspace.fs.writeFile(
          filePath,
          new TextEncoder().encode(content)
        );
        vscode.window.showInformationMessage(`Output saved to output.json`);
      }
    }
  }
};
```

### Step 2: Register Plugin

Add import and registration in `extension/src/plugin-system/plugin-registry-setup.ts`:

```typescript
import { yourTool } from "../plugins/<category>/<your-tool>";

// Inside setupPluginRegistry():
const headlessTools: HeadlessTool[] = [
  // ... existing tools
  yourTool
];
```

### Step 3: Register Command

Add to `extension/package.json`:

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

### Step 4: Build and Test

```bash
cd extension && npm run compile
```

Run the extension (F5), open Command Palette, and execute "Tile Engine: Your Tool Name".

---

## Plugin Lifecycle

### Editor Plugin Lifecycle
1. User opens `.asset` file
2. `AssetEditorProvider` loads JSON via `AssetDocument`
3. Provider resolves plugin by `json.type` using registry
4. WebView is created, HTML points to built `webview/dist/index.js`
5. WebView posts `ready`; host replies with `init` (document URI, parsed content, plugin metadata)
6. Plugin UI renders content, emits `contentChanged` on edits
7. Host marks document dirty and handles saves
8. Host pushes `applyContent` when file is reverted/saved externally

### Standalone Tool Lifecycle
1. User executes command via Command Palette
2. Extension checks if tool panel is already open; if so, focuses it (singleton behavior)
3. Otherwise, creates new webview panel with `StandaloneToolProvider`
4. `onOpen` hook is called (if defined)
5. WebView posts `ready`; host replies with `initTool` (plugin metadata only, no document)
6. Tool UI renders and can use workspace file APIs
7. When panel closes, `onClose` hook is called (if defined)

### Headless Tool Lifecycle
1. User executes command via Command Palette
2. Extension calls `execute()` function directly
3. Tool has full access to VS Code APIs and can show dialogs/inputs
4. Execution completes and tool exits

---

## File Operations in Plugins

Plugins access files via `MessageService`. See [MessageService API Documentation](message-service-api.md) for complete reference.

### Editor Plugin: Document-Relative Files
```typescript
import { MessageService } from "./services/message-service";

// Read relative to document directory
const config = await MessageService.instance.readFile("../config.json");
const image = await MessageService.instance.readImage("./sprite.png");

// Show file picker (returns paths relative to document)
const files = await MessageService.instance.pickFile({
  filters: { 'Images': ['png', 'jpg'] }
});
```

### Standalone Tool: Workspace-Wide Files
```typescript
import { MessageService } from "./services/message-service";

// Read from anywhere in workspace (absolute or workspace-relative)
const data = await MessageService.instance.readFile("assets/data.json");
const binary = await MessageService.instance.readFile("images/icon.png", "binary");

// Write files
await MessageService.instance.writeFile("output/result.json", jsonString);

// Show save dialog (returns absolute path)
const savePath = await MessageService.instance.showSaveDialog({
  defaultFilename: "export.json"
});

// Notifications
MessageService.instance.showNotification("info", "Operation complete");
```

### Headless Tool: VS Code APIs
```typescript
import * as vscode from "vscode";

// Direct VS Code API access
const input = await vscode.window.showInputBox({ prompt: "Enter value:" });
const uri = await vscode.window.showSaveDialog({ defaultUri: ... });
const folders = vscode.workspace.workspaceFolders;
```

---

## Best Practices

### Plugin Organization
- Keep related editor plugins and tools in the same category folder
- Use consistent naming: `<name>-plugin.ts` for editor, `<name>-tool.ts` for tools
- Keep plugin metadata and UI in separate files for clarity

### Type Safety
- Always type your asset data interfaces
- Use discriminated unions for different asset variants
- Leverage TypeScript for editor plugin type safety

### Error Handling
```typescript
// In webview plugins
try {
  const result = await MessageService.instance.readFile("data.json");
  // Process...
} catch (error) {
  if (error instanceof FileAccessError) {
    MessageService.instance.showNotification("error", `File error: ${error.message}`);
  } else if (error instanceof TimeoutError) {
    MessageService.instance.showNotification("error", "Operation timed out");
  }
}
```

### Performance
- Cache file reads when possible
- Use directory listing (`getDirectory`) to avoid multiple file operations
- Defer heavy computations to prevent UI blocking

### User Experience
- Show loading states during async operations
- Provide clear error messages
- Use notifications for important outcomes
- Support both keyboard and mouse input in UI

---

## Examples

See `extension/src/plugins/` and `webview/src/plugins/` for real implementations:
- **Editor Plugin:** `sprite-font-plugin.ts` / `sprite-font.tsx` — Bitmap font editor
- **Standalone Tool:** `sprite-font-tool.ts` / `sprite-font-tool.tsx` — Font generator
- **Example Tool:** `example-asset-plugin.ts` / `asset-generator-tool.tsx` — Template examples

---

## Troubleshooting

**Plugin not showing up:**
- Ensure it's registered in `plugin-registry-setup.ts`
- Check that command IDs start with `"tile-engine.tools."` for tools
- Verify the WebView registry includes your plugin

**File operations failing:**
- Check path format: relative (editor) vs absolute/workspace-relative (tool)
- Verify the extension has permission to access the file
- Look for timeout errors in the console

**Type mismatches:**
- Ensure asset type in JSON matches registered plugin type
- Check `AssetEditorPlugin` and `WebviewAssetPlugin` type parameters match
- Use TypeScript for better IDE support

---

## See Also

- [MessageService API Documentation](message-service-api.md)
- Plugin examples in `extension/src/plugins/` and `webview/src/plugins/`
- [Sprite Font Documentation](spritefont.md)
