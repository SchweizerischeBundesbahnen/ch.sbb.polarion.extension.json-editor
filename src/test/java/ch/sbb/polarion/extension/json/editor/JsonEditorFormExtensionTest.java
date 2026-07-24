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
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JsonEditorFormExtensionTest {

    @Test
    @SneakyThrows
    @SuppressWarnings({"unchecked", "rawtypes"})
    void renderEditorTest() {
        try (MockedStatic<ExtensionInfo> extensionInfoMockedStatic = mockStatic(ExtensionInfo.class)) {
            ExtensionInfo info = mock(ExtensionInfo.class);
            extensionInfoMockedStatic.when(ExtensionInfo::getInstance).thenReturn(info);
            lenient().when(info.getVersion()).thenReturn(Version.builder().bundleBuildTimestamp("2023-11-14 07:29").build());

            SharedContext context = mock(SharedContext.class);
            HtmlBuilderTargetSelector htmlBuilderTargetSelector = mock(HtmlBuilderTargetSelector.class);
            when(context.createHtmlFragmentBuilderFor()).thenReturn(htmlBuilderTargetSelector);

            // shared attachment used to populate the embedded data-attachments JSON
            IAttachmentBase attachment = mock(IAttachmentBase.class);
            when(attachment.getId()).thenReturn("testAttachmentId");
            when(attachment.getFileName()).thenReturn("testAttachment.json");

            // 1. not persisted yet -> placeholder message
            IWorkItem workItem = mock(IWorkItem.class);
            when(htmlBuilderTargetSelector.gwt()).thenReturn(createHtmlBuilder());
            when(workItem.isPersisted()).thenReturn(false);
            renderAndCompareWithResource(context, workItem, false, "editor-not-created.html");

            // 2. persisted work item -> React-panel fragment, validateOnSave = false, no space
            when(htmlBuilderTargetSelector.gwt()).thenReturn(createHtmlBuilder());
            when(workItem.isPersisted()).thenReturn(true);
            when(workItem.getProjectId()).thenReturn("TEST_PROJECT");
            when(workItem.getId()).thenReturn("TEST_WI");
            IPObjectList workItemAttachments = mock(IPObjectList.class);
            when(workItem.getAttachments()).thenReturn(workItemAttachments);
            when(workItemAttachments.stream()).thenReturn(Stream.of(attachment));
            String workItemRendered = new JsonEditorFormExtension().renderEditor(context, workItem, false);
            assertThat(workItemRendered)
                    .contains("<div id=\"json-editor-panel\"")
                    .contains("data-project-id=\"TEST_PROJECT\"")
                    .contains("data-entity-id=\"TEST_WI\"")
                    .contains("data-space-id=\"\"")
                    .contains("data-validate-on-save=\"false\"")
                    // JSON attachments, HTML-escaped for the attribute (quotes become &quot;)
                    .contains("data-attachments=\"[{&quot;id&quot;:&quot;testAttachmentId&quot;,&quot;fileName&quot;:&quot;testAttachment.json&quot;}]\"")
                    // the fragment imports the React panel bundle and mounts it, with a cache-buster
                    // on the starter.css trigger link (real panel CSS is bundled into the React app)
                    .contains("starter.css?bundle=202311140729")
                    .contains("import(\"/polarion/json-editor-app/ui/app/assets/jsonEditorPanel.js\")")
                    .contains("mountJsonEditorPanel(\"#json-editor-panel\")");

            // 3. persisted module -> React-panel fragment, validateOnSave = true, with space
            IModule module = mock(IModule.class, RETURNS_DEEP_STUBS);
            when(htmlBuilderTargetSelector.gwt()).thenReturn(createHtmlBuilder());
            when(module.isPersisted()).thenReturn(true);
            when(module.getProjectId()).thenReturn("MODULE_PROJECT");
            when(module.getModuleName()).thenReturn("My Doc 1");
            when(module.getLocalId().getContainerId().getObjectName()).thenReturn("MySpace");
            IPObjectList moduleAttachments = mock(IPObjectList.class);
            when(module.getAttachments()).thenReturn(moduleAttachments);
            when(moduleAttachments.stream()).thenReturn(Stream.of(attachment));
            String moduleRendered = new JsonEditorFormExtension().renderEditor(context, module, true);
            assertThat(moduleRendered)
                    .contains("data-project-id=\"MODULE_PROJECT\"")
                    .contains("data-entity-id=\"My Doc 1\"")
                    .contains("data-space-id=\"MySpace\"")
                    .contains("data-validate-on-save=\"true\"");

            // 3b. special characters in module/space names must be HTML-escaped in the rendered attributes
            IModule unsafeModule = mock(IModule.class, RETURNS_DEEP_STUBS);
            when(htmlBuilderTargetSelector.gwt()).thenReturn(createHtmlBuilder());
            when(unsafeModule.isPersisted()).thenReturn(true);
            when(unsafeModule.getProjectId()).thenReturn("proj");
            when(unsafeModule.getModuleName()).thenReturn("a'b<i>");
            when(unsafeModule.getLocalId().getContainerId().getObjectName()).thenReturn("sp'ace");
            IPObjectList unsafeAttachments = mock(IPObjectList.class);
            when(unsafeModule.getAttachments()).thenReturn(unsafeAttachments);
            when(unsafeAttachments.stream()).thenReturn(Stream.empty());
            String unsafeRendered = new JsonEditorFormExtension().renderEditor(context, unsafeModule, false);
            assertThat(unsafeRendered).contains("data-entity-id=\"a&#39;b&lt;i&gt;\"");
            assertThat(unsafeRendered).contains("data-space-id=\"sp&#39;ace\"");
            assertThat(unsafeRendered).contains("data-attachments=\"[]\"");
            assertThat(unsafeRendered).doesNotContain("a'b<i>");

            // 3c. an attachment id/name with JSON-special characters must be JSON-escaped inside
            // data-attachments (then the whole attribute is HTML-escaped, so a quote becomes \&quot;)
            IWorkItem escWorkItem = mock(IWorkItem.class);
            when(htmlBuilderTargetSelector.gwt()).thenReturn(createHtmlBuilder());
            when(escWorkItem.isPersisted()).thenReturn(true);
            when(escWorkItem.getProjectId()).thenReturn("proj");
            when(escWorkItem.getId()).thenReturn("WI");
            IAttachmentBase specialAttachment = mock(IAttachmentBase.class);
            when(specialAttachment.getId()).thenReturn("att1");
            // quote, backslash, newline, CR, tab and another control char, built via (char) casts
            // so the source stays pure ASCII; each must be JSON-escaped by jsonEscape.
            String specialName = "q" + (char) 34 + "bs" + (char) 92 + "nl" + (char) 10 + "cr"
                    + (char) 13 + "tab" + (char) 9 + "ctrl" + (char) 1 + ".json";
            when(specialAttachment.getFileName()).thenReturn(specialName);
            // a second .json attachment forces the comma separator between array entries, and a third
            // one reusing att1's id exercises the toMap merge function (duplicate key -> keep the first)
            IAttachmentBase secondAttachment = mock(IAttachmentBase.class);
            when(secondAttachment.getId()).thenReturn("att2");
            when(secondAttachment.getFileName()).thenReturn("second.json");
            IAttachmentBase duplicateAttachment = mock(IAttachmentBase.class);
            when(duplicateAttachment.getId()).thenReturn("att1");
            when(duplicateAttachment.getFileName()).thenReturn("dropped.json");
            IPObjectList escAttachments = mock(IPObjectList.class);
            when(escWorkItem.getAttachments()).thenReturn(escAttachments);
            when(escAttachments.stream()).thenReturn(Stream.of(specialAttachment, secondAttachment, duplicateAttachment));
            String escRendered = new JsonEditorFormExtension().renderEditor(context, escWorkItem, false);
            assertThat(escRendered)
                    .contains("q\\&quot;bs") // '"'  -> \" then HTML-escaped to \&quot;
                    .contains("bs\\\\nl") // '\'  -> \\
                    .contains("nl\\ncr") // newline -> \n
                    .contains("cr\\rtab") // carriage return -> \r
                    .contains("tab\\tctrl") // tab -> \t
                    .contains("ctrl\\u0001.json") // other control char -> \\u0001
                    .contains("second.json") // second entry is present (comma-separated)
                    .doesNotContain("dropped.json"); // duplicate id kept the first value

            // 4. exception while building the editor -> error message
            when(htmlBuilderTargetSelector.gwt()).thenReturn(createHtmlBuilder());
            when(workItemAttachments.stream()).thenThrow(new IllegalStateException("emulated exception for testing purposes"));
            renderAndCompareWithResource(context, workItem, false, "editor-exception.html");

            // 5. object that is neither a module nor a work item -> nothing is rendered
            when(htmlBuilderTargetSelector.gwt()).thenReturn(createHtmlBuilder());
            String unsupportedRendered = new JsonEditorFormExtension().renderEditor(context, mock(IPObject.class), false);
            assertThat(unsupportedRendered).isBlank();
        }
    }

    @SneakyThrows
    @SuppressWarnings("ConstantConditions")
    private void renderAndCompareWithResource(SharedContext context, IPObject object, boolean validateOnSave, String resourceFileName) {
        try (InputStream expected = this.getClass().getResourceAsStream("/" + resourceFileName)) {
            // stripTrailing() tolerates the final newline that the end-of-file-fixer pre-commit hook enforces on resources
            assertEquals(new String(expected.readAllBytes(), StandardCharsets.UTF_8).stripTrailing(),
                    new JsonEditorFormExtension().renderEditor(context, object, validateOnSave).stripTrailing());
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
