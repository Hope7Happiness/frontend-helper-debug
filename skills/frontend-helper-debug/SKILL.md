---
name: frontend-helper-debug
description: Add Frontend Helper's dev-only interaction recorder and trace API to Vite frontends, then list, name, retrieve, inspect, or delete version-pinned traces by ID. Use when Codex creates or modifies a local frontend that should let a person demonstrate UI bugs to an agent, when a user provides an fh_ trace ID, or when debugging recorded clicks, DOM changes, element annotations, and the service version active during recording.
---

# Frontend Helper Debug

Add the recorder as development infrastructure, never as application UI or production code. Let a person record the bug, receive a short trace ID, and give that ID to the agent.

## Add Frontend Helper

1. Inspect the package manager, build tool, dev command, and existing Vite config.
2. Read [references/vite.md](references/vite.md) for the supported integration and API contract.
3. Install `@frontend-helper/vite` as a development dependency. Do not import the browser overlay from application components.
4. Add `frontendHelper()` to the Vite plugins. Preserve existing configuration and plugin order unless ordering is material.
5. Add `.frontend-helper/traces` to `.gitignore`.
6. Start the dev server and confirm the overlay appears only there. Use `Alt+Shift+H` to show or hide it.
7. Run the production build and confirm Frontend Helper client code is absent.

Do not claim non-Vite support. For another build system, implement the same API contract only when the user asks for a new adapter.

## Inspect a Trace ID

When the user gives an ID such as `fh_m3..._1a2b3c4d`:

1. Identify the running dev-server URL from existing terminal output or project configuration.
2. Run `node <skill-dir>/scripts/trace.mjs summary <id> <base-url>`.
3. Compare the pinned service version, commit, branch, and dirty state with the current workspace before assuming the trace matches current code.
4. Read the semantic timeline and annotations first. Inspect `raw` rrweb events only when the summary lacks evidence.
5. Correlate timestamps, referenced elements, selectors, styles, and comments with the source code.
6. Explain the evidence before changing code. Implement a fix only when requested or clearly included in the task.

Use `node <skill-dir>/scripts/trace.mjs raw <id> <base-url>` to retrieve the full stored trace.

List and name traces:

```bash
node <skill-dir>/scripts/trace.mjs list <base-url>
node <skill-dir>/scripts/trace.mjs name <id> "checkout dialog race" <base-url>
```

## Delete a Trace

Delete only when the user explicitly requests deletion:

```bash
node <skill-dir>/scripts/trace.mjs delete <id> <base-url>
```

The delete is permanent. Report the deleted ID.

## Guardrails

- Keep the API on the local development server; do not expose it in production.
- Store traces under `.frontend-helper/traces` and keep that directory out of version control.
- Keep password masking enabled.
- Do not add authentication tokens, cookies, or arbitrary local file paths to traces.
- Preserve the plugin's default 25 MB request limit unless the user has a concrete larger recording.
