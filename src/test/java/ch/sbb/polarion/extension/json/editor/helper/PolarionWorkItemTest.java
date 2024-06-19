package ch.sbb.polarion.extension.json.editor.helper;

import ch.sbb.polarion.extension.generic.service.PolarionService;
import com.polarion.alm.tracker.model.IAttachment;
import com.polarion.alm.tracker.model.IWorkItem;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.ws.rs.NotFoundException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PolarionWorkItemTest {

    String testProjectId = "TEST_PROJECT_ID";
    String testWi = "TEST_WI";
    String filename = "TEST_WI-1.json";
    String attachmentId = "1-TEST_WI-1.json";
    String fileContent = "content";
    @Mock
    private PolarionService polarionService;
    @Mock
    private IWorkItem workItem;
    @Mock
    private IAttachment attachment;

    @Test
    void getFeatureWithUnresolvableWorkItem() {
        when(polarionService.getWorkItem(testProjectId, testWi)).thenThrow(new NotFoundException("WorkItem 'TEST_PROJECT_ID/TEST_WI' not found!"));

        assertThatThrownBy(() ->
                PolarionWorkItem.getAttachmentContent(polarionService, testProjectId, testWi, attachmentId))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining("WorkItem '%s/%s' not found!".formatted(testProjectId, testWi));
    }

    @Test
    void getFeatureWithoutAttachment() {
        when(polarionService.getWorkItem(testProjectId, testWi)).thenReturn(workItem);
        when(workItem.getAttachment(attachmentId)).thenReturn(null);

        assertThatThrownBy(() ->
                PolarionWorkItem.getAttachmentContent(polarionService, testProjectId, testWi, attachmentId))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining("WorkItem '%s/%s' don't have an attachment with id '%s'!".formatted(testProjectId, testWi, attachmentId));
    }

    @Test
    void getFeatureWithoutErrors() {
        when(polarionService.getWorkItem(testProjectId, testWi)).thenReturn(workItem);
        when(workItem.getAttachment(attachmentId)).thenReturn(attachment);
        when(attachment.getDataStream()).thenReturn(new ByteArrayInputStream(fileContent.getBytes(StandardCharsets.UTF_8)));

        String content = PolarionWorkItem.getAttachmentContent(polarionService, testProjectId, testWi, attachmentId);

        assertThat(content).isEqualTo(fileContent);
    }

    @Test
    void getFeatureDataStreamException() {
        when(polarionService.getWorkItem(testProjectId, testWi)).thenReturn(workItem);
        when(workItem.getAttachment(attachmentId)).thenReturn(attachment);
        given(attachment.getDataStream()).willAnswer(invocation -> { throw new IOException(); });

        assertThatThrownBy(() ->
                PolarionWorkItem.getAttachmentContent(polarionService, testProjectId, testWi, attachmentId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Error reading attachment '%s' content for project/workitem %s/%s".formatted(attachmentId, testProjectId, testWi));
    }

    @Test
    void createFeatureWithUnresolvableWorkItem() {
        when(polarionService.getWorkItem(testProjectId, testWi)).thenThrow(new NotFoundException("WorkItem 'TEST_PROJECT_ID/TEST_WI' not found!"));

        assertThatThrownBy(() ->
                PolarionWorkItem.createAttachment(polarionService, testProjectId, testWi, filename))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining("WorkItem '%s/%s' not found!".formatted(testProjectId, testWi));
    }

    @Test
    void createFeatureWithoutAttachment() {
        when(polarionService.getWorkItem(testProjectId, testWi)).thenReturn(workItem);
        when(workItem.getAttachmentByFileName(filename)).thenReturn(null);
        when(workItem.createAttachment(eq(filename), eq("TEST_WI-1"), any())).thenReturn(attachment);

        PolarionWorkItem.createAttachment(polarionService, testProjectId, testWi, filename);
        verify(attachment, times(1)).save();
    }

    @Test
    void updateFeature() {
        when(polarionService.getWorkItem(testProjectId, testWi)).thenReturn(workItem);
        when(workItem.getAttachment(attachmentId)).thenReturn(attachment);

        PolarionWorkItem.updateAttachment(polarionService, testProjectId, testWi, attachmentId, "test_content");
        verify(attachment, times(1)).save();
    }

    @Test
    void updateFeatureAttachmentDoesNotExists() {
        when(polarionService.getWorkItem(testProjectId, testWi)).thenReturn(workItem);
        when(workItem.getAttachment(attachmentId)).thenReturn(null);
        assertThatThrownBy(() ->
                PolarionWorkItem.updateAttachment(polarionService, testProjectId, testWi, attachmentId, "test_content"))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining("Attachment with id %s not found".formatted(attachmentId));
    }
}