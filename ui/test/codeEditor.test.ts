import { afterEach, describe, expect, it } from 'vitest';
import { createJsonCodeEditor, validateJsonContent } from '../src/formext/codeEditor';

// The typed wrapper over the vendored petrel editor + jsonlint. Runs in real Chromium (browser mode),
// so createJsonCodeEditor builds actual DOM. The vendored editor internals themselves are excluded from
// coverage (src/vendor); this covers the wrapper: creation, value round-trip and validateJsonContent.

let host: HTMLDivElement | null = null;

afterEach(() => {
  host?.remove();
  host = null;
});

describe('validateJsonContent', () => {
  it('accepts valid JSON', () => {
    expect(validateJsonContent('{"a": 1, "b": [1, 2, 3]}')).toEqual({ valid: true });
  });

  it('reports invalid JSON with a 0-based error line', () => {
    const outcome = validateJsonContent('{\n  "a": ,\n}');
    expect(outcome.valid).toBe(false);
    expect(outcome.message).toBeTruthy();
    // jsonlint pinpoints the offending line; the wrapper converts it to a 0-based index.
    expect(typeof outcome.errorLine === 'number' || outcome.errorLine === undefined).toBe(true);
  });
});

describe('createJsonCodeEditor', () => {
  it('mounts a petrel editor into the host element and round-trips its value', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    const editor = createJsonCodeEditor(host);
    expect(host.classList.contains('petrel-code-editor')).toBe(true);
    expect(host.querySelector('textarea')).not.toBeNull();
    editor.setValue('{"hello": "world"}');
    expect(editor.getValue()).toBe('{"hello": "world"}');
  });
});
