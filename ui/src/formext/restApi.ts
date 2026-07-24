import type { SendRequest } from '@grigoriev/react-sbb-polarion';
import type { PanelContext } from './types';

/**
 * Attachment REST calls for the JSON editor panel, ported from the legacy json-editor.js
 * (SbbCommon.callAsync) onto the extension's `useRemote().sendRequest`. The base path selects the
 * WorkItem or Document endpoints exactly as the legacy `entityBaseUrl` did, URL-encoding every path
 * segment so names with spaces / special characters are transmitted correctly.
 */
export function entityBasePath(ctx: PanelContext): string {
  const project = encodeURIComponent(ctx.projectId);
  return ctx.spaceId
    ? `/projects/${project}/documents/${encodeURIComponent(ctx.spaceId)}/${encodeURIComponent(ctx.entityId)}`
    : `/projects/${project}/workitems/${encodeURIComponent(ctx.entityId)}`;
}

/** Reads a response's text, throwing an Error carrying the server message on a non-OK status. */
async function readText(response: Response): Promise<string> {
  const text = await response.text();
  if (!response.ok) {
    // The endpoints produce text/plain; some errors come back as a JSON { errorMessage } (e.g. the
    // useRemote network-error shim), so surface that field when present.
    let message = text;
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.errorMessage === 'string') {
        message = parsed.errorMessage;
      }
    } catch {
      // not JSON - use the raw text
    }
    throw new Error(message || `Request failed (HTTP ${response.status})`);
  }
  return text;
}

/** GET an attachment's content. */
export async function getAttachmentContent(
  sendRequest: SendRequest,
  ctx: PanelContext,
  attachmentId: string,
): Promise<string> {
  const response = await sendRequest({
    method: 'GET',
    url: `${entityBasePath(ctx)}/attachments/${encodeURIComponent(attachmentId)}/content`,
  });
  return readText(response);
}

/** POST a new attachment with the given file name; returns the new attachment id. */
export async function createAttachment(sendRequest: SendRequest, ctx: PanelContext, fileName: string): Promise<string> {
  const body = new FormData();
  body.append('fileName', fileName);
  const response = await sendRequest({ method: 'POST', url: `${entityBasePath(ctx)}/attachments`, body });
  return readText(response);
}

/** PATCH an existing attachment's content. */
export async function updateAttachment(
  sendRequest: SendRequest,
  ctx: PanelContext,
  attachmentId: string,
  content: string,
): Promise<void> {
  const body = new FormData();
  body.append('content', content);
  const response = await sendRequest({
    method: 'PATCH',
    url: `${entityBasePath(ctx)}/attachments/${encodeURIComponent(attachmentId)}`,
    body,
  });
  await readText(response);
}
