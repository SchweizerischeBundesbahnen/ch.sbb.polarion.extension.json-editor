import { useCallback, useEffect, useRef, useState } from 'react';
import { SearchableSelect } from '@grigoriev/react-sbb-polarion';
import useRemote from '../services/useRemote';
import { createJsonCodeEditor, validateJsonContent } from './codeEditor';
import type { JsonCodeEditor } from './codeEditor';
import { createAttachment, getAttachmentContent, updateAttachment } from './restApi';
import type { Attachment, PanelContext } from './types';
import validateIcon from './validate.svg';

// Sentinel selector value for "create a new file" (distinct from '' = nothing selected). The legacy
// select used an empty-value <option>New</option>, which collided with the allowEmpty "no selection"
// state; a dedicated sentinel removes that ambiguity.
const NEW_FILE = '__new__';

interface JsonEditorPanelProps {
  /** WorkItem / Document context. Must be stable across renders (memoize in the parent). */
  context: PanelContext;
  /** Existing JSON attachments, computed server-side and embedded in the fragment. */
  attachments: Attachment[];
  /** Called after a successful save. Defaults to reloading the page (the legacy behavior: the reloaded
   *  editor form re-renders with the new/updated attachment). Overridden in dev/tests. */
  onSaved?: () => void;
}

interface ValidationState {
  text: string;
  kind: 'pass' | 'fail';
}

/**
 * React port of the legacy WorkItem / Document Properties JSON editor panel (json-editor.html +
 * json-editor.js). The shell (file selector, new-file name + warnings, Edit / Validate / Save / Cancel
 * and the validation result) is React; the code editor itself is the vendored petrel editor mounted
 * into the container below (see codeEditor.ts). The markup keeps the legacy ids/classes so the panel's
 * own CSS (petrel.css / highlightjs.css / json-editor.css, injected into the shadow root) styles it
 * unchanged.
 */
