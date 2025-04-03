function saveJson(projectId, workItemId, validate) {
    if (validate === "false" || validateJson()) {
        document.getElementById("cancel-edit-json-button").disabled = 'true';
        document.getElementById("save-json-button").disabled = 'true';
        globalThis.jsonCodeEditor.readonly = true;
        const editorSelector = document.getElementById("editor-selector");
        const attachmentId = editorSelector.value;
        if (attachmentId !== "") {
            updateAttachment(projectId, workItemId, attachmentId);
        } else {
            const fileName = `${workItemId}-${SbbCommon.getValueById("new-file-input")}.json`;
            createAttachment(projectId, workItemId, fileName);
        }
    }
}

function updateAttachment(projectId, workItemId, attachmentId) {
    const formData = new FormData();
    formData.append("content", globalThis.jsonCodeEditor.getValue());
    SbbCommon.callAsync({
        method: 'PATCH',
        url: `/polarion/json-editor/rest/internal/projects/${projectId}/workitems/${workItemId}/attachments/${attachmentId}`,
        body: formData,
        onOk: (_event) => document.location.reload(),
        onError: (status, text) => {
            document.getElementById("validate-json-button").disabled = true;
            document.getElementById("json-validation-result").style.display = 'none';
            document.getElementById("edit-json-button").disabled = false;
            SbbCommon.showActionAlert({ containerId: 'error-message', message: text})
        }
    });
}

function createAttachment(projectId, workItemId, fileName) {
    const formData = new FormData();
    formData.append("fileName", fileName);
    SbbCommon.callAsync({
        method: 'POST',
        url: `/polarion/json-editor/rest/internal/projects/${projectId}/workitems/${workItemId}/attachments`,
        body: formData,
        onOk: (attachmentId) => updateAttachment(projectId, workItemId, attachmentId),
        onError: (status, text) => {
            document.getElementById("validate-json-button").disabled = true;
            document.getElementById("json-validation-result").style.display = 'none';
            document.getElementById("new-file-input").disabled = false;
            document.getElementById("edit-json-button").disabled = false;
            SbbCommon.showActionAlert({ containerId: 'error-message', message: text});
        }
    });
}

const handleEditJson = () => {
    document.getElementById('error-message').style.display = 'none';
    document.getElementById("editor-selector").disabled = true;
    document.getElementById("new-file-input").disabled = true;
    document.getElementById("edit-json-button").disabled = true;
    document.getElementById("cancel-edit-json-button").disabled = false;
    document.getElementById("save-json-button").disabled = false;
    document.getElementById("validate-json-button").disabled = false;
    globalThis.jsonCodeEditor.readonly = false;
}

const handleValidateJson = () => {
    validateJson();
}

const validateJson = () => {
    let result = false;
    globalThis.jsonCodeEditor.setLinesWithError([]);
    try {
        result = jsonlint.parse(globalThis.jsonCodeEditor.getValue());
        if (result) {
            document.getElementById("json-validation-result").innerText = "JSON is valid!";
            document.getElementById("json-validation-result").className = "validation-pass";
            document.getElementById("json-validation-result").style.display = "block";
        }
    } catch (e) {
        document.getElementById("json-validation-result").innerText = e.message;
        document.getElementById("json-validation-result").className = "validation-fail";
        document.getElementById("json-validation-result").style.display = "block";
        const match = e.message.match(/error on line (?<linenumber>\d+):/);
        if (match?.groups) {
            globalThis.jsonCodeEditor.setLinesWithError([Number.parseInt(match.groups.linenumber) - 1]);
        }
    }
    globalThis.jsonCodeEditor.update();
    return result;
}

const handleCancelEditJson = (projectId, workitemId) => {
    const selectedFile = SbbCommon.getValueById('editor-selector');
    if (!selectedFile || confirm("Are you sure you want to cancel editing and revert changes?")) {
        document.getElementById("editor-selector").disabled = false;
        document.getElementById("new-file-input").disabled = false;
        document.getElementById("edit-json-button").disabled = false;
        document.getElementById("cancel-edit-json-button").disabled = true;
        document.getElementById("save-json-button").disabled = true;
        document.getElementById("validate-json-button").disabled = true;
        document.getElementById("json-validation-result").style.display = "none";
        globalThis.jsonCodeEditor.readonly = true;
        if (selectedFile) {
            getFileContent(projectId, workitemId, selectedFile);
        }
        globalThis.jsonCodeEditor.setLinesWithError([]);
        globalThis.jsonCodeEditor.update();
    }
}

