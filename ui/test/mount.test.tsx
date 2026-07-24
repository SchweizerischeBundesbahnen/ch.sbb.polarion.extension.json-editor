import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountJsonEditorPanel } from '../src/formext/mount';
import { installFetchMock } from './mockFetch';

// The form-extension mount glue: mountJsonEditorPanel reads the context + attachments from the host's
// data-* attributes and mounts the panel inside a shadow root (shadowMount). Exercised against a real
// Chromium shadow root.

let host: HTMLDivElement | null = null;

function makeHost(attachmentsJson: string): HTMLDivElement {
  const el = document.createElement('div');
  el.id = 'json-editor-panel';
  el.dataset.projectId = 'proj';
  el.dataset.entityId = 'WI1';
  el.dataset.spaceId = '';
  el.dataset.validateOnSave = 'true';
  el.dataset.attachments = attachmentsJson;
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  host?.remove();
  host = null;
  vi.unstubAllGlobals();
});

describe('mountJsonEditorPanel', () => {
  it('returns undefined and logs when the target is missing', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(mountJsonEditorPanel('#does-not-exist')).toBeUndefined();
    expect(err).toHaveBeenCalled();
  });

  it('mounts the panel into a shadow root, reading context + attachments from data-* attributes', async () => {
    installFetchMock([]);
    host = makeHost('[{"id":"att1","fileName":"WI1-a.json"}]');
    const root = mountJsonEditorPanel('#json-editor-panel');
    expect(root).toBeDefined();
    expect(host.shadowRoot).not.toBeNull();

    // The panel rendered inside the shadow root, and the embedded attachment became an option
    // (alongside the "New" entry).
    const select = await vi.waitFor(() => {
      const el = host!.shadowRoot!.querySelector<HTMLSelectElement>('#editor-selector');
      expect(el).not.toBeNull();
      return el!;
    });
    const optionLabels = Array.from(select.querySelectorAll('option'))
      .map((o) => o.textContent)
      .filter(Boolean);
    expect(optionLabels).toContain('WI1-a.json');
    expect(optionLabels).toContain('New');
    root?.unmount();
  });

  it('reads default context values when data-* attributes are absent, and reuses the shadow root on re-mount', async () => {
    installFetchMock([]);
    // Bare host: only an id, no data-* attributes -> readContext falls back to '' / validateOnSave=false
    // and readAttachments parses the missing attribute as [].
    host = document.createElement('div');
    host.id = 'json-editor-panel';
    document.body.appendChild(host);

    const first = mountJsonEditorPanel('#json-editor-panel');
    await vi.waitFor(() => expect(host!.shadowRoot!.querySelector('#editor-selector')).not.toBeNull());
    const shadow = host.shadowRoot;
    first?.unmount();

    // Re-mounting on the same host reuses the existing shadow root (the `host.shadowRoot ??` branch).
    const second = mountJsonEditorPanel('#json-editor-panel');
    await vi.waitFor(() => expect(host!.shadowRoot!.querySelector('#editor-selector')).not.toBeNull());
    expect(host.shadowRoot).toBe(shadow);
    second?.unmount();
  });

  it('falls back to an empty attachment list when data-attachments is not valid JSON', async () => {
    installFetchMock([]);
    host = makeHost('not-json');
    const root = mountJsonEditorPanel('#json-editor-panel');
    const select = await vi.waitFor(() => {
      const el = host!.shadowRoot!.querySelector<HTMLSelectElement>('#editor-selector');
      expect(el).not.toBeNull();
      return el!;
    });
    // Only the "New" option (no attachments parsed).
    const labels = Array.from(select.querySelectorAll('option'))
      .map((o) => o.textContent)
      .filter(Boolean);
    expect(labels).toEqual(['New']);
    root?.unmount();
  });
});
