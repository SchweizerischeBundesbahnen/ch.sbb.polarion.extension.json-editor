import { pageViolations } from '@sbb-polarion/react-sbb-polarion/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import JsonEditorPanel from '../src/formext/JsonEditorPanel';
import type { Attachment, PanelContext } from '../src/formext/types';
import { installFetchMock } from './mockFetch';
import type { FetchMock } from './mockFetch';

// Behavior of the JSON editor panel shell, ported from the legacy json-editor.js. Rendered directly
// with an explicit context + attachments (the same props mount.tsx reads from the fragment). REST is
// mocked at the fetch boundary; the vendored petrel editor runs for real in Chromium.

const WORKITEM: PanelContext = { projectId: 'proj', entityId: 'WI1', spaceId: '', validateOnSave: false };
const DOCUMENT: PanelContext = { projectId: 'proj', entityId: 'Doc', spaceId: 'Space', validateOnSave: false };
const ATTACHMENTS: Attachment[] = [{ id: 'att1', fileName: 'WI1-existing.json' }];
const TWO_ATTACHMENTS: Attachment[] = [...ATTACHMENTS, { id: 'att2', fileName: 'WI1-second.json' }];
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

/** Answer the confirmation dialog the panel renders in place of the former window.confirm. */
async function answerDialog(label: 'OK' | 'Cancel') {
  await vi.waitFor(() => expect(document.querySelector('.rsp-modal')).not.toBeNull());
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>('.rsp-modal-footer .sbb-btn')).find(
    (b) => (b.textContent ?? '').trim() === label,
  );
  if (!button) throw new Error(`dialog button "${label}" not found`);
  button.click();
}

const editorTextarea = () => $('#jsonCodeEditor textarea') as HTMLTextAreaElement;
const selectEl = () => $('#editor-selector') as HTMLSelectElement;
const button = (action: 'edit' | 'validate' | 'save' | 'cancel-edit') =>
  $(`#${action}-json-button`) as HTMLButtonElement;
const waitForEnabled = (action: Parameters<typeof button>[0]) =>
  vi.waitFor(() => expect(button(action).disabled).toBe(false));
const waitForError = (text: string) => vi.waitFor(() => expect($('#error-message')!.textContent).toContain(text));

/** Picks an entry of the file selector and waits until React has applied it. */
async function selectFile(id: string) {
  setControlValue(selectEl(), id, 'change');
  await vi.waitFor(() => expect(selectEl().value).toBe(id));
}

async function clickEdit() {
  await waitForEnabled('edit');
  button('edit').click();
  await waitForEnabled('save');
}

/** Lets the panel handle a response that must have no effect, and React render the result. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

/** A response whose body stays pending until `complete` is called. */
function pendingResponse(status = 200) {
  let body!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({ start: (controller) => void (body = controller) });
  const response = new Response(stream, { status });
  const read = vi.spyOn(response, 'text');
  return {
    response,
    waitUntilRequested: () => vi.waitFor(() => expect(read).toHaveBeenCalled()),
    complete: async (text: string) => {
      body.enqueue(new TextEncoder().encode(text));
      body.close();
      await read.mock.results[0].value;
      await settle();
    },
  };
}

/** A GET route of an attachment's content that answers with the given responses, one per request. */
function contentRoute(id: string, ...responses: (string | Response)[]) {
  return {
    method: 'GET',
    match: new RegExp(`/attachments/${id}/content$`),
    respond: () => {
      const next = responses.shift();
      if (next === undefined) return new Response(`unexpected content request of ${id}`, { status: 500 });
      return typeof next === 'string' ? new Response(next, { status: 200 }) : next;
    },
  };
}

