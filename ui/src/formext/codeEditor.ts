// Thin typed wrapper over the vendored petrel code editor (src/vendor), highlight.js and jsonlint,
// reproducing the setup the legacy hljs-editor.js did (readonly, 2-space tabs, JSON highlighting +
// autocompletion) but mounting into an element handed in by React instead of document.getElementById.
import hljsCore from '../vendor/highlight/core.min.js';
import hljsJson from '../vendor/highlight/json.js';
import jsonlint from '../vendor/jsonlint.js';
import CodeEditor from '../vendor/petrel/CodeEditor.js';
import JsonAutoComplete from '../vendor/petrel/JsonAutoComplete.js';

/** The subset of the petrel CodeEditor API the panel uses. */
export interface JsonCodeEditor {
  setValue(value: string): void;
  getValue(): string;
  setLinesWithError(lines: number[]): void;
  update(): void;
  readonly: boolean;
}

interface Highlighter {
  registerLanguage(name: string, language: unknown): void;
  highlight(code: string, options: { language: string; ignoreIllegals: boolean }): { value: string };
}

interface JsonLint {
  parse(input: string): unknown;
}

const hljs = hljsCore as unknown as Highlighter;

// Register the JSON grammar once (idempotent - highlight.js overwrites an existing registration).
hljs.registerLanguage('json', hljsJson);

/**
 * Creates a petrel code editor inside `element`, configured for JSON exactly as the legacy panel:
 * readonly on creation, 2-space tabs, highlight.js JSON highlighting and JSON autocompletion.
 */
export function createJsonCodeEditor(element: HTMLElement): JsonCodeEditor {
  const editor = new CodeEditor(element, { readonly: true, tabSize: 2 });
  editor.setHighlighter((code: string) => hljs.highlight(code, { language: 'json', ignoreIllegals: true }).value);
  editor.setValue('');
  editor.setAutoCompleteHandler(new JsonAutoComplete());
  editor.create();
  return editor as JsonCodeEditor;
}

export interface ValidationOutcome {
  valid: boolean;
  /** Present when invalid: the parser's error message. */
  message?: string;
  /** Present when invalid and the message pinpoints a line: the 0-based line index to mark. */
  errorLine?: number;
}

/**
 * Validates JSON with jsonlint, mirroring the legacy validateJson(): on failure it extracts the
 * 0-based error line from the "...error on line N:..." message so the editor can mark it.
 */
export function validateJsonContent(content: string): ValidationOutcome {
  try {
    (jsonlint as JsonLint).parse(content);
    return { valid: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const match = message.match(/error on line (?<linenumber>\d+):/);
    const errorLine = match?.groups ? Number.parseInt(match.groups.linenumber, 10) - 1 : undefined;
    return { valid: false, message, errorLine };
  }
}
