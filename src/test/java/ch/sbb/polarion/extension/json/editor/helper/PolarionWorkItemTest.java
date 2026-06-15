package ch.sbb.polarion.extension.json.editor.helper;

import com.polarion.alm.tracker.model.IAttachment;
import com.polarion.alm.tracker.model.IModule;
import com.polarion.alm.tracker.model.IModuleAttachment;
import com.polarion.alm.tracker.model.IWorkItem;
import com.polarion.platform.persistence.model.IPObjectList;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import jakarta.ws.rs.NotFoundException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings({"rawtypes", "unchecked"})
class PolarionWorkItemTest {

    String testProjectId = "TEST_PROJECT_ID";
    String testWi = "TEST_WI";
    String workItemIdentifier = testProjectId + "/" + testWi;
    String filename = "TEST_WI-1.json";
    String attachmentId = "1-TEST_WI-1.json";
    String fileContent = "content";

    String moduleFilename = "My_Doc_1-1.json";
    String moduleNameWithSpace = "MySpace/My Document";

    @Mock
    private IWorkItem workItem;
    @Mock
    private IModule module;
    @Mock
    private IAttachment attachment;
    @Mock
    private IModuleAttachment moduleAttachment;
    @Mock
    private IPObjectList attachments;

    // --- getAttachmentContent ---

    @Test
    void getWorkItemAttachmentContent() {
        when(workItem.getAttachment(attachmentId)).thenReturn(attachment);
        when(attachment.getDataStream()).thenReturn(new ByteArrayInputStream(fileContent.getBytes(StandardCharsets.UTF_8)));

        String content = PolarionWorkItem.getAttachmentContent(workItem, attachmentId);

        assertThat(content).isEqualTo(fileContent);
    }

    @Test
    void getWorkItemAttachmentContentNotFound() {
        when(workItem.getProjectId()).thenReturn(testProjectId);
        when(workItem.getId()).thenReturn(testWi);
        when(workItem.getAttachment(attachmentId)).thenReturn(null);

        assertThatThrownBy(() -> PolarionWorkItem.getAttachmentContent(workItem, attachmentId))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining("'%s' doesn't have an attachment with id '%s'!".formatted(workItemIdentifier, attachmentId));
    }

