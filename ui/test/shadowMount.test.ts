import { afterEach, describe, expect, it } from 'vitest';
import { mountInShadow } from '../src/formext/shadowMount';

// mountInShadow is exercised end-to-end through mount.tsx, but only ever with a full options object.
// This covers its option branches directly: the default (no options) path, an existing-vs-fresh shadow
// root, the container class, and the injected panel <style> elements. Runs in real Chromium, so the
// shadow root and its styles are real DOM.

let host: HTMLDivElement | null = null;

afterEach(() => {
  host?.remove();
  host = null;
});

describe('mountInShadow', () => {
  it('attaches a shadow root and returns a container, using defaults when no options are given', () => {
    host = document.createElement('div');
    document.body.appendChild(host);

    const container = mountInShadow(host);

    expect(host.shadowRoot).not.toBeNull();
    expect(container.parentNode).toBe(host.shadowRoot);
    // No containerClassName provided -> the container has no class.
    expect(container.className).toBe('');
    // Only the two base <style> elements (react-sbb-polarion bundle + the .sbb-ui base font); no panel CSS.
    expect(host.shadowRoot!.querySelectorAll('style').length).toBe(2);
  });

  it('applies the container class, injects each panel stylesheet, and reuses an existing shadow root', () => {
    host = document.createElement('div');
    document.body.appendChild(host);

    const first = mountInShadow(host, { containerClassName: 'sbb-ui app', styleTexts: ['.a{}', '.b{}'] });
    expect(first.className).toBe('sbb-ui app');
    // Two base styles + two injected panel styles.
    expect(host.shadowRoot!.querySelectorAll('style').length).toBe(4);

    // Re-mounting reuses the existing shadow root (the `host.shadowRoot ??` branch) and clears it first.
    const shadow = host.shadowRoot;
    const second = mountInShadow(host, { styleTexts: [] });
    expect(host.shadowRoot).toBe(shadow);
    expect(second.parentNode).toBe(shadow);
    // Cleared and re-populated: back to just the two base styles (empty styleTexts adds none).
    expect(shadow!.querySelectorAll('style').length).toBe(2);
  });
});
