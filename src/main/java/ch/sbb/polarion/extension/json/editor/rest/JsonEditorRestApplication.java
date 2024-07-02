package ch.sbb.polarion.extension.json.editor.rest;

import ch.sbb.polarion.extension.generic.rest.GenericRestApplication;
import ch.sbb.polarion.extension.json.editor.rest.controller.ApiController;
import ch.sbb.polarion.extension.json.editor.rest.controller.InternalController;
import org.jetbrains.annotations.NotNull;

import java.util.Set;

public class JsonEditorRestApplication extends GenericRestApplication {

    @Override
    protected @NotNull Set<Object> getExtensionControllerSingletons() {
        return Set.of(
                new ApiController(),
                new InternalController()
        );
    }

}