export default function JsonEditorPanel({ context, attachments, onSaved }: JsonEditorPanelProps) {
  const { sendRequest } = useRemote();

  const [selectedId, setSelectedId] = useState<string>('');
  const [newFileName, setNewFileName] = useState<string>('');
  const [editing, setEditing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [contentLoadFailed, setContentLoadFailed] = useState<boolean>(false);
  const [validation, setValidation] = useState<ValidationState | null>(null);

  const editorHostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<JsonCodeEditor | null>(null);

  // spaceId set (Document) -> no prefix; WorkItem -> "<workItemId>-".
  const prefix = context.spaceId ? '' : `${context.entityId}-`;
  const isNew = selectedId === NEW_FILE;
  const existingSelected = selectedId !== '' && selectedId !== NEW_FILE;

  const duplicatesExistingFileName = useCallback(
    (name: string) => {
      const target = `${prefix}${name}.json`;
      return attachments.some((a) => a.fileName === target);
    },
    [attachments, prefix],
  );

  const duplicate = isNew && duplicatesExistingFileName(newFileName);
  const nameValid = isNew && !!newFileName && !duplicate;
  const editEnabled = !editing && !saving && !contentLoadFailed && (existingSelected || nameValid);

  let warning = '';
  if (!editing && isNew) {
    if (!newFileName) {
      warning = 'In order to start editing please enter new file name above or choose one of existing files';
    } else if (duplicate) {
      warning = 'Entered file name clashes with existent file names, please enter unique name';
    }
  }

  // Load an attachment's content into the editor (empty for "nothing" / "New").
  const loadContent = useCallback(
    async (id: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      setContentLoadFailed(false);
      setErrorMessage(null);
      if (!id || id === NEW_FILE) {
        editor.setValue('');
        return;
      }
      try {
        editor.setValue(await getAttachmentContent(sendRequest, context, id));
      } catch (e) {
        setContentLoadFailed(true);
        setErrorMessage(e instanceof Error ? e.message : String(e));
      }
    },
    [sendRequest, context],
  );

  // Create the petrel editor once. replaceChildren guards against React StrictMode's double-invoke.
  useEffect(() => {
    const host = editorHostRef.current;
    if (!host) return;
    host.replaceChildren();
    editorRef.current = createJsonCodeEditor(host);
    return () => {
      editorRef.current = null;
      host.replaceChildren();
    };
  }, []);

  // Load content whenever the selection changes.
  useEffect(() => {
    void loadContent(selectedId);
  }, [selectedId, loadContent]);

  const runValidate = (): boolean => {
    const editor = editorRef.current;
    if (!editor) return false;
    editor.setLinesWithError([]);
    const outcome = validateJsonContent(editor.getValue());
    if (outcome.valid) {
      setValidation({ text: 'JSON is valid!', kind: 'pass' });
    } else {
      setValidation({ text: outcome.message ?? 'Invalid JSON', kind: 'fail' });
      if (outcome.errorLine !== undefined) {
        editor.setLinesWithError([outcome.errorLine]);
      }
    }
    editor.update();
    return outcome.valid;
  };

  const handleSelectChange = (id: string) => {
    setSelectedId(id);
    setEditing(false);
    setValidation(null);
    setErrorMessage(null);
  };

  const handleEdit = () => {
    const editor = editorRef.current;
    if (!editor) return;
    setErrorMessage(null);
    setValidation(null);
    setEditing(true);
    editor.readonly = false;
  };

  const handleSave = async () => {
    const editor = editorRef.current;
    if (!editor) return;
    if (context.validateOnSave && !runValidate()) {
      return;
    }
    setSaving(true);
    setErrorMessage(null);
    editor.readonly = true;
    try {
      let attachmentId = selectedId;
      if (isNew) {
        attachmentId = await createAttachment(sendRequest, context, `${prefix}${newFileName}.json`);
      }
      await updateAttachment(sendRequest, context, attachmentId, editor.getValue());
      (onSaved ?? (() => document.location.reload()))();
    } catch (e) {
      // Back to view mode so the user can fix and retry (mirrors the legacy error handling, which
      // re-enabled the Edit button and hid the validation result).
      setEditing(false);
      setValidation(null);
      setErrorMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (existingSelected && !window.confirm('Are you sure you want to cancel editing and revert changes?')) {
      return;
    }
    setEditing(false);
    setValidation(null);
    setErrorMessage(null);
    const editor = editorRef.current;
    if (editor) {
      editor.readonly = true;
      editor.setLinesWithError([]);
      editor.update();
    }
    // Existing file: reload its content (discarding edits). New file: leave the buffer as-is.
    if (existingSelected) {
      void loadContent(selectedId);
    }
  };

  const options = [...attachments.map((a) => ({ id: a.id, name: a.fileName })), { id: NEW_FILE, name: 'New' }];
  const newFileVisibility = isNew ? 'visible' : 'hidden';

  return (
    <>
      <div className="selector-wrapper form-wrapper">
        <label htmlFor="editor-selector">File:</label>
        <SearchableSelect
          id="editor-selector"
          value={selectedId}
          onChange={handleSelectChange}
          options={options}
          placeholder=""
          allowEmpty
          disabled={editing || saving}
        />
        <span className="new-file-name" id="new-file-name-prefix" style={{ visibility: newFileVisibility }}>
          {prefix}
        </span>
        <input
          type="text"
          id="new-file-input"
          className="new-file-name"
          style={{ visibility: newFileVisibility }}
          value={newFileName}
          disabled={editing || saving}
          onChange={(e) => {
            setNewFileName(e.target.value);
            setErrorMessage(null);
          }}
        />
        <span className="new-file-name ml-2" style={{ visibility: newFileVisibility }}>
          .json
        </span>
      </div>
      <div>
        <span id="editor-warning" style={{ display: warning ? 'block' : 'none' }}>
          {warning}
        </span>
        <span id="error-message" style={{ display: errorMessage ? 'block' : 'none' }}>
          {errorMessage}
        </span>
      </div>

      <div className="editor-buttons">
        <button type="button" id="edit-json-button" disabled={!editEnabled} onClick={handleEdit}>
          <span className="sbb-icon-edit" role="img" aria-label="edit"></span>Edit
        </button>
        <button type="button" className="divider">
          &nbsp;
        </button>
        <button type="button" id="validate-json-button" disabled={!editing} onClick={runValidate}>
          <img src={validateIcon} alt="reviewed" />
          Validate
        </button>
        <button type="button" id="save-json-button" disabled={!editing || saving} onClick={handleSave}>
          <span className="sbb-icon-save" role="img" aria-label="save"></span>Save
        </button>
        <button type="button" id="cancel-edit-json-button" disabled={!editing || saving} onClick={handleCancel}>
          <span className="sbb-icon-cancel" role="img" aria-label="cancel"></span>Cancel
        </button>
      </div>
      <div className="validation-result">
        {validation && (
          <span
            id="json-validation-result"
            className={validation.kind === 'pass' ? 'validation-pass' : 'validation-fail'}
          >
            {validation.text}
          </span>
        )}
      </div>
      <div className="editor-wrapper">
        <div id="jsonCodeEditor" ref={editorHostRef}></div>
      </div>
    </>
  );
}
