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
import com.polarion.alm.tracker.model.IWorkItem;
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
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class JsonEditorFormExtensionTest {

    @Test
    @SneakyThrows
    @SuppressWarnings({"unchecked", "rawtypes", "ResultOfMethodCallIgnored"})
    void renderEditorTest() {

        UUID predefinedUUID = UUID.fromString("d2f53f62-c8d7-4273-ae9a-79fcbfaedc47");

        try (MockedStatic<ExtensionInfo> extensionInfoMockedStatic = mockStatic(ExtensionInfo.class);
             MockedStatic<UUID> uuidMockedStatic = mockStatic(UUID.class)) {
            ExtensionInfo info = mock(ExtensionInfo.class);
            extensionInfoMockedStatic.when(ExtensionInfo::getInstance).thenReturn(info);
            when(info.getVersion()).thenReturn(new Version(null, null, null, null, null, "2023-11-14 07:29"));
            SharedContext context = mock(SharedContext.class);

            uuidMockedStatic.when(UUID::randomUUID).thenReturn(predefinedUUID);

            IWorkItem workItem = mock(IWorkItem.class);

            HtmlBuilderTargetSelector htmlBuilderTargetSelector = mock(HtmlBuilderTargetSelector.class);
            when(context.createHtmlFragmentBuilderFor()).thenReturn(htmlBuilderTargetSelector);

            when(htmlBuilderTargetSelector.gwt()).thenReturn(createHtmlBuilder());
            when(workItem.isPersisted()).thenReturn(false);

            renderAndCompareWithResource(context, workItem, "editor-not-created.html");

            when(htmlBuilderTargetSelector.gwt()).thenReturn(createHtmlBuilder());
            when(workItem.isPersisted()).thenReturn(true);
            IPObjectList attachments = mock(IPObjectList.class);
            when(workItem.getAttachments()).thenReturn(attachments);
            IAttachmentBase attachment = mock(IAttachmentBase.class);
            when(attachment.getId()).thenReturn("testAttachmentId");
            when(attachment.getFileName()).thenReturn("testAttachment.json");
            when(attachments.stream()).thenReturn(Stream.of(attachment));

            renderAndCompareWithResource(context, workItem, "editor-ok.html");

            when(htmlBuilderTargetSelector.gwt()).thenReturn(createHtmlBuilder());
            when(attachments.stream()).thenThrow(new IllegalStateException("emulated exception for testing purposes"));

            renderAndCompareWithResource(context, workItem, "editor-exception.html");
        }
    }

    @SneakyThrows
    @SuppressWarnings("ConstantConditions")
    private void renderAndCompareWithResource(SharedContext context, IWorkItem workItem, String resourceFileName) {
        try (InputStream resultOk = this.getClass().getResourceAsStream("/" + resourceFileName)) {
            assertEquals(new String(resultOk.readAllBytes(), StandardCharsets.UTF_8), new JsonEditorFormExtension().renderEditor(context, workItem, false));
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
