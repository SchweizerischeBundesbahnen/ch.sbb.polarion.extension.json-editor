package ch.sbb.polarion.extension.json.editor.helper;

import com.polarion.alm.tracker.model.IAttachmentBase;
import com.polarion.alm.tracker.model.IModule;
import com.polarion.alm.tracker.model.IWithAttachments;
import com.polarion.alm.tracker.model.IWorkItem;
import com.polarion.core.util.StringUtils;
import com.polarion.platform.persistence.model.IPObjectList;
import lombok.experimental.UtilityClass;
import org.apache.commons.io.FilenameUtils;
import org.jetbrains.annotations.NotNull;

import jakarta.ws.rs.NotFoundException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

@UtilityClass
@SuppressWarnings("rawtypes")
public class PolarionWorkItem {

    public static final String FILE_EXTENSION = ".json";

    private static void validateAttachmentName(String namePrefix, String fileName) {
        if (!fileName.startsWith(namePrefix + "-") || !fileName.endsWith(FILE_EXTENSION)) {
            throw new IllegalArgumentException(
                    "File name pattern mismatch: '%s'. File name must start with '%s', a dash (-), end with %s extension and any characters in between."
                            .formatted(fileName, namePrefix, FILE_EXTENSION)
            );
        }
    }

    public static String getAttachmentContent(@NotNull IWorkItem workItem, @NotNull String attachmentId) {
        return getAttachmentContent(workItem, attachmentId, workItem.getProjectId() + "/" + workItem.getId());
    }

    public static String getAttachmentContent(@NotNull IModule module, @NotNull String attachmentId) {
        return getAttachmentContent(module, attachmentId, module.getModuleNameWithSpace());
    }

    public static String getAttachmentContent(@NotNull IWithAttachments object, @NotNull String attachmentId, @NotNull String entityUniqueIdentifier) {
        IAttachmentBase attachment = object.getAttachment(attachmentId);
        if (attachment == null || attachment.isUnresolvable()) {
            throw new NotFoundException(
                    "'%s' doesn't have an attachment with id '%s'!".formatted(entityUniqueIdentifier, attachmentId));
        }

        try (InputStream inputStream = attachment.getDataStream()) {
            return new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            String message = "Error reading attachment '%s' content for %s".formatted(attachmentId, entityUniqueIdentifier);
            throw new IllegalArgumentException(message);
        }
    }

    @NotNull
    public static IAttachmentBase createAttachment(@NotNull IWorkItem workItem, @NotNull String fileName) {
        return createAttachment(workItem, fileName, workItem.getId(), workItem.getProjectId() + "/" + workItem.getId());
    }

    @NotNull
    public static IAttachmentBase createAttachment(@NotNull IModule module, @NotNull String fileName) {
        return createAttachment(module, fileName, "", module.getModuleNameWithSpace());
    }

    @NotNull
    public static IAttachmentBase createAttachment(@NotNull IWithAttachments object, @NotNull String fileName,
                                                   @NotNull String namePrefix, @NotNull String entityUniqueIdentifier) {
        if (!StringUtils.isEmpty(namePrefix)) {
            validateAttachmentName(namePrefix, fileName);
        } else if (!fileName.endsWith(FILE_EXTENSION)) {
            throw new IllegalArgumentException(
                    "File name '%s' must end with %s extension.".formatted(fileName, FILE_EXTENSION));
        }

        IPObjectList<?> attachments = object.getAttachments();
        boolean alreadyExists = attachments.stream()
                .filter(IAttachmentBase.class::isInstance)
                .map(IAttachmentBase.class::cast)
                .anyMatch(attachment -> fileName.equals(attachment.getFileName()));
        if (alreadyExists) {
            throw new IllegalArgumentException(
                    "Attachment with the same file name '%s' already exists in '%s'".formatted(fileName, entityUniqueIdentifier));
        }

        String title = FilenameUtils.removeExtension(fileName);
        IAttachmentBase attachment = object.createAttachment(fileName, title, new ByteArrayInputStream("".getBytes()));
        attachment.save();
        return attachment;
    }

    @NotNull
    public static IAttachmentBase updateAttachment(@NotNull IWorkItem workItem, @NotNull String attachmentId, @NotNull String content) {
        return updateAttachment(workItem, attachmentId, content, workItem.getProjectId() + "/" + workItem.getId());
    }

    @NotNull
    public static IAttachmentBase updateAttachment(@NotNull IModule module, @NotNull String attachmentId, @NotNull String content) {
        return updateAttachment(module, attachmentId, content, module.getModuleNameWithSpace());
    }

    @NotNull
    public static IAttachmentBase updateAttachment(@NotNull IWithAttachments object, @NotNull String attachmentId,
                                                   @NotNull String content, @NotNull String entityUniqueIdentifier) {
        IAttachmentBase attachment = object.getAttachment(attachmentId);
        if (attachment == null) {
            throw new NotFoundException("Attachment with id %s not found".formatted(attachmentId));
        }

        try (InputStream inputStream = new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8))) {
            attachment.setDataStream(inputStream);
            attachment.save();
            return attachment;
        } catch (IOException e) {
            String message = "Error updating attachment '%s' for %s".formatted(attachmentId, entityUniqueIdentifier);
            throw new IllegalArgumentException(message);
        }
    }
}
