package ch.sbb.polarion.extension.json.editor;

import ch.sbb.polarion.extension.generic.GenericBundleActivator;
import com.polarion.alm.ui.server.forms.extensions.IFormExtension;

import java.util.Map;

public class ExtensionBundleActivator extends GenericBundleActivator {

    @Override
    protected Map<String, IFormExtension> getExtensions() {
        return Map.of(JsonEditorFormExtension.ID, new JsonEditorFormExtension());
    }

}
