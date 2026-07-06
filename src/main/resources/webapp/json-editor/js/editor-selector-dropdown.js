import SearchableDropdown from "/polarion/json-editor/ui/generic/js/modules/SearchableDropdown.js";

// Upgrade the native "File" selector to the shared Polarion 2606 searchable dropdown.
// Element-mode mirrors the selection back to the underlying <select> and forwards `change`,
// so json-editor.js keeps reading `.value`/`.options` and its change listener still fires.
// SD's own MutationObserver watches the <select>'s `disabled` attribute, so the trigger stays
// in sync when json-editor.js disables the selector while editing.
function upgradeEditorSelector() {
    const select = document.getElementById("editor-selector");
    if (select && !select._searchableDropdown) {
        new SearchableDropdown({element: select, rememberSelection: false});
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", upgradeEditorSelector);
} else {
    upgradeEditorSelector();
}
