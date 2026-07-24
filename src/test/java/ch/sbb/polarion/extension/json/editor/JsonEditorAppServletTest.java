package ch.sbb.polarion.extension.json.editor;

import ch.sbb.polarion.extension.generic.GenericUiServlet;
import lombok.SneakyThrows;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

class JsonEditorAppServletTest {

    @Test
    @SneakyThrows
    void servesTheJsonEditorAppWebappContext() {
        JsonEditorAppServlet servlet = new JsonEditorAppServlet();
        assertInstanceOf(GenericUiServlet.class, servlet);

        // The webapp context name is passed to the GenericUiServlet super constructor; read it back to
        // confirm this servlet serves the Vite/React bundle context (json-editor-app). The field is
        // protected in the parent (different package), so reach it reflectively.
        Field webAppName = GenericUiServlet.class.getDeclaredField("webAppName");
        webAppName.setAccessible(true);
        assertEquals("json-editor-app", webAppName.get(servlet));
    }
}
