package ch.sbb.polarion.extension.json.editor.rest.controller;

import ch.sbb.polarion.extension.generic.rest.filter.Secured;

import javax.ws.rs.Path;

@Secured
@Path("/api")
public class ApiController extends InternalController {

    @Override
    public String getAttachmentContent(String projectId, String workItemId, String fileName) {
        return polarionService.callPrivileged(() -> super.getAttachmentContent(projectId, workItemId, fileName));
    }

    @Override
    public String createAttachment(String projectId, String workItemId, String fileName) {
        return polarionService.callPrivileged(() -> super.createAttachment(projectId, workItemId, fileName));
    }

    @Override
    public String updateAttachment(String projectId, String workItemId, String attachmentId, String content) {
        return polarionService.callPrivileged(() -> super.updateAttachment(projectId, workItemId, attachmentId, content));
    }
}
