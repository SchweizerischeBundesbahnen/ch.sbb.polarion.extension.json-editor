import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import JsonEditorPanel from '../src/formext/JsonEditorPanel';
import type { Attachment, PanelContext } from '../src/formext/types';
import { installFetchMock } from './mockFetch';

// Docker-only snapshots of the JSON editor panel, rendered with the same styles as Polarion: RSP's
// bundled CSS + the extension's own panel CSS (petrel / highlightjs / json-editor, loaded in
// test/setup.ts) and the `sbb-ui` container class the runtime shadow mount applies. The Validate
// button icon (validate.svg) is imported as a bundled asset (JsonEditorPanel imports validate.svg), so
// Vite serves it directly - no webapp-assets middleware is needed.

const WORKITEM: PanelContext = { projectId: 'proj', entityId: 'WI1', spaceId: '', validateOnSave: false };
// A Document context: spaceId is set, so the new-file name has NO id prefix (unlike a WorkItem).
const DOCUMENT: PanelContext = { projectId: 'proj', entityId: 'Requirements', spaceId: 'Specs', validateOnSave: false };
const ATTACHMENTS: Attachment[] = [{ id: 'att1', fileName: 'WI1-config.json' }];
const NEW_FILE = '__new__';

const $ = (sel: string) => document.querySelector<HTMLElement>(sel);

// Set a React-controlled control's value via the native prototype setter, then dispatch the event
// React listens for (so its value tracker registers the change).
function setControlValue(el: HTMLSelectElement | HTMLInputElement, value: string, eventType: 'change' | 'input') {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event(eventType, { bubbles: true }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function snapshot(name: string) {
  const wrapper = $('#je-panel-wrapper') as HTMLElement;
  // Wait for the Validate button icon to load, else the screenshot can race the <img>.
  await vi.waitFor(() => {
    const icon = document.querySelector<HTMLImageElement>('#validate-json-button img');
    expect(icon?.complete && icon.naturalWidth > 0).toBe(true);
  });
  await page.viewport(720, Math.ceil(wrapper.scrollHeight) + 24);
  await expect(page.elementLocator(wrapper)).toMatchScreenshot(name);
}

function renderPanel(context: PanelContext = WORKITEM, attachments: Attachment[] = ATTACHMENTS) {
  render(
    <div id="je-panel-wrapper" className="sbb-ui" style={{ width: 640, padding: 12, background: 'white' }}>
      <JsonEditorPanel context={context} attachments={attachments} onSaved={() => {}} />
    </div>,
  );
}

// Select "New" and type a file name so the new-file row (prefix span + input + ".json") is visible.
async function pickNewAndType(name: string) {
  await vi.waitFor(() => expect($('#jsonCodeEditor textarea')).not.toBeNull());
  setControlValue($('#editor-selector') as HTMLSelectElement, NEW_FILE, 'change');
  await vi.waitFor(() => expect(($('#new-file-input') as HTMLInputElement).style.visibility).toBe('visible'));
  setControlValue($('#new-file-input') as HTMLInputElement, name, 'input');
  await vi.waitFor(() => expect(($('#new-file-input') as HTMLInputElement).value).toBe(name));
}

describe('JsonEditorPanel visual', () => {
  it('initial empty state (file selector + disabled action bar + empty editor)', async () => {
    installFetchMock([]);
    renderPanel();
    await vi.waitFor(() => expect($('#jsonCodeEditor textarea')).not.toBeNull());
    await snapshot('panel-empty');
  });

  it('existing file loaded and validated (valid JSON)', async () => {
    installFetchMock([
      {
        method: 'GET',
        match: /\/attachments\/att1\/content$/,
        respond: () => new Response('{\n  "name": "example",\n  "values": [1, 2, 3]\n}', { status: 200 }),
      },
    ]);
    renderPanel();
    await vi.waitFor(() => expect($('#jsonCodeEditor textarea')).not.toBeNull());
    setControlValue($('#editor-selector') as HTMLSelectElement, 'att1', 'change');
    await vi.waitFor(() => expect(($('#jsonCodeEditor textarea') as HTMLTextAreaElement).value).toContain('example'));
    ($('#edit-json-button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(($('#validate-json-button') as HTMLButtonElement).disabled).toBe(false));
    ($('#validate-json-button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect($('#json-validation-result')!.textContent).toBe('JSON is valid!'));
    await snapshot('panel-loaded-validated');
  });

  it('new file on a WorkItem shows the WorkItem-id prefix before the name field', async () => {
    installFetchMock([]);
    renderPanel(WORKITEM);
    await pickNewAndType('settings');
    // Prefix span carries "WI1-" (entityId + '-') because a WorkItem has no space.
    expect($('#new-file-name-prefix')!.textContent).toBe('WI1-');
    await snapshot('panel-new-workitem');
  });

  it('new file on a Document shows no prefix before the name field', async () => {
    installFetchMock([]);
    renderPanel(DOCUMENT, []);
    await pickNewAndType('settings');
    // Document context (spaceId set) -> empty prefix.
    expect($('#new-file-name-prefix')!.textContent).toBe('');
    await snapshot('panel-new-document');
  });

  it('new file with no name yet shows the guidance warning', async () => {
    installFetchMock([]);
    renderPanel();
    await vi.waitFor(() => expect($('#jsonCodeEditor textarea')).not.toBeNull());
    setControlValue($('#editor-selector') as HTMLSelectElement, NEW_FILE, 'change');
    // "New" chosen, name still empty -> the guidance warning is shown and Edit stays disabled.
    await vi.waitFor(() => expect($('#editor-warning')!.style.display).toBe('block'));
    expect($('#editor-warning')!.textContent).toContain(
      'In order to start editing please enter new file name above or choose one of existing files',
    );
    await snapshot('panel-new-no-name');
  });
});
