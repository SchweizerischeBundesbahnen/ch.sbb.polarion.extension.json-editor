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

// Transitions and animations are off for every capture. A screenshot taken mid-fade is a reference that
// only sometimes reproduces, and the durations are react-sbb-polarion's, which can change them without
// this repository noticing. Killing them removes the race instead of outrunning it with a sleep.
//
// Grayscale antialiasing is NOT pinned here: `-webkit-font-smoothing` is implemented only on macOS in
// Blink, so on the Linux container the rule parses and is ignored - a reference captured with it is
// byte-identical to one captured without. `--disable-lcd-text` in vitest.config.ts is the platform
// independent way to ask for the same thing.
const stillness = document.createElement('style');
stillness.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
document.head.appendChild(stillness);
