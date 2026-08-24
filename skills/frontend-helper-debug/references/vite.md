# Vite integration and trace API

## Installation

Install the adapter as a development dependency:

```bash
npm install --save-dev @frontend-helper/vite
```

Add the plugin without importing the overlay into application code:

```ts
import { defineConfig } from "vite";
import frontendHelper from "@frontend-helper/vite";

export default defineConfig({
  plugins: [
    frontendHelper({
      hotkey: "Alt+Shift+H",
      initiallyOpen: false,
    }),
  ],
});
```

The plugin uses `apply: "serve"`. It injects the browser runtime and registers the trace API only in the Vite development server. It must not appear in the production client bundle.

Options:

- `hotkey`: panel shortcut; default `Alt+Shift+H`.
- `initiallyOpen`: open the panel when the dev page loads; default `false`.
- `endpoint`: trace API base; default `/__frontend-helper/traces`.
- `storageDirectory`: path relative to the Vite root; default `.frontend-helper/traces`.
- `maxTraceBytes`: maximum POST body; default 25 MB.
- `service`: optional `{ name, version, commit, branch, dirty }` overrides. Without overrides, detect package name/version, common deployment environment variables, and Git metadata when available.

## API contract

Create a trace:

```http
POST /__frontend-helper/traces
Content-Type: application/json
```

Successful response:

```json
{
  "id": "fh_m3z4abc_1a2b3c4d",
  "savedAt": "2026-08-16T22:10:00.000Z"
}
```

Retrieve a trace:

```http
GET /__frontend-helper/traces/fh_m3z4abc_1a2b3c4d
```

List traces newest first:

```http
GET /__frontend-helper/traces
```

Name or rename a trace:

```http
PATCH /__frontend-helper/traces/fh_m3z4abc_1a2b3c4d
Content-Type: application/json

{"name":"checkout dialog race"}
```

Delete a trace:

```http
DELETE /__frontend-helper/traces/fh_m3z4abc_1a2b3c4d
```

The stored JSON includes `storage.id`, `storage.name`, `storage.savedAt`, `service`, `session`, `timeline`, `annotations`, and `rrwebEvents`. The pinned `service` may contain package name/version, Git commit, branch, and dirty state. Start analysis with `service`, `timeline`, and `annotations`; avoid loading the larger `rrwebEvents` array unless needed.
