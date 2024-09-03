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

const editorSelector = document.getElementById("editor-selector");
if (editorSelector?.value) {
    codeEditor.setValue(editorSelector.getElementsByTagName("option")[0].value);
} else {
    codeEditor.setValue("");
}
codeEditor.setAutoCompleteHandler(new JsonAutoComplete());
codeEditor.create();

// make it global
globalThis.jsonCodeEditor = codeEditor;

document.getElementById("editor-selector").dispatchEvent(new Event("change"));