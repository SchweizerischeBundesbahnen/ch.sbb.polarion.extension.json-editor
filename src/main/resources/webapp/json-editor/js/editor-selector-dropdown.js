import SearchableDropdown from "../generic/js/modules/SearchableDropdown.js";

// Upgrade the native "File" selector to the shared Polarion 2606 searchable dropdown.
// Element-mode mirrors the selection back to the underlying <select> and forwards `change`,
// so json-editor.js keeps reading `.value`/`.options` and its change listener still fires.
// SD's own MutationObserver watches the <select>'s `disabled` attribute, so the trigger stays
// in sync when json-editor.js disables the selector while editing.
function upgradeEditorSelector() {
    const select = document.getElementById("editor-selector");
    if (select && !select._searchableDropdown) {
        // allowEmpty so the combobox does not auto-select the first file: the Java form renders the
        // <option>s without a `selected` attribute, so "nothing selected" is the intended default —
        // the user picks a file (or New) to start editing.
        new SearchableDropdown({element: select, rememberSelection: false, allowEmpty: true});
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", upgradeEditorSelector);
} else {
    upgradeEditorSelector();
}
