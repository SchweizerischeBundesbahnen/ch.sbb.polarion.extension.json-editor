package ch.sbb.polarion.extension.json.editor.rest.controller;

import ch.sbb.polarion.extension.generic.service.PolarionService;
import ch.sbb.polarion.extension.json.editor.helper.PolarionWorkItem;
import com.polarion.alm.shared.api.transaction.TransactionalExecutor;
import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.glassfish.jersey.media.multipart.FormDataParam;

import jakarta.inject.Singleton;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

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
                transaction -> PolarionWorkItem.getAttachmentContent(polarionService.getWorkItem(projectId, workItemId), attachmentId));
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
                transaction -> PolarionWorkItem.createAttachment(polarionService.getWorkItem(projectId, workItemId), fileName).getId());
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
                transaction -> PolarionWorkItem.updateAttachment(polarionService.getWorkItem(projectId, workItemId), attachmentId, content).getId());
    }

    @GET
    @Path("/projects/{projectId}/documents/{spaceId}/{documentName}/attachments/{attachmentId}/content")
    @Produces(MediaType.TEXT_PLAIN)
    @Operation(summary = "Get attachment content by id.")
    public String getDocumentAttachmentContent(@Parameter(required = true) @PathParam("projectId") String projectId,
                                       @Parameter(required = true) @PathParam("spaceId") String spaceId,
                                       @Parameter(required = true) @PathParam("documentName") String documentName,
                                       @Parameter(required = true) @PathParam("attachmentId") String attachmentId) {
        return TransactionalExecutor.executeSafelyInReadOnlyTransaction(
                transaction -> PolarionWorkItem.getAttachmentContent(polarionService.getModule(projectId, spaceId, documentName), attachmentId));
    }

    @POST
    @Path("/projects/{projectId}/documents/{spaceId}/{documentName}/attachments")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces(MediaType.TEXT_PLAIN)
    @Operation(summary = "Create new attachment with file name provided.")
    public String createDocumentAttachment(
            @Parameter(required = true) @PathParam("projectId") String projectId,
            @Parameter(required = true) @PathParam("spaceId") String spaceId,
            @Parameter(required = true) @PathParam("documentName") String documentName,
            @Parameter(required = true) @FormDataParam("fileName") String fileName) {
        return TransactionalExecutor.executeInWriteTransaction(
                transaction -> PolarionWorkItem.createAttachment(polarionService.getModule(projectId, spaceId, documentName), fileName).getId());
    }

    @PATCH
    @Path("/projects/{projectId}/documents/{spaceId}/{documentName}/attachments/{attachmentId}")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces(MediaType.TEXT_PLAIN)
    @Operation(summary = "Update existing attachment with id provided with new content.")
    public String updateDocumentAttachment(
            @Parameter(required = true) @PathParam("projectId") String projectId,
            @Parameter(required = true) @PathParam("spaceId") String spaceId,
            @Parameter(required = true) @PathParam("documentName") String documentName,
            @Parameter(required = true) @PathParam("attachmentId") String attachmentId,
            @Parameter(required = true) @FormDataParam("content") String content) {
        return TransactionalExecutor.executeInWriteTransaction(
                transaction -> PolarionWorkItem.updateAttachment(polarionService.getModule(projectId, spaceId, documentName), attachmentId, content).getId());
    }
}
