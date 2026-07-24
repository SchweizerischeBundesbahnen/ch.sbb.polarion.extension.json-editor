# json-editor-app (React UI)

The React app for the JSON Editor extension, built with Vite and consuming the shared
`@grigoriev/react-sbb-polarion` (RSP) component library. One bundle serves every
surface; the page is chosen by the `?feature=<id>` query parameter (feature routing).

Surfaces:

- **`about`** - the admin About page (RSP `About`), wired into Polarion by `hivemodule.xml`.
- **`panel` (dev)** - a `vite dev` harness for the WorkItem / Document Properties JSON editor panel.
  In Polarion the panel is not an admin page: it is a form-extension fragment
  (`JsonEditorFormExtension`) that imports the fixed-name bundle `assets/jsonEditorPanel.js` and calls
  `mountJsonEditorPanel(...)`, mounting the panel inside a shadow root in the editor.

## Local development

```bash
cd ui
cp .env.local.template .env.local     # then edit VITE_BASE_URL / VITE_BEARER_TOKEN
npm install
npm run dev                           # http://localhost:5173/
```

- `http://localhost:5173/` - landing stub: project-scope picker + feature links.
- `http://localhost:5173/?feature=about&scope=project/<id>/` - the About page for a project scope.
- `http://localhost:5173/?feature=panel&scope=project/<id>/` - the JSON editor panel harness; pick a
  WorkItem or Document to feed the panel the context it reads from the editor URL in Polarion.

`VITE_BEARER_TOKEN` switches REST calls to the token-authenticated `/api` endpoints (no session
needed); without it, calls hit the session-based `/internal` endpoints.

## Build

```bash
npm run build        # SPA build, then the form-extension lib build (assets/jsonEditorPanel.js)
```

The full Maven build runs this automatically and copies `ui/dist/app` into the `json-editor-app`
webapp resources.

## Tests, coverage, lint

```bash
npm run test                  # Vitest browser mode (behavior; visual snapshots are Docker-only)
npm run test:docker           # full suite (behavior + visual) in the pinned Playwright image
npm run test:update:docker    # regenerate visual reference PNGs (Docker/Linux only)
npm run test:coverage         # behavior-only coverage (istanbul, 80% gate)
npm run test:coverage:docker  # authoritative full-suite coverage (what pre-commit runs)
npm run lint
npm run format:check
```

`src/vendor/` holds the vendored petrel code editor + highlight.js + jsonlint, kept verbatim from the
legacy webapp; it is excluded from lint, formatting and coverage.
