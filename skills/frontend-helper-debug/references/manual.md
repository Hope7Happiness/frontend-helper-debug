# Manual integration for non-Vite frontends

Use this mode when the frontend is rendered or served by Flask, Django, FastAPI, Rails, a plain static server, or another tool that does not run the Frontend Helper Vite plugin.

The backend language does not change the browser recorder. Manual integration has two independent pieces:

1. Load the dev-only browser runtime and call `mount({ traceEndpoint })`.
2. Add the same trace HTTP API that the Vite plugin normally provides.

## Browser runtime

Use the project's existing JavaScript asset pipeline when one exists. Bundle or serve the `mount` entry from `@frontend-helper/dev-overlay`, then inject it from the server-rendered development template:

```html
{% if debug %}
<script type="module">
  import { mount } from "/static/frontend-helper/dev-overlay.js";
  mount({
    hotkey: "Alt+Shift+H",
    traceEndpoint: "/__frontend-helper/traces"
  });
</script>
{% endif %}
```

Adapt the conditional and static URL to the framework. For Django, use the project's `settings.DEBUG`-backed template context. For FastAPI/Starlette, inject the same module from the development-only HTML response. For a plain static site, add the script only to the local development HTML entrypoint.

If the project has no JavaScript bundler, create a small dev-only bundle with its available asset tool and serve that bundle as a static file. Do not paste the recorder source into application templates, load it from an arbitrary third-party CDN, or ship it in production. The runtime must be able to resolve its `@rrweb/record` dependency through the project's asset pipeline.

The `mount` call is the only browser API the integration needs. The default shortcut is `Alt+Shift+H`; pass a project-specific `traceEndpoint` if the API is mounted elsewhere. Keep the endpoint same-origin unless the user explicitly requires a separately hosted development API and configures CORS deliberately.

## Trace API

Implement these routes on the development server. Store traces under a project-local ignored directory such as `.frontend-helper/traces`, and use atomic writes where the framework supports them.

```text
POST   /__frontend-helper/traces
GET    /__frontend-helper/traces
GET    /__frontend-helper/traces/:id
PATCH  /__frontend-helper/traces/:id
DELETE /__frontend-helper/traces/:id
```

`POST` receives a JSON `frontend-helper-trace` document. Validate at least:

- `format === "frontend-helper-trace"`
- `version === 1`
- `timeline`, `annotations`, and `rrwebEvents` are arrays
- the request body is bounded (the Vite adapter defaults to 25 MB)

Generate IDs in the form `fh_<lowercase-time>_<8-hex-digits>`. Save the original document with:

```json
{
  "storage": {
    "id": "fh_m3z4abc_1a2b3c4d",
    "savedAt": "2026-08-16T22:10:00.000Z",
    "name": "optional human name"
  },
  "service": {
    "name": "optional service name",
    "version": "optional service version",
    "commit": "optional git commit",
    "branch": "optional branch",
    "dirty": false
  }
}
```

`GET /traces` returns newest-first summaries. `PATCH` accepts `{"name":"..."}` and should limit names to 80 characters. `DELETE` permanently removes the stored trace and returns the deleted ID. Return `404` for an unknown valid ID and `422` for invalid trace/name payloads.

Pin service metadata at save time from the Python package version, an application version setting, and Git/deployment environment variables when available. Do not put cookies, auth tokens, or arbitrary local paths into a trace.

## Framework checklist

Before declaring manual mode complete, verify all of the following in a development server:

1. The overlay is absent from a production build or production response.
2. `Alt+Shift+H` opens the helper and a recording returns an `fh_...` ID.
3. The ID can be listed, retrieved, renamed, and deleted through the backend.
4. A nested scroll container and the page produce target-aware timeline events.
5. The stored trace pins the active service version when one is available.

When the user gives an `fh_...` ID, use the running server's base URL with the trace inspection commands from the parent skill. Read `service`, `timeline`, and `annotations` before loading `rrwebEvents`.
