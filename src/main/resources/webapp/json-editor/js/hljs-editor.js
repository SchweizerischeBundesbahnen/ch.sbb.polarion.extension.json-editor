import CodeEditor from './petrel/CodeEditor.js'
import JsonAutoComplete from './petrel/JsonAutoComplete.js'

import hljs from './highlight/core.min.js'
import json from './highlight/json.js'

hljs.registerLanguage('json', json);

const element = document.getElementById('jsonCodeEditor');
const codeEditor = new CodeEditor(element, {
    readonly: true,
    tabSize: 2
});

codeEditor.setHighlighter(code => hljs.highlight(code, {language: 'json', ignoreIllegals: true}).value);

// Start empty — the real file content is loaded by json-editor.js (getFileContent) once a file is
// chosen. Never seed the editor with the option value (that showed the file name as if it were
// content when a file was auto-selected).
codeEditor.setValue("");
codeEditor.setAutoCompleteHandler(new JsonAutoComplete());
codeEditor.create();

// make it global
globalThis.jsonCodeEditor = codeEditor;