    @Test
    void getWorkItemAttachmentContentDataStreamException() {
        when(workItem.getProjectId()).thenReturn(testProjectId);
        when(workItem.getId()).thenReturn(testWi);
        when(workItem.getAttachment(attachmentId)).thenReturn(attachment);
        given(attachment.getDataStream()).willAnswer(invocation -> { throw new IOException(); });

        assertThatThrownBy(() -> PolarionWorkItem.getAttachmentContent(workItem, attachmentId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Error reading attachment '%s' content for %s".formatted(attachmentId, workItemIdentifier));
    }

    @Test
    void getWorkItemAttachmentContentUnresolvable() {
        when(workItem.getProjectId()).thenReturn(testProjectId);
        when(workItem.getId()).thenReturn(testWi);
        when(workItem.getAttachment(attachmentId)).thenReturn(attachment);
        when(attachment.isUnresolvable()).thenReturn(true);

        assertThatThrownBy(() -> PolarionWorkItem.getAttachmentContent(workItem, attachmentId))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining("'%s' doesn't have an attachment with id '%s'!".formatted(workItemIdentifier, attachmentId));
    }

    @Test
    void getModuleAttachmentContent() {
        when(module.getAttachment(attachmentId)).thenReturn(moduleAttachment);
        when(moduleAttachment.getDataStream()).thenReturn(new ByteArrayInputStream(fileContent.getBytes(StandardCharsets.UTF_8)));

        String content = PolarionWorkItem.getAttachmentContent(module, attachmentId);

        assertThat(content).isEqualTo(fileContent);
    }

    @Test
    void getModuleAttachmentContentNotFound() {
        when(module.getModuleNameWithSpace()).thenReturn(moduleNameWithSpace);
        when(module.getAttachment(attachmentId)).thenReturn(null);

        assertThatThrownBy(() -> PolarionWorkItem.getAttachmentContent(module, attachmentId))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining("'%s' doesn't have an attachment with id '%s'!".formatted(moduleNameWithSpace, attachmentId));
    }

    // --- createAttachment ---

    @Test
    void createWorkItemAttachment() {
        when(workItem.getId()).thenReturn(testWi);
        when(workItem.getAttachments()).thenReturn(attachments);
        when(attachments.stream()).thenReturn(Stream.empty());
        when(workItem.createAttachment(eq(filename), eq("TEST_WI-1"), any())).thenReturn(attachment);

        PolarionWorkItem.createAttachment(workItem, filename);

        verify(attachment, times(1)).save();
    }

    @Test
    void createWorkItemAttachmentInvalidName() {
        when(workItem.getId()).thenReturn(testWi);

        assertThatThrownBy(() -> PolarionWorkItem.createAttachment(workItem, "wrong-name.json"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("File name pattern mismatch");
    }

    @Test
    void createWorkItemAttachmentAlreadyExists() {
        when(workItem.getId()).thenReturn(testWi);
        when(workItem.getProjectId()).thenReturn(testProjectId);
        when(workItem.getAttachments()).thenReturn(attachments);
        when(attachments.stream()).thenReturn(Stream.of(attachment));
        when(attachment.getFileName()).thenReturn(filename);

        assertThatThrownBy(() -> PolarionWorkItem.createAttachment(workItem, filename))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Attachment with the same file name '%s' already exists in '%s'".formatted(filename, workItemIdentifier));
    }

    @Test
    void createModuleAttachmentInvalidExtension() {
        assertThatThrownBy(() -> PolarionWorkItem.createAttachment(module, "wrong-name.txt"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("must end with %s extension".formatted(PolarionWorkItem.FILE_EXTENSION));
    }

    @Test
    void createModuleAttachment() {
        when(module.getAttachments()).thenReturn(attachments);
        when(attachments.stream()).thenReturn(Stream.empty());
        when(module.createAttachment(eq(moduleFilename), eq("My_Doc_1-1"), any())).thenReturn(moduleAttachment);

        PolarionWorkItem.createAttachment(module, moduleFilename);

        verify(moduleAttachment, times(1)).save();
    }

    // --- updateAttachment ---

    @Test
    void updateWorkItemAttachment() {
        when(workItem.getAttachment(attachmentId)).thenReturn(attachment);

        PolarionWorkItem.updateAttachment(workItem, attachmentId, "test_content");

        verify(attachment, times(1)).save();
    }

    @Test
    void updateWorkItemAttachmentNotFound() {
        when(workItem.getAttachment(attachmentId)).thenReturn(null);

        assertThatThrownBy(() -> PolarionWorkItem.updateAttachment(workItem, attachmentId, "test_content"))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining("Attachment with id %s not found".formatted(attachmentId));
    }

    @Test
    void updateWorkItemAttachmentIOException() {
        when(workItem.getProjectId()).thenReturn(testProjectId);
        when(workItem.getId()).thenReturn(testWi);
        when(workItem.getAttachment(attachmentId)).thenReturn(attachment);
        doAnswer(invocation -> { throw new IOException(); }).when(attachment).setDataStream(any());

        assertThatThrownBy(() -> PolarionWorkItem.updateAttachment(workItem, attachmentId, "test_content"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Error updating attachment '%s' for %s".formatted(attachmentId, workItemIdentifier));
    }

    @Test
    void updateModuleAttachment() {
        when(module.getAttachment(attachmentId)).thenReturn(moduleAttachment);

        PolarionWorkItem.updateAttachment(module, attachmentId, "test_content");

        verify(moduleAttachment, times(1)).save();
    }
}
