package ch.sbb.polarion.extension.json.editor;

import ch.sbb.polarion.extension.generic.GenericUiServlet;

import java.io.Serial;

/**
 * Serves the Vite/React app bundle (the third webapp context, {@code json-editor-app}). The admin
 * "About" page and the WorkItem/Document JSON editor panel are both rendered by this single bundle,
 * chosen by the {@code ?feature=<id>} query parameter. Mirrors {@link JsonEditorUiServlet} /
 * {@link JsonEditorAdminUiServlet}.
 */
public class JsonEditorAppServlet extends GenericUiServlet {

    @Serial
    private static final long serialVersionUID = 8244394133086017461L;

    public JsonEditorAppServlet() {
        super("json-editor-app");
    }
}
