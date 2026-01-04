> You are a senior TypeScript engineer building a **production-quality VS Code Extension**.
>
> ## Goal
>
> Set up a **VS Code Extension project** that:
>
> * Uses **TypeScript**
> * Uses **Vite + SolidJS** for WebView UIs
> * Follows **VS Code extension best practices**
> * Is structured for long-term maintainability
>
> The extension provides a **custom editor** for files with the `.asset` extension.
> `.asset` files are always valid JSON documents and **must contain a root property**:
>
> ```json
> { "type": "<type>" }
> ```
>
> The editor **delegates rendering and editing** to a **compile-time registered plugin system** based on this `type` value.
>
> ---
>
> ## Functional Requirements
>
> ### Custom Editor
>
> * Register a **custom editor** for `*.asset` files
> * Use a WebView powered by **SolidJS**
> * The WebView receives:
>
>   * document URI
>   * parsed JSON content
>   * resolved plugin metadata
>
> ### Plugin System
>
> * Plugins are **registered at compile time**
> * No dynamic loading or discovery at runtime
> * Plugin resolution happens via `json.type`
>
> ### Plugin Interface (core abstraction)
>
> Define a **minimal, stable interface** so plugins do NOT interact with VS Code APIs directly.
>
> Each plugin:
>
> * Receives:
>
>   * document URI (string)
>   * parsed JSON object
> * Can:
>
>   * mark the document as dirty
>   * generate the updated JSON document on save
>
> Example responsibilities:
>
> * Rendering UI
> * Editing internal state
> * Producing new JSON output
>
> The extension host:
>
> * Handles file IO
> * Handles VS Code lifecycle
> * Bridges messages between WebView and plugins
>
> ---
>
> ## Architecture Constraints
>
> * Clear separation between:
>
>   * VS Code extension host
>   * Plugin system
>   * WebView UI
> * Strong TypeScript typing across boundaries
> * Message-based communication (`postMessage`)
> * Plugins must be testable outside VS Code
>
> ---
>
> ## Project Structure
>
> Generate a **complete project skeleton**, including:
>
> ```
> /extension
>   /src
>     extension.ts
>     assetEditor/
>       AssetEditorProvider.ts
>       AssetDocument.ts
>     plugins/
>       AssetEditorPlugin.ts
>       registry.ts
>       example/
>         ExampleAssetPlugin.ts
>     protocol/
>       messages.ts
> /webview
>   /src
>     main.tsx
>     App.tsx
>     plugins/
>   index.html
>   vite.config.ts
> README.md
> ```
>
> Adjust naming where appropriate but keep the intent.
>
> ---
>
> ## README.md (required)
>
> Generate a **developer-focused README** that includes:
>
> * Project purpose
> * High-level architecture overview (diagram in ASCII or structured bullets)
> * Explanation of:
>
>   * Custom editor flow
>   * Plugin resolution
>   * Messaging protocol
> * How to add a new editor plugin
> * Development & build instructions
>
> ---
>
> ## Quality Bar
>
> * Use idiomatic VS Code APIs
> * Prefer explicit types over `any`
> * Avoid unnecessary abstractions
> * Keep the plugin interface small and opinionated
> * Assume this will become a large editor platform later
>
> Start by generating the **full project structure, key TypeScript files, and README**.
