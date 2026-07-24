import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import JsonEditorPanel from './JsonEditorPanel';
import highlightStyle from './highlightjs.css?inline';
import panelStyle from './json-editor.css?inline';
import petrelStyle from './petrel.css?inline';
import { mountInShadow } from './shadowMount';
import type { Attachment, PanelContext } from './types';

/**
 * Entry point for the WorkItem / Document Properties JSON editor panel, built by Vite into a
 * fixed-name module (`assets/jsonEditorPanel.js`; the Vite input key `jsonEditorPanel` sets the output
 * name). The server-rendered form-extension fragment (webapp/json-editor/html/json-editor-panel.html,
 * emitted by JsonEditorFormExtension) dynamically imports this module and calls
 * `mountJsonEditorPanel("#json-editor-panel")`.
 *
 * The panel is mounted inside a **shadow root** on the fragment div, so its styles are fully
 * encapsulated on the shared editor page (see shadowMount.ts). The extension's own panel CSS
 * (petrel.css / highlightjs.css / json-editor.css) is bundled via `?inline` and injected into the
 * shadow alongside react-sbb-polarion's bundled stylesheet.
 */

interface MountOptions {
  /** Explicit context (dev harness / tests). In Polarion it is read from the host's data-* attributes. */
  context?: PanelContext;
  /** Explicit attachments (dev harness / tests). In Polarion they are read from data-attachments. */
  attachments?: Attachment[];
}

function readContext(host: HTMLElement): PanelContext {
  const d = host.dataset;
  return {
    projectId: d.projectId ?? '',
    entityId: d.entityId ?? '',
    spaceId: d.spaceId ?? '',
    validateOnSave: d.validateOnSave === 'true',
  };
}

function readAttachments(host: HTMLElement): Attachment[] {
  try {
    const parsed = JSON.parse(host.dataset.attachments ?? '[]');
    return Array.isArray(parsed) ? (parsed as Attachment[]) : [];
  } catch {
    return [];
  }
}

export function mountJsonEditorPanel(selector: string, options: MountOptions = {}): Root | undefined {
  const host = document.querySelector<HTMLElement>(selector);
  if (!host) {
    console.error(`json-editor: panel mount target "${selector}" not found.`);
    return undefined;
  }
  const context = options.context ?? readContext(host);
  const attachments = options.attachments ?? readAttachments(host);
  const container = mountInShadow(host, {
    containerClassName: 'sbb-ui',
    styleTexts: [petrelStyle, highlightStyle, panelStyle],
  });
  const root = createRoot(container);
  root.render(<JsonEditorPanel context={context} attachments={attachments} />);
  // Returned so the dev harness can unmount; the Polarion fragment ignores it.
  return root;
}
