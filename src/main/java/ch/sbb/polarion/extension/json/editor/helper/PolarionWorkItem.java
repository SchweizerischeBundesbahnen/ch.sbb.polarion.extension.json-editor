package ch.sbb.polarion.extension.json.editor.helper;

import ch.sbb.polarion.extension.generic.service.PolarionService;
import com.polarion.alm.tracker.model.IAttachment;
import com.polarion.alm.tracker.model.IWorkItem;
import lombok.experimental.UtilityClass;
import org.apache.commons.io.FilenameUtils;
import org.jetbrains.annotations.NotNull;

import javax.ws.rs.NotFoundException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@UtilityClass
public class PolarionWorkItem {

    public static final String FILE_EXTENSION = ".json";

    private static void validateAttachmentName(String workItemId, String fileName) {
        String regex = "^%s-.*\\%s$".formatted(workItemId, FILE_EXTENSION);
        Pattern pattern = Pattern.compile(regex);
        Matcher matcher = pattern.matcher(fileName);
        if (!matcher.matches()) {
            throw new IllegalArgumentException(
                    "File name pattern mismatch: '%s'. File name must start with '%s', a dash (-), end with %s extension and any characters in between."
                            .formatted(fileName, workItemId, FILE_EXTENSION)
            );
        }
    }

    public static String getAttachmentContent(@NotNull PolarionService polarionService, @NotNull String projectId,
                                              @NotNull String workItemId, @NotNull String attachmentId) {
        IWorkItem workItem = polarionService.getWorkItem(projectId, workItemId);

        IAttachment attachment = workItem.getAttachment(attachmentId);

        if (attachment == null || attachment.isUnresolvable()) {
            throw new NotFoundException(
                    "WorkItem '%s/%s' don't have an attachment with id '%s'!".formatted(projectId, workItemId, attachmentId));
        }

        try (InputStream inputStream = attachment.getDataStream()) {
            return new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            String message = "Error reading attachment '%s' content for project/workitem %s/%s".formatted(attachmentId, projectId, workItemId);
            throw new IllegalArgumentException(message);
        }
    }
    @NotNull
    public static IAttachment createAttachment(@NotNull PolarionService polarionService, @NotNull String projectId,
                                               @NotNull String workItemId, @NotNull String fileName) {
        IWorkItem workItem = polarionService.getWorkItem(projectId, workItemId);

        validateAttachmentName(workItemId, fileName);

        IAttachment wiAttachment = workItem.getAttachmentByFileName(fileName);

        if (wiAttachment == null) {
            String title = FilenameUtils.removeExtension(fileName);
            IAttachment attachment = workItem.createAttachment(fileName, title, new ByteArrayInputStream("".getBytes()));
            attachment.save();
            return attachment;
        }
        String message = "Attachment with the same file name '%1$s' already exists in project/workitem '%2$s/%3$s'"
                .formatted(fileName, projectId, workItemId);
        throw new IllegalArgumentException(message);
    }

    @NotNull
    public static IAttachment updateAttachment(@NotNull PolarionService polarionService, @NotNull String projectId,
                                               @NotNull String workItemId, @NotNull String attachmentId, @NotNull String content) {
        IWorkItem workItem = polarionService.getWorkItem(projectId, workItemId);

        IAttachment wiAttachment = workItem.getAttachment(attachmentId);

        if (wiAttachment == null) {
            throw new NotFoundException("Attachment with id %s not found".formatted(attachmentId));
        }

        try (InputStream inputStream = new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8))) {
            wiAttachment.setDataStream(inputStream);
            wiAttachment.save();
            return wiAttachment;
        } catch (IOException e) {
            String message = "Error updating attachment '%s' for project/workitem %s/%s".formatted(attachmentId, projectId, workItemId);
            throw new IllegalArgumentException(message);
        }
    }
}