const handleEditorChange = (selectObject, projectId, workitemId) => {
    if (selectObject) {
        let newFileNameVisibility;
        if (selectObject.value) {
            newFileNameVisibility = 'hidden';
            document.getElementById("edit-json-button").disabled = false;
            updateWarning(SbbCommon.getValueById("new-file-input"));
        } else {
            newFileNameVisibility = 'visible';
            updateEditButtonEnablement(SbbCommon.getValueById("new-file-input"));
        }
        const newFileNameElements = document.getElementsByClassName("new-file-name");
        if (newFileNameElements) {
            for (const element of newFileNameElements) {
                element.style.visibility = newFileNameVisibility;
            }
        }
        getFileContent(projectId, workitemId, selectObject.value)
    }
}

function getFileContent(projectId, workItemId, attachmentId) {
    document.getElementById('error-message').style.display = 'none';
    if (attachmentId === undefined || attachmentId === "") {
        globalThis.jsonCodeEditor.setValue("");
        return;
    }
    SbbCommon.callAsync({
        method: 'GET',
        url: `/polarion/json-editor/rest/internal/projects/${projectId}/workitems/${workItemId}/attachments/${attachmentId}/content`,
        onOk: (responseText) => globalThis.jsonCodeEditor.setValue(responseText),
        onError: (status, text) => {
            document.getElementById("edit-json-button").disabled = true;
            SbbCommon.showActionAlert({containerId: 'error-message', message: text});
        }
    });
}

const updateEditButtonEnablement = (newFileName) => {
    document.getElementById('error-message').style.display = 'none';
    let editButtonEnabled = !!newFileName;
    if (duplicatesExistingFileName(newFileName)) {
        editButtonEnabled = false;
    }
    document.getElementById("edit-json-button").disabled = !editButtonEnabled;
    updateWarning(newFileName);
}

const updateWarning = (newFileName) => {
    const warning = document.getElementById("editor-warning");
    if (SbbCommon.getValueById('editor-selector')) {
        warning.style.display = 'none';
    } else if (!newFileName) {
        warning.innerText = "In order to start editing please enter new file name above or choose one of existing files";
        warning.style.display = 'block';
    } else if (duplicatesExistingFileName(newFileName)) {
        warning.innerText = "Entered file name clashes with existent file names, please enter unique name";
        warning.style.display = 'block';
    } else {
        warning.style.display = 'none';
    }
}

const duplicatesExistingFileName = (newFileName) => {
    const existentFileNames = document.getElementById('editor-selector').options;
    const fileNamePrefix = document.getElementById('new-file-name-prefix').innerText;
    for (const file of existentFileNames) {
        if (file.innerText === `${fileNamePrefix}${newFileName}.json`) {
            return true;
        }
    }
    return false;
}

(function () {
    function getBuildParam(src) {
        const buildParamIndex = src.indexOf("?buildId=");
        return buildParamIndex >= 0 ? src.slice(buildParamIndex) : null;
    }

    function updateImageSrc(images, buildParam) {
        const imagesArray = Array.from(images);
        for (const image of imagesArray) {
            image.setAttribute("src", image.getAttribute("src").concat(buildParam));
            image.classList.remove("append-build-number");
        }
    }

    function processImages() {
        const imagesToUpdate = document.getElementsByClassName("append-build-number");
        if (imagesToUpdate.length === 0) return;

        const imagesWithBuildNumber = document.getElementsByClassName("polarion-ToolbarButton-Icon");
        if (imagesWithBuildNumber.length === 0) return;

        const srcWithBuildNumber = imagesWithBuildNumber[0].getAttribute("src");
        const buildParam = getBuildParam(srcWithBuildNumber);
        if (buildParam) {
            updateImageSrc(imagesToUpdate, buildParam);
        }
    }

    processImages();
})();
