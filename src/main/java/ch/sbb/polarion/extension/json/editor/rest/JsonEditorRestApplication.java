package ch.sbb.polarion.extension.json.editor.rest;

import ch.sbb.polarion.extension.generic.rest.GenericRestApplication;
import ch.sbb.polarion.extension.generic.rest.controller.NamedSettingsApiController;
import ch.sbb.polarion.extension.generic.rest.controller.NamedSettingsInternalController;
import ch.sbb.polarion.extension.json.editor.rest.controller.ApiController;
import ch.sbb.polarion.extension.json.editor.rest.controller.InternalController;
import org.jetbrains.annotations.NotNull;

import java.util.Set;

public class JsonEditorRestApplication extends GenericRestApplication {

    @Override
    @NotNull
    protected Set<Class<?>> getControllerClasses() {
        final Set<Class<?>> controllerClasses = super.getControllerClasses();
        controllerClasses.remove(NamedSettingsApiController.class);
        controllerClasses.remove(NamedSettingsInternalController.class);
        controllerClasses.add(ApiController.class);
        controllerClasses.add(InternalController.class);
        return controllerClasses;
    }

}
