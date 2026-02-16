package ch.sbb.polarion.extension.json.editor.rest.controller;

import ch.sbb.polarion.extension.generic.service.PolarionService;
import ch.sbb.polarion.extension.json.editor.helper.PolarionWorkItem;
import com.polarion.alm.shared.api.transaction.TransactionalExecutor;
import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.glassfish.jersey.media.multipart.FormDataParam;

import javax.inject.Singleton;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.PATCH;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

@Singleton
@Hidden
@Path("/internal")
@Tag(name = "Attachments")
public class InternalController {

    protected final PolarionService polarionService = new PolarionService();

    @GET
    @Path("/projects/{projectId}/workitems/{workItemId}/attachments/{attachmentId}/content")
    @Produces(MediaType.TEXT_PLAIN)
    @Operation(summary = "Get attachment content by id.")
    public String getAttachmentContent(@Parameter(required = true) @PathParam("projectId") String projectId,
                                       @Parameter(required = true) @PathParam("workItemId") String workItemId,
                                       @Parameter(required = true) @PathParam("attachmentId") String attachmentId) {
        return TransactionalExecutor.executeSafelyInReadOnlyTransaction(
                transaction -> PolarionWorkItem.getAttachmentContent(polarionService, projectId, workItemId, attachmentId));
    }

    @POST
    @Path("/projects/{projectId}/workitems/{workItemId}/attachments")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces(MediaType.TEXT_PLAIN)
    @Operation(summary = "Create new attachment with file name provided.")
    public String createAttachment(
            @Parameter(required = true) @PathParam("projectId") String projectId,
            @Parameter(required = true) @PathParam("workItemId") String workItemId,
            @Parameter(required = true) @FormDataParam("fileName") String fileName) {
        return TransactionalExecutor.executeInWriteTransaction(
                transaction -> PolarionWorkItem.createAttachment(polarionService, projectId, workItemId, fileName).getId());
    }

    @PATCH
    @Path("/projects/{projectId}/workitems/{workItemId}/attachments/{attachmentId}")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces(MediaType.TEXT_PLAIN)
    @Operation(summary = "Update existing attachment with id provided with new content.")
    public String updateAttachment(
            @Parameter(required = true) @PathParam("projectId") String projectId,
            @Parameter(required = true) @PathParam("workItemId") String workItemId,
            @Parameter(required = true) @PathParam("attachmentId") String attachmentId,
            @Parameter(required = true) @FormDataParam("content") String content) {
        return TransactionalExecutor.executeInWriteTransaction(
                transaction -> PolarionWorkItem.updateAttachment(polarionService, projectId, workItemId, attachmentId, content).getId());
    }
}
