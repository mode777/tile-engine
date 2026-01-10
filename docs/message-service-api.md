# MessageService API Documentation

## Overview

`MessageService` is a singleton that provides async request-response communication between the webview and VS Code extension host. It handles file operations, dialogs, and notifications with automatic timeout management and error handling.

Access via `MessageService.instance`.

## Error Types

### TimeoutError
Thrown when a request exceeds its timeout threshold (typically 10-60 seconds).

### FileAccessError
Thrown when the host reports an operation error (file not found, permission denied, etc.).

## File Operations

### readFile(filePath, encoding?)
Read file contents as text or binary.

```typescript
const content = await MessageService.instance.readFile("data.json");
const binary = await MessageService.instance.readFile("image.png", "binary");
```

**Parameters:**
- `filePath` (string): Relative to document (editor) or workspace (tool) root
- `encoding` ("text" | "binary"): Default: "text"

**Returns:** Promise<string> - File content or base64 for binary

---

### writeFile(filePath, content, encoding?)
Write content to a file.

```typescript
await MessageService.instance.writeFile("output.json", jsonString);
await MessageService.instance.writeFile("data.bin", base64String, "binary");
```

**Parameters:**
- `filePath` (string): Relative to document or workspace root
- `content` (string): Text or base64 encoded binary data
- `encoding` ("text" | "binary"): Default: "text"

**Returns:** Promise<void>

---

### readImage(filePath)
Read an image file and return as a data URL.

```typescript
const dataUrl = await MessageService.instance.readImage("sprite.png");
// "data:image/png;base64,iVBORw0KGgo..."
```

**Parameters:**
- `filePath` (string): Path to image file

**Returns:** Promise<string> - Data URL

---

### getDirectory(dirPath)
List files and folders in a directory.

```typescript
const entries = await MessageService.instance.getDirectory("assets/");
// [{ name: "sprite.png", isDirectory: false }, { name: "sprites", isDirectory: true }]
```

**Parameters:**
- `dirPath` (string): Directory path

**Returns:** Promise<DirectoryEntry[]>

**DirectoryEntry:**
```typescript
{ name: string; isDirectory: boolean }
```

## Dialog Operations

### pickFile(options?)
Show native file picker and return selected paths.

```typescript
const files = await MessageService.instance.pickFile();
const images = await MessageService.instance.pickFile({
  filters: { "Images": ["png", "jpg"] },
  canSelectMany: true
});
```

**Parameters:**
- `options?.canSelectMany` (boolean): Default: false
- `options?.openLabel` (string): Button label
- `options?.filters` (Record<string, string[]>): File type filters
- `options?.defaultUri` (string): Initial directory

**Returns:** Promise<string[]> - Selected file paths (relative to context)

---

### showSaveDialog(options?)
Show native save dialog. **Tool mode only.**

```typescript
const path = await MessageService.instance.showSaveDialog({
  defaultFilename: "export.json",
  filters: { "JSON": ["json"] }
});
if (path) {
  // User selected location, path is absolute
}
```

**Parameters:**
- `options?.defaultFilename` (string)
- `options?.defaultUri` (string): Initial directory
- `options?.filters` (Record<string, string[]>)

**Returns:** Promise<string | null> - Absolute path or null if cancelled

## Notifications

### showNotification(type, message)
Display a toast notification.

```typescript
MessageService.instance.showNotification("info", "Operation completed");
MessageService.instance.showNotification("error", "Failed to save file");
```

**Parameters:**
- `type` ("info" | "warning" | "error")
- `message` (string)

## Host → Webview Events

Subscribe to lifecycle and data events from the host.

```typescript
MessageService.instance.onInit.subscribe(({ documentUri, content, plugin }) => {
  // Editor initialized with document
});

MessageService.instance.onInitTool.subscribe(({ plugin }) => {
  // Standalone tool initialized
});

MessageService.instance.onApplyContent.subscribe(({ content }) => {
  // External content applied
});

MessageService.instance.onError.subscribe(({ message }) => {
  console.error(message);
});
```

## Webview Notifications

### notifyContentChanged(content)
Notify host that user modified content.

```typescript
MessageService.instance.notifyContentChanged({ type: "sprite", data: {...} });
```

---

### notifyRequestSave()
Signal that user requested save operation.

```typescript
MessageService.instance.notifyRequestSave();
```

---

### notifyReady()
Signal that webview is initialized and ready.

```typescript
MessageService.instance.notifyReady();
```

## Path Handling

- **Editor Mode:** Paths are relative to the document directory
- **Tool Mode:** Paths are relative to the workspace root
- **Absolute Paths:** Supported in both modes (file:// URIs automatically converted)

## Error Handling

```typescript
try {
  const content = await MessageService.instance.readFile("config.json");
} catch (error) {
  if (error instanceof TimeoutError) {
    console.error("Request took too long");
  } else if (error instanceof FileAccessError) {
    console.error("File access failed:", error.message);
  }
}
```

## Timeouts

| Operation | Timeout |
|-----------|---------|
| File I/O (read/write) | 10s |
| File picker | 30s |
| Save dialog | 60s |
| Directory listing | 10s |

Timeouts are automatically managed; no manual cleanup required.

## State Persistence

```typescript
// Store state
MessageService.instance.setState({
  content: { type: "sprite", data: {...} },
  plugin: {...},
  mode: "editor"
});

// Retrieve state
const state = MessageService.instance.getState();
```

State persists across webview reloads.