/** The requests of one method, as "<last URL segment>" plus the form fields that were sent. */
function requests(fetchMock: FetchMock, method: string) {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method === method)
    .map(([url, init]) => ({
      target: String(url).split('/').pop(),
      fields: init?.body instanceof FormData ? Object.fromEntries(init.body.entries()) : {},
    }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('JsonEditorPanel', () => {
  it('keeps the toolbar separator out of the tab order and the accessibility tree', async () => {
    installFetchMock([]);
    await renderPanel();
    const divider = document.querySelector('.editor-buttons .divider')!;
    // A decoration, not a control. A <button> here would be a nameless tab stop.
    expect(divider.tagName).toBe('SPAN');
    expect(divider.getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelectorAll('.editor-buttons button')).toHaveLength(4);
  });

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
    await waitForEnabled('edit');

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
    await waitForEnabled('edit');
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
    await waitForEnabled('edit');
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
    await waitForEnabled('edit');
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
    await waitForEnabled('edit');
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
    await renderPanel();
    setControlValue(selectEl(), 'att1', 'change');
    await vi.waitFor(() => expect(getCalls).toBe(1));
    await waitForEnabled('edit');
    ($('#edit-json-button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(($('#cancel-edit-json-button') as HTMLButtonElement).disabled).toBe(false));
    ($('#cancel-edit-json-button') as HTMLButtonElement).click();
    // The dialog was confirmed, and the original content was re-fetched (a second GET).
    await answerDialog('OK');
    await vi.waitFor(() => expect(getCalls).toBe(2));
    expect(($('#cancel-edit-json-button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('stays in edit mode when the cancel confirm is declined', async () => {
    installFetchMock([{ method: 'GET', match: /\/attachments\/att1\/content$/, respond: () => new Response('{}') }]);
    await renderPanel();
    setControlValue(selectEl(), 'att1', 'change');
    await vi.waitFor(() => expect(($('#edit-json-button') as HTMLButtonElement).disabled).toBe(false));
    ($('#edit-json-button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(($('#cancel-edit-json-button') as HTMLButtonElement).disabled).toBe(false));

    ($('#cancel-edit-json-button') as HTMLButtonElement).click();
    // Dismissing the dialog must leave the edit untouched, not silently discard it.
    await answerDialog('Cancel');
    expect(($('#cancel-edit-json-button') as HTMLButtonElement).disabled).toBe(false);
    expect(selectEl().disabled).toBe(true);
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

describe('JsonEditorPanel, content loading', () => {
  it('keeps Edit disabled until the content is loaded', async () => {
    const first = pendingResponse();
    installFetchMock([contentRoute('att1', first.response)]);
    await renderPanel();
    await selectFile('att1');
    await first.waitUntilRequested();
    expect(button('edit').disabled).toBe(true);
    await first.complete('{"a": 1}');
    expect(editorTextarea().value).toBe('{"a": 1}');
    expect(button('edit').disabled).toBe(false);
  });

  it('disables Edit again while the next attachment loads', async () => {
    const second = pendingResponse();
    installFetchMock([contentRoute('att1', '{"a": 1}'), contentRoute('att2', second.response)]);
    await renderPanel({ attachments: TWO_ATTACHMENTS });
    await selectFile('att1');
    await waitForEnabled('edit');
    await selectFile('att2');
    // The editor still shows att1 here, so an edit would save the content of att1 into att2.
    expect(button('edit').disabled).toBe(true);
    await second.waitUntilRequested();
    expect(button('edit').disabled).toBe(true);
    await second.complete('{"b": 2}');
    expect(editorTextarea().value).toBe('{"b": 2}');
    expect(button('edit').disabled).toBe(false);
  });

  it('ignores the late content of the previous attachment', async () => {
    const first = pendingResponse();
    installFetchMock([contentRoute('att1', first.response), contentRoute('att2', '{"b": 2}')]);
    await renderPanel({ attachments: TWO_ATTACHMENTS });
    await selectFile('att1');
    await first.waitUntilRequested();
    await selectFile('att2');
    await waitForEnabled('edit');
    await first.complete('{"a": 1}');
    expect(editorTextarea().value).toBe('{"b": 2}');
    expect(button('edit').disabled).toBe(false);
  });

  it('ignores the late error of the previous attachment', async () => {
    const first = pendingResponse(404);
    installFetchMock([contentRoute('att1', first.response), contentRoute('att2', '{"b": 2}')]);
    await renderPanel({ attachments: TWO_ATTACHMENTS });
    await selectFile('att1');
    await first.waitUntilRequested();
    await selectFile('att2');
    await waitForEnabled('edit');
    await first.complete('not found');
    expect($('#error-message')!.style.display).toBe('none');
    expect(button('edit').disabled).toBe(false);
  });

  it('does not enable Edit when the previous attachment loads before the selected one', async () => {
    const first = pendingResponse();
    const second = pendingResponse();
    installFetchMock([contentRoute('att1', first.response), contentRoute('att2', second.response)]);
    await renderPanel({ attachments: TWO_ATTACHMENTS });
    await selectFile('att1');
    await first.waitUntilRequested();
    await selectFile('att2');
    await second.waitUntilRequested();
    await first.complete('{"a": 1}');
    expect(editorTextarea().value).toBe('');
    expect(button('edit').disabled).toBe(true);
    await second.complete('{"b": 2}');
    expect(editorTextarea().value).toBe('{"b": 2}');
    expect(button('edit').disabled).toBe(false);
  });

  it('keeps the error of the selected attachment when the previous one loads late', async () => {
    const first = pendingResponse();
    installFetchMock([
      contentRoute('att1', first.response),
      contentRoute('att2', new Response('not found', { status: 404 })),
    ]);
    await renderPanel({ attachments: TWO_ATTACHMENTS });
    await selectFile('att1');
    await first.waitUntilRequested();
    await selectFile('att2');
    await waitForError('not found');
    await first.complete('{"a": 1}');
    expect($('#error-message')!.textContent).toBe('not found');
    expect(editorTextarea().value).toBe('');
    expect(button('edit').disabled).toBe(true);
  });

  it('uses the newer request when the same attachment is selected again', async () => {
    const older = pendingResponse();
    const newer = pendingResponse();
    installFetchMock([contentRoute('att1', older.response, newer.response), contentRoute('att2', '{"b": 2}')]);
    await renderPanel({ attachments: TWO_ATTACHMENTS });
    await selectFile('att1');
    await older.waitUntilRequested();
    await selectFile('att2');
    await waitForEnabled('edit');
    await selectFile('att1');
    await newer.waitUntilRequested();
    await newer.complete('{"a": "newer"}');
    await older.complete('{"a": "older"}');
    expect(editorTextarea().value).toBe('{"a": "newer"}');
    expect(button('edit').disabled).toBe(false);
  });

  it('ignores the late content after the selection is cleared', async () => {
    const first = pendingResponse();
    installFetchMock([contentRoute('att1', first.response)]);
    await renderPanel();
    await selectFile('att1');
    await first.waitUntilRequested();
    await selectFile('');
    await first.complete('{"a": 1}');
    expect(editorTextarea().value).toBe('');
    expect(button('edit').disabled).toBe(true);
  });

  it('lets a new file be edited while an earlier load is pending, and keeps the typed text', async () => {
    const first = pendingResponse();
    installFetchMock([contentRoute('att1', first.response)]);
    await renderPanel();
    await selectFile('att1');
    await first.waitUntilRequested();
    await selectFile(NEW_FILE);
    setControlValue($('#new-file-input') as HTMLInputElement, 'brandnew', 'input');
    await clickEdit();
    setControlValue(editorTextarea(), '{"typed": true}', 'input');
    await first.complete('{"a": 1}');
    expect(editorTextarea().value).toBe('{"typed": true}');
    expect(button('save').disabled).toBe(false);
  });

  it('recovers from a failed load when the attachment is selected again', async () => {
    installFetchMock([contentRoute('att1', new Response('not found', { status: 404 }), '{"a": 1}')]);
    await renderPanel();
    await selectFile('att1');
    await waitForError('not found');
    await selectFile('');
    await selectFile('att1');
    await waitForEnabled('edit');
    expect(editorTextarea().value).toBe('{"a": 1}');
    expect($('#error-message')!.style.display).toBe('none');
  });

  it('keeps Edit disabled after a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await renderPanel();
    await selectFile('att1');
    await waitForError('Network error occurred');
    expect(button('edit').disabled).toBe(true);
  });

  it('keeps Edit disabled after Cancel until the original content is reloaded', async () => {
    const reload = pendingResponse();
    installFetchMock([contentRoute('att1', '{"a": 1}', reload.response)]);
    await renderPanel();
    await selectFile('att1');
    await clickEdit();
    setControlValue(editorTextarea(), '{"typed": true}', 'input');
    button('cancel-edit').click();
    await answerDialog('OK');
    await reload.waitUntilRequested();
    expect(button('edit').disabled).toBe(true);
    await reload.complete('{"a": 1}');
    expect(editorTextarea().value).toBe('{"a": 1}');
    expect(button('edit').disabled).toBe(false);
  });

  it('keeps Edit disabled when the reload after Cancel fails', async () => {
    installFetchMock([contentRoute('att1', '{"a": 1}', new Response('gone', { status: 404 }))]);
    await renderPanel();
    await selectFile('att1');
    await clickEdit();
    button('cancel-edit').click();
    await answerDialog('OK');
    await waitForError('gone');
    expect(button('edit').disabled).toBe(true);
  });
});

describe('JsonEditorPanel, retry of a failed save', () => {
  /** Answers the requests in order: an Error becomes an HTTP 500 with its message. */
  const inOrder = (...outcomes: (string | Error)[]) => {
    return () => {
      const next = outcomes.shift() ?? new Error('unexpected request');
      return typeof next === 'string' ? new Response(next) : new Response(next.message, { status: 500 });
    };
  };
  const postRoute = (...outcomes: (string | Error)[]) => ({
    method: 'POST',
    match: /\/attachments$/,
    respond: inOrder(...outcomes),
  });
  const patchRoute = (id: string, ...outcomes: (string | Error)[]) => ({
    method: 'PATCH',
    match: new RegExp(`/attachments/${id}$`),
    respond: inOrder(...outcomes),
  });

  const typeName = (name: string) => setControlValue($('#new-file-input') as HTMLInputElement, name, 'input');

  async function editNew(name: string, content: string) {
    await selectFile(NEW_FILE);
    typeName(name);
    await clickEdit();
    setControlValue(editorTextarea(), content, 'input');
  }

  async function saveAndExpectError(message: string) {
    button('save').click();
    await waitForError(message);
    // Back in view mode, ready for a retry.
    await waitForEnabled('edit');
    expect(button('save').disabled).toBe(true);
  }

  it('updates the already created attachment instead of creating another one', async () => {
    const fetchMock = installFetchMock([
      postRoute('newAtt'),
      patchRoute('newAtt', new Error('update failed'), 'newAtt'),
    ]);
    const { onSaved } = await renderPanel();
    await editNew('brandnew', '{"v": 1}');
    await saveAndExpectError('update failed');
    expect(onSaved).not.toHaveBeenCalled();
    // The failed save must not lose what the user typed.
    expect(editorTextarea().value).toBe('{"v": 1}');

    await clickEdit();
    setControlValue(editorTextarea(), '{"v": 2}', 'input');
    button('save').click();
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(requests(fetchMock, 'POST')).toEqual([{ target: 'attachments', fields: { fileName: 'WI1-brandnew.json' } }]);
    expect(requests(fetchMock, 'PATCH')).toEqual([
      { target: 'newAtt', fields: { content: '{"v": 1}' } },
      { target: 'newAtt', fields: { content: '{"v": 2}' } },
    ]);
  });

  it('keeps using the created attachment after several failures', async () => {
    const fetchMock = installFetchMock([
      postRoute('newAtt'),
      patchRoute('newAtt', new Error('failed once'), new Error('failed twice'), 'newAtt'),
    ]);
    const { onSaved } = await renderPanel();
    await editNew('brandnew', '{}');
    await saveAndExpectError('failed once');
    await clickEdit();
    await saveAndExpectError('failed twice');
    await clickEdit();
    button('save').click();
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(requests(fetchMock, 'POST')).toHaveLength(1);
    expect(requests(fetchMock, 'PATCH')).toHaveLength(3);
  });

  it('retries on a document, where the file name has no prefix', async () => {
    const fetchMock = installFetchMock([
      postRoute('newAtt'),
      patchRoute('newAtt', new Error('update failed'), 'newAtt'),
    ]);
    const { onSaved } = await renderPanel({ context: DOCUMENT, attachments: [] });
    await editNew('brandnew', '{}');
    await saveAndExpectError('update failed');
    await clickEdit();
    button('save').click();
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(requests(fetchMock, 'POST')).toEqual([{ target: 'attachments', fields: { fileName: 'brandnew.json' } }]);
    expect(requests(fetchMock, 'PATCH')).toHaveLength(2);
  });

  it('creates the attachment again when the creation itself failed', async () => {
    const fetchMock = installFetchMock([
      postRoute(new Error('create failed'), 'newAtt'),
      patchRoute('newAtt', 'newAtt'),
    ]);
    const { onSaved } = await renderPanel();
    await editNew('brandnew', '{}');
    await saveAndExpectError('create failed');
    expect(requests(fetchMock, 'PATCH')).toHaveLength(0);
    await clickEdit();
    button('save').click();
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(requests(fetchMock, 'POST')).toHaveLength(2);
    expect(requests(fetchMock, 'PATCH')).toHaveLength(1);
  });

  it('creates a separate attachment for another name, and reuses the first one for the first name', async () => {
    const fetchMock = installFetchMock([
      postRoute('attA', 'attB'),
      patchRoute('attA', new Error('A failed'), 'attA'),
      patchRoute('attB', new Error('B failed')),
    ]);
    const { onSaved } = await renderPanel();
    await editNew('a', '{}');
    await saveAndExpectError('A failed');
    typeName('b');
    await clickEdit();
    await saveAndExpectError('B failed');
    typeName('a');
    await clickEdit();
    button('save').click();
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(requests(fetchMock, 'POST').map((r) => r.fields.fileName)).toEqual(['WI1-a.json', 'WI1-b.json']);
    expect(requests(fetchMock, 'PATCH').map((r) => r.target)).toEqual(['attA', 'attB', 'attA']);
  });

  it('reuses the created attachment after the edit is cancelled', async () => {
    const fetchMock = installFetchMock([
      postRoute('newAtt'),
      patchRoute('newAtt', new Error('update failed'), 'newAtt'),
    ]);
    const { onSaved } = await renderPanel();
    await editNew('brandnew', '{}');
    await saveAndExpectError('update failed');
    await clickEdit();
    button('cancel-edit').click();
    await clickEdit();
    button('save').click();
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(requests(fetchMock, 'POST')).toHaveLength(1);
  });

  it('does not mix up the created attachment with an existing one that is selected in between', async () => {
    const fetchMock = installFetchMock([
      contentRoute('att1', '{"a": 1}'),
      postRoute('newAtt'),
      patchRoute('newAtt', new Error('update failed'), 'newAtt'),
      patchRoute('att1', new Error('att1 failed')),
    ]);
    const { onSaved } = await renderPanel();
    await editNew('brandnew', '{"v": 1}');
    await saveAndExpectError('update failed');
    await selectFile('att1');
    await clickEdit();
    await saveAndExpectError('att1 failed');
    // The name is still filled in; only the content has to be typed again.
    await editNew('brandnew', '{"v": 2}');
    button('save').click();
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(requests(fetchMock, 'POST')).toHaveLength(1);
    expect(requests(fetchMock, 'PATCH')).toEqual([
      { target: 'newAtt', fields: { content: '{"v": 1}' } },
      { target: 'att1', fields: { content: '{"a": 1}' } },
      { target: 'newAtt', fields: { content: '{"v": 2}' } },
    ]);
  });

  it('creates nothing while the content of a new file is invalid', async () => {
    const fetchMock = installFetchMock([postRoute('newAtt'), patchRoute('newAtt', 'newAtt')]);
    const { onSaved } = await renderPanel({ context: { ...WORKITEM, validateOnSave: true } });
    await editNew('brandnew', '{ invalid');
    button('save').click();
    await vi.waitFor(() => expect($('#json-validation-result')!.className).toContain('validation-fail'));
    expect(requests(fetchMock, 'POST')).toHaveLength(0);

    setControlValue(editorTextarea(), '{}', 'input');
    button('save').click();
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(requests(fetchMock, 'POST')).toHaveLength(1);
  });

  it('retries the update of an existing attachment with the edited content', async () => {
    const fetchMock = installFetchMock([
      contentRoute('att1', '{"a": 1}'),
      patchRoute('att1', new Error('update failed'), 'att1'),
    ]);
    const { onSaved } = await renderPanel();
    await selectFile('att1');
    await clickEdit();
    setControlValue(editorTextarea(), '{"a": 2}', 'input');
    await saveAndExpectError('update failed');
    await clickEdit();
    button('save').click();
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(requests(fetchMock, 'POST')).toHaveLength(0);
    expect(requests(fetchMock, 'PATCH').map((r) => r.fields.content)).toEqual(['{"a": 2}', '{"a": 2}']);
  });
});

describe('JsonEditorPanel, accessibility', () => {
  const existingContent = (body: string) => [
    { method: 'GET', match: /\/attachments\/att1\/content$/, respond: () => new Response(body, { status: 200 }) },
  ];

  async function editExisting() {
    setControlValue(selectEl(), 'att1', 'change');
    await waitForEnabled('edit');
    ($('#edit-json-button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(($('#validate-json-button') as HTMLButtonElement).disabled).toBe(false));
  }

  it('has no WCAG A/AA violations initially', async () => {
    installFetchMock([]);
    await renderPanel();
    expect(await pageViolations()).toEqual([]);
  });

  // axe accepts a placeholder as a name, so it would not catch a control that loses its label.
  it('names the file selector, the new file name and the editor', async () => {
    installFetchMock([]);
    await renderPanel();
    setControlValue(selectEl(), NEW_FILE, 'change');
    await vi.waitFor(() => expect(($('#new-file-input') as HTMLInputElement).style.visibility).toBe('visible'));
    expect($('.selector-wrapper .sd-trigger')).toHaveAccessibleName('File:');
    expect($('#new-file-input')).toHaveAccessibleName('New file name');
    expect(editorTextarea()).toHaveAccessibleName('JSON content');
  });

  it('has no WCAG A/AA violations with "New" picked and the name warning shown', async () => {
    installFetchMock([]);
    await renderPanel();
    setControlValue(selectEl(), NEW_FILE, 'change');
    await vi.waitFor(() => expect($('#editor-warning')!.style.display).toBe('block'));
    expect(await pageViolations()).toEqual([]);
  });

  it('has no WCAG A/AA violations in edit mode after a failed validation', async () => {
    installFetchMock(existingContent('{"a": 1}'));
    await renderPanel();
    await editExisting();
    setControlValue(editorTextarea(), '{ bad json', 'input');
    ($('#validate-json-button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect($('#json-validation-result')!.className).toContain('validation-fail'));
    expect(await pageViolations()).toEqual([]);
  });

  it('has no WCAG A/AA violations with a save error shown', async () => {
    installFetchMock([
      ...existingContent('{"a": 1}'),
      { method: 'PATCH', match: /\/attachments\/att1$/, respond: () => new Response('save denied', { status: 500 }) },
    ]);
    await renderPanel();
    await editExisting();
    ($('#save-json-button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect($('#error-message')!.style.display).toBe('block'));
    expect(await pageViolations()).toEqual([]);
  });

  it('has no WCAG A/AA violations with the cancel confirmation open', async () => {
    installFetchMock(existingContent('{"a": 1}'));
    await renderPanel();
    await editExisting();
    ($('#cancel-edit-json-button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector('.rsp-modal')).not.toBeNull());
    expect(await pageViolations()).toEqual([]);
  });
});
