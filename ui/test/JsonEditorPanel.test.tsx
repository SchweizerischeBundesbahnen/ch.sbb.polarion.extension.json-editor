import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import JsonEditorPanel from '../src/formext/JsonEditorPanel';
import type { Attachment, PanelContext } from '../src/formext/types';
import { installFetchMock } from './mockFetch';

// Behavior of the JSON editor panel shell, ported from the legacy json-editor.js. Rendered directly
// with an explicit context + attachments (the same props mount.tsx reads from the fragment). REST is
// mocked at the fetch boundary; the vendored petrel editor runs for real in Chromium.

const WORKITEM: PanelContext = { projectId: 'proj', entityId: 'WI1', spaceId: '', validateOnSave: false };
const ATTACHMENTS: Attachment[] = [{ id: 'att1', fileName: 'WI1-existing.json' }];
const NEW_FILE = '__new__';

// Drive a React-controlled <select>/<input>/<textarea>: set the value via the native prototype setter
// (so React's value tracker sees the change) then dispatch the event React listens for.
function setControlValue(
  el: HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement,
  value: string,
  eventType: 'change' | 'input',
) {
  const proto =
    el instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event(eventType, { bubbles: true }));
}

const $ = (sel: string) => document.querySelector<HTMLElement>(sel);

async function renderPanel(props: Partial<Parameters<typeof JsonEditorPanel>[0]> = {}) {
  const onSaved = vi.fn();
  render(<JsonEditorPanel context={WORKITEM} attachments={ATTACHMENTS} onSaved={onSaved} {...props} />);
  // Wait until the petrel editor has been created inside the host.
  await vi.waitFor(() => expect($('#jsonCodeEditor textarea')).not.toBeNull());
  return { onSaved };
}

