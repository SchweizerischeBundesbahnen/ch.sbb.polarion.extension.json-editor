package ch.sbb.polarion.extension.json.editor;

import ch.sbb.polarion.extension.generic.GenericModule;
import com.polarion.alm.ui.server.forms.extensions.FormExtensionContribution;

public class JsonEditorModule extends GenericModule {

    @Override
    protected FormExtensionContribution getFormExtensionContribution() {
        return new FormExtensionContribution(JsonEditorFormExtension.class, JsonEditorFormExtension.ID);
    }
}
