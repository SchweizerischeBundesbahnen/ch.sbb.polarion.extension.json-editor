package ch.sbb.polarion.extension.json.editor;

import ch.sbb.polarion.extension.generic.rest.model.Version;
import ch.sbb.polarion.extension.generic.util.ExtensionInfo;
import com.polarion.alm.server.html.ServerHtmlBuilderTargetImpl;
import com.polarion.alm.shared.UiContext;
import com.polarion.alm.shared.api.SharedContext;
import com.polarion.alm.shared.api.utils.html.HtmlBuilderTargetSelector;
import com.polarion.alm.shared.api.utils.html.HtmlFragmentBuilder;
import com.polarion.alm.shared.api.utils.html.impl.HtmlFragmentBuilderImplStandalone;
import com.polarion.alm.shared.api.utils.links.HtmlLink;
import com.polarion.alm.tracker.model.IAttachmentBase;
import com.polarion.alm.tracker.model.IModule;
import com.polarion.alm.tracker.model.IWorkItem;
import com.polarion.platform.persistence.model.IPObject;
import com.polarion.platform.persistence.model.IPObjectList;
import lombok.SneakyThrows;
import org.jetbrains.annotations.Nullable;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JsonEditorFormExtensionTest {

    private static final UUID PREDEFINED_UUID = UUID.fromString("d2f53f62-c8d7-4273-ae9a-79fcbfaedc47");

    @Test
    @SneakyThrows
    @SuppressWarnings({"unchecked", "rawtypes"})
    void renderEditorTest() {
        try (MockedStatic<ExtensionInfo> extensionInfoMockedStatic = mockStatic(ExtensionInfo.class);
             MockedStatic<UUID> uuidMockedStatic = mockStatic(UUID.class)) {
            ExtensionInfo info = mock(ExtensionInfo.class);
            extensionInfoMockedStatic.when(ExtensionInfo::getInstance).thenReturn(info);
            lenient().when(info.getVersion()).thenReturn(Version.builder().bundleBuildTimestamp("2023-11-14 07:29").build());
            uuidMockedStatic.when(UUID::randomUUID).thenReturn(PREDEFINED_UUID);

            SharedContext context = mock(SharedContext.class);
            HtmlBuilderTargetSelector htmlBuilderTargetSelector = mock(HtmlBuilderTargetSelector.class);
            when(context.createHtmlFragmentBuilderFor()).thenReturn(htmlBuilderTargetSelector);

            // shared attachment used to render a single select option
            IAttachmentBase attachment = mock(IAttachmentBase.class);
            when(attachment.getId()).thenReturn("testAttachmentId");
            when(attachment.getFileName()).thenReturn("testAttachment.json");

            // 1. not persisted yet -> placeholder message
            IWorkItem workItem = mock(IWorkItem.class);
            when(htmlBuilderTargetSelector.gwt()).thenReturn(createHtmlBuilder());
            when(workItem.isPersisted()).thenReturn(false);
            renderAndCompareWithResource(context, workItem, false, "editor-not-created.html");

            // 2. persisted work item -> full editor, validateOnSave = false, no space, prefix = id + '-'
            when(htmlBuilderTargetSelector.gwt()).thenReturn(createHtmlBuilder());
            when(workItem.isPersisted()).thenReturn(true);
            when(workItem.getProjectId()).thenReturn("TEST_PROJECT");
            when(workItem.getId()).thenReturn("TEST_WI");
            IPObjectList workItemAttachments = mock(IPObjectList.class);
            when(workItem.getAttachments()).thenReturn(workItemAttachments);
            when(workItemAttachments.stream()).thenReturn(Stream.of(attachment));
            renderAndCompareWithResource(context, workItem, false, "editor-ok.html");

            // 3. persisted module -> full editor, validateOnSave = true, with space, empty prefix
            IModule module = mock(IModule.class, RETURNS_DEEP_STUBS);
            when(htmlBuilderTargetSelector.gwt()).thenReturn(createHtmlBuilder());
            when(module.isPersisted()).thenReturn(true);
            when(module.getProjectId()).thenReturn("MODULE_PROJECT");
            when(module.getModuleName()).thenReturn("My Doc 1");
            when(module.getLocalId().getContainerId().getObjectName()).thenReturn("MySpace");
            IPObjectList moduleAttachments = mock(IPObjectList.class);
            when(module.getAttachments()).thenReturn(moduleAttachments);
            when(moduleAttachments.stream()).thenReturn(Stream.of(attachment));
            renderAndCompareWithResource(context, module, true, "editor-ok-module.html");

            // 4. exception while building the editor -> error message
            when(htmlBuilderTargetSelector.gwt()).thenReturn(createHtmlBuilder());
            when(workItemAttachments.stream()).thenThrow(new IllegalStateException("emulated exception for testing purposes"));
            renderAndCompareWithResource(context, workItem, false, "editor-exception.html");
        }
    }

    @SneakyThrows
    @SuppressWarnings("ConstantConditions")
    private void renderAndCompareWithResource(SharedContext context, IPObject object, boolean validateOnSave, String resourceFileName) {
        try (InputStream expected = this.getClass().getResourceAsStream("/" + resourceFileName)) {
            assertEquals(new String(expected.readAllBytes(), StandardCharsets.UTF_8),
                    new JsonEditorFormExtension().renderEditor(context, object, validateOnSave));
        }
    }

    private HtmlFragmentBuilder createHtmlBuilder() {
        return new HtmlFragmentBuilderImplStandalone(mock(UiContext.class), new ServerHtmlBuilderTargetImpl() {
            @Nullable
            @Override
            public String toEncodedUrl(@Nullable HtmlLink link) {
                //For some reason ServerHtmlBuilderTargetImpl throws UnsupportedOperationException for this method this is why we override this method.
                return link == null ? null : link.toEncodedAbsoluteUrl("host");
            }
        });
    }

}