const editorTextarea = () => $('#jsonCodeEditor textarea') as HTMLTextAreaElement;
const selectEl = () => $('#editor-selector') as HTMLSelectElement;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('JsonEditorPanel', () => {
  it('renders the shell with all action buttons disabled initially', async () => {
    installFetchMock([]);
    await renderPanel();
    for (const id of ['#edit-json-button', '#validate-json-button', '#save-json-button', '#cancel-edit-json-button']) {
      expect(($(id) as HTMLButtonElement).disabled).toBe(true);
    }
    // New-file input hidden until "New" is picked.
    expect(($('#new-file-input') as HTMLInputElement).style.visibility).toBe('hidden');
  });

  it('shows the new-file input and guidance warning when "New" is picked, and enables Edit for a unique name', async () => {
    installFetchMock([]);
    await renderPanel();
    setControlValue(selectEl(), NEW_FILE, 'change');
    await vi.waitFor(() => expect(($('#new-file-input') as HTMLInputElement).style.visibility).toBe('visible'));
    expect($('#editor-warning')!.textContent).toContain('enter new file name');
    expect(($('#edit-json-button') as HTMLButtonElement).disabled).toBe(true);

    setControlValue($('#new-file-input') as HTMLInputElement, 'brandnew', 'input');
    await vi.waitFor(() => expect(($('#edit-json-button') as HTMLButtonElement).disabled).toBe(false));
    expect($('#editor-warning')!.style.display).toBe('none');
  });

  it('warns and disables Edit when the new file name clashes with an existing attachment', async () => {
    installFetchMock([]);
    await renderPanel();
    setControlValue(selectEl(), NEW_FILE, 'change');
    // prefix for a WorkItem is "WI1-", so "existing" -> "WI1-existing.json" (already present).
    setControlValue($('#new-file-input') as HTMLInputElement, 'existing', 'input');
    await vi.waitFor(() => expect($('#editor-warning')!.textContent).toContain('clashes'));
    expect(($('#edit-json-button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('loads an existing attachment content into the editor and validates it', async () => {
    installFetchMock([
      {
        method: 'GET',
        match: /\/attachments\/att1\/content$/,
        respond: () => new Response('{"a": 1}', { status: 200 }),
      },
    ]);
    await renderPanel();
    setControlValue(selectEl(), 'att1', 'change');
    await vi.waitFor(() => expect(editorTextarea().value).toBe('{"a": 1}'));
    expect(($('#edit-json-button') as HTMLButtonElement).disabled).toBe(false);

    ($('#edit-json-button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(($('#validate-json-button') as HTMLButtonElement).disabled).toBe(false));
    ($('#validate-json-button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect($('#json-validation-result')!.textContent).toBe('JSON is valid!'));
    expect($('#json-validation-result')!.className).toContain('validation-pass');
  });

  it('reports invalid JSON on validate', async () => {
    installFetchMock([
      {
        method: 'GET',
        match: /\/attachments\/att1\/content$/,
        respond: () => new Response('{"a": 1}', { status: 200 }),
      },
    ]);
    await renderPanel();
    setControlValue(selectEl(), 'att1', 'change');
    await vi.waitFor(() => expect(editorTextarea().value).toBe('{"a": 1}'));
    ($('#edit-json-button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(($('#validate-json-button') as HTMLButtonElement).disabled).toBe(false));
    setControlValue(editorTextarea(), '{ bad json', 'input');
    ($('#validate-json-button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect($('#json-validation-result')!.className).toContain('validation-fail'));
  });

  it('saves an existing attachment via PATCH and calls onSaved', async () => {
    const fetchMock = installFetchMock([
      {
        method: 'GET',
        match: /\/attachments\/att1\/content$/,
        respond: () => new Response('{"a": 1}', { status: 200 }),
      },
      { method: 'PATCH', match: /\/attachments\/att1$/, respond: () => new Response('att1', { status: 200 }) },
    ]);
    const { onSaved } = await renderPanel();
    setControlValue(selectEl(), 'att1', 'change');
    await vi.waitFor(() => expect(editorTextarea().value).toBe('{"a": 1}'));
    ($('#edit-json-button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(($('#save-json-button') as HTMLButtonElement).disabled).toBe(false));
    ($('#save-json-button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(true);
  });

  it('creates a new attachment (POST then PATCH) and calls onSaved', async () => {
    const fetchMock = installFetchMock([
      { method: 'POST', match: /\/attachments$/, respond: () => new Response('newAtt', { status: 200 }) },
      { method: 'PATCH', match: /\/attachments\/newAtt$/, respond: () => new Response('newAtt', { status: 200 }) },
    ]);
    const { onSaved } = await renderPanel();
    setControlValue(selectEl(), NEW_FILE, 'change');
    setControlValue($('#new-file-input') as HTMLInputElement, 'brandnew', 'input');
    await vi.waitFor(() => expect(($('#edit-json-button') as HTMLButtonElement).disabled).toBe(false));
    ($('#edit-json-button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(($('#save-json-button') as HTMLButtonElement).disabled).toBe(false));
    setControlValue(editorTextarea(), '{"ok": true}', 'input');
    ($('#save-json-button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    const methods = fetchMock.mock.calls.map(([, init]) => init?.method);
    expect(methods).toContain('POST');
    expect(methods).toContain('PATCH');
  });

  it('does not save invalid JSON when validateOnSave is enabled', async () => {
    const fetchMock = installFetchMock([
      {
        method: 'GET',
        match: /\/attachments\/att1\/content$/,
        respond: () => new Response('{"a": 1}', { status: 200 }),
      },
      { method: 'PATCH', match: /\/attachments\/att1$/, respond: () => new Response('att1', { status: 200 }) },
    ]);
    const { onSaved } = await renderPanel({ context: { ...WORKITEM, validateOnSave: true } });
    setControlValue(selectEl(), 'att1', 'change');
    await vi.waitFor(() => expect(editorTextarea().value).toBe('{"a": 1}'));
    ($('#edit-json-button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(($('#save-json-button') as HTMLButtonElement).disabled).toBe(false));
    setControlValue(editorTextarea(), '{ invalid', 'input');
    ($('#save-json-button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect($('#json-validation-result')!.className).toContain('validation-fail'));
    expect(onSaved).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
  });

  it('surfaces a server error on save and returns to view mode', async () => {
    installFetchMock([
      {
        method: 'GET',
        match: /\/attachments\/att1\/content$/,
        respond: () => new Response('{"a": 1}', { status: 200 }),
      },
      { method: 'PATCH', match: /\/attachments\/att1$/, respond: () => new Response('save denied', { status: 500 }) },
    ]);
    const { onSaved } = await renderPanel();
    setControlValue(selectEl(), 'att1', 'change');
    await vi.waitFor(() => expect(editorTextarea().value).toBe('{"a": 1}'));
    ($('#edit-json-button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(($('#save-json-button') as HTMLButtonElement).disabled).toBe(false));
    ($('#save-json-button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect($('#error-message')!.textContent).toContain('save denied'));
    expect(onSaved).not.toHaveBeenCalled();
    // Back to view mode: Edit enabled again, Save disabled.
    expect(($('#edit-json-button') as HTMLButtonElement).disabled).toBe(false);
    expect(($('#save-json-button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows an error and keeps Edit disabled when the attachment content fails to load', async () => {
    installFetchMock([
      {
        method: 'GET',
        match: /\/attachments\/att1\/content$/,
        respond: () => new Response('not found', { status: 404 }),
      },
    ]);
    await renderPanel();
    setControlValue(selectEl(), 'att1', 'change');
    await vi.waitFor(() => expect($('#error-message')!.textContent).toContain('not found'));
    expect(($('#edit-json-button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('confirms before cancelling an existing-file edit and reloads the original content', async () => {
    let getCalls = 0;
    installFetchMock([
      {
        method: 'GET',
        match: /\/attachments\/att1\/content$/,
        respond: () => {
          getCalls += 1;
          return new Response('{"a": 1}', { status: 200 });
        },
      },
    ]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await renderPanel();
    setControlValue(selectEl(), 'att1', 'change');
    await vi.waitFor(() => expect(getCalls).toBe(1));
    ($('#edit-json-button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(($('#cancel-edit-json-button') as HTMLButtonElement).disabled).toBe(false));
    ($('#cancel-edit-json-button') as HTMLButtonElement).click();
    // Confirm was asked, and the original content was re-fetched (a second GET).
    await vi.waitFor(() => expect(getCalls).toBe(2));
    expect(confirmSpy).toHaveBeenCalled();
    expect(($('#cancel-edit-json-button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('cancels a new-file edit without a confirm prompt', async () => {
    installFetchMock([]);
    await renderPanel();
    setControlValue(selectEl(), NEW_FILE, 'change');
    setControlValue($('#new-file-input') as HTMLInputElement, 'brandnew', 'input');
    await vi.waitFor(() => expect(($('#edit-json-button') as HTMLButtonElement).disabled).toBe(false));
    ($('#edit-json-button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(($('#cancel-edit-json-button') as HTMLButtonElement).disabled).toBe(false));
    ($('#cancel-edit-json-button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(($('#cancel-edit-json-button') as HTMLButtonElement).disabled).toBe(true));
    // Selector re-enabled after leaving edit mode.
    expect(selectEl().disabled).toBe(false);
  });
});
