// Runs before every test file (see vitest.config.ts setupFiles).
//
// Load the same stylesheets the app renders with so the browser paints components realistically:
//   1. react-sbb-polarion's bundled control CSS (tokens + buttons/inputs/checkboxes/searchable-dropdown/
//      alerts + the shared component styles), the same import main.tsx uses.
//   2. this app's own App.css (base font/size on `.app`, feature list, alerts).
//   3. the extension's own panel CSS (petrel.css / highlightjs.css / json-editor.css) that styles the
//      JSON editor panel: the code-editor chrome, the file-selector row, buttons and validation result.
//      At runtime mountInShadow injects these (bundled via `?inline`) into the shadow root; the panel
//      tests render outside a shadow root, so they must be loaded here or the panel paints unstyled
//      (serif, no control styling).
// The Polarion-served stylesheet linked in index.html (presentation.css) is NOT bundled and is not loaded
// here; it is baseline chrome. Also registers jest-dom matchers.
import '@sbb-polarion/react-sbb-polarion/style.css';
import '@testing-library/jest-dom/vitest';
import '../src/App.css';
import '../src/formext/highlightjs.css';
import '../src/formext/json-editor.css';
import '../src/formext/petrel.css';

// Mirror the base control font/size that mountInShadow injects into the shadow root at runtime (see
// shadowMount.ts). react-sbb-polarion's style.css only DEFINES the --sbb-control-* tokens on `.sbb-ui`;
// it does not apply font-family/size to the container. Without this rule the panel - rendered here
// outside a shadow root, so it cannot inherit the shadow's base rule - falls back to the browser
// default (serif, 16px) instead of Polarion's Segoe UI 13px.
const baseFont = document.createElement('style');
baseFont.textContent =
  '.sbb-ui { font-family: var(--sbb-control-font-family, "Segoe UI", "Selawik", "Open Sans", Arial, sans-serif); font-size: var(--sbb-control-font-size, 13px); }';
document.head.appendChild(baseFont);

// Chromium decides per layer how to rasterize text, and the decision depends on the compositing of the
// page as a whole - which differs between "this file ran on its own" and "this file ran after that one".
// The result is the same glyphs at the same coordinates with a different gamma, and a reference that
// agrees with the runs that had the same files ahead of it and with no others. Asking for grayscale
// explicitly takes the decision away from the compositor.
//
// Test-only, and the references are regenerated with it so they and the runs agree.
const textRendering = document.createElement('style');
textRendering.textContent = '*, *::before, *::after { -webkit-font-smoothing: antialiased !important; }';
document.head.appendChild(textRendering);
