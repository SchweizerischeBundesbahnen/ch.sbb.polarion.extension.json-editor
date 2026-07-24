import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Separate build for the form-extension bundle (the WorkItem / Document Properties JSON editor
 * panel). Intentionally NOT part of the SPA build: the server-rendered fragment
 * (webapp/json-editor/html/json-editor-panel.html, emitted by JsonEditorFormExtension) imports this
 * by a fixed URL and calls its named export (`mountJsonEditorPanel`), so it must be a stable-name ES
 * module rather than a hashed SPA asset. Library mode guarantees the fixed name and preserved export;
 * React is bundled in so the editor page can load the module standalone.
 *
 * Output: dist/app/assets/jsonEditorPanel.js, appended next to the SPA bundle (emptyOutDir: false),
 * so the SPA build (which empties dist/app) must run first. Served under
 * /polarion/json-editor-app/ui/app/assets/.
 */
export default defineConfig({
  plugins: [react()],
  // The linked react-sbb-polarion package carries its own dev copy of React; dedupe so this bundle
  // embeds only this app's single React instance.
  resolve: { dedupe: ['react', 'react-dom'] },
  // Force React's production build and replace process.env.NODE_ENV (lib mode does not do this
  // automatically, so without it React bundles its larger dev build with runtime warnings).
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: './dist/app/assets',
    emptyOutDir: false,
    minify: 'esbuild',
    lib: {
      // React is bundled in (not externalized) so the editor can load this module standalone.
      entry: {
        jsonEditorPanel: fileURLToPath(new URL('./src/formext/mount.tsx', import.meta.url)),
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
  },
});
