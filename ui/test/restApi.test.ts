import type { SendRequest } from '@grigoriev/react-sbb-polarion';
import { describe, expect, it, vi } from 'vitest';
import { createAttachment, entityBasePath, getAttachmentContent, updateAttachment } from '../src/formext/restApi';
import type { PanelContext } from '../src/formext/types';

// The attachment REST calls, ported from the legacy json-editor.js. Exercised with a fake sendRequest
// (the same shape useRemote returns) so no Polarion / fetch is involved.

const WORKITEM: PanelContext = { projectId: 'my proj', entityId: 'WI 1', spaceId: '', validateOnSave: false };
const DOCUMENT: PanelContext = { projectId: 'proj', entityId: 'My Doc', spaceId: 'My Space', validateOnSave: true };

const okText = (text: string): SendRequest =>
  vi.fn(async () => new Response(text, { status: 200 })) as unknown as SendRequest;

describe('entityBasePath', () => {
  it('builds the WorkItem path, URL-encoding every segment', () => {
    expect(entityBasePath(WORKITEM)).toBe('/projects/my%20proj/workitems/WI%201');
  });

  it('builds the Document path from space + name', () => {
    expect(entityBasePath(DOCUMENT)).toBe('/projects/proj/documents/My%20Space/My%20Doc');
  });
});

describe('getAttachmentContent', () => {
  it('GETs the content endpoint and returns the body text', async () => {
    const sendRequest = okText('{"a":1}');
    const content = await getAttachmentContent(sendRequest, WORKITEM, 'att 7');
    expect(content).toBe('{"a":1}');
    expect(sendRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/projects/my%20proj/workitems/WI%201/attachments/att%207/content',
    });
  });

  it('throws the server text on a non-OK response', async () => {
    const sendRequest = vi.fn(async () => new Response('boom', { status: 500 })) as unknown as SendRequest;
    await expect(getAttachmentContent(sendRequest, WORKITEM, 'a')).rejects.toThrow('boom');
  });

  it('unwraps a JSON errorMessage body', async () => {
    const sendRequest = vi.fn(
      async () => new Response(JSON.stringify({ errorMessage: 'nope' }), { status: 503 }),
    ) as unknown as SendRequest;
    await expect(getAttachmentContent(sendRequest, WORKITEM, 'a')).rejects.toThrow('nope');
  });

  it('keeps the raw text when the error body is JSON without an errorMessage field', async () => {
    const sendRequest = vi.fn(async () => new Response('{"other":1}', { status: 500 })) as unknown as SendRequest;
    await expect(getAttachmentContent(sendRequest, WORKITEM, 'a')).rejects.toThrow('{"other":1}');
  });

  it('falls back to a status message when the error body is empty', async () => {
    const sendRequest = vi.fn(async () => new Response('', { status: 500 })) as unknown as SendRequest;
    await expect(getAttachmentContent(sendRequest, WORKITEM, 'a')).rejects.toThrow('Request failed (HTTP 500)');
  });
});

describe('createAttachment', () => {
  it('POSTs multipart form data and returns the new id', async () => {
    const sendRequest = okText('newId');
    const id = await createAttachment(sendRequest, DOCUMENT, 'file.json');
    expect(id).toBe('newId');
    const call = (sendRequest as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.method).toBe('POST');
    expect(call.url).toBe('/projects/proj/documents/My%20Space/My%20Doc/attachments');
    expect(call.body).toBeInstanceOf(FormData);
    expect((call.body as FormData).get('fileName')).toBe('file.json');
  });
});

describe('updateAttachment', () => {
  it('PATCHes the attachment with the content form field', async () => {
    const sendRequest = okText('');
    await updateAttachment(sendRequest, WORKITEM, 'a b', '{"x":1}');
    const call = (sendRequest as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.method).toBe('PATCH');
    expect(call.url).toBe('/projects/my%20proj/workitems/WI%201/attachments/a%20b');
    expect((call.body as FormData).get('content')).toBe('{"x":1}');
  });

  it('throws on a non-OK response', async () => {
    const sendRequest = vi.fn(async () => new Response('denied', { status: 403 })) as unknown as SendRequest;
    await expect(updateAttachment(sendRequest, WORKITEM, 'a', '{}')).rejects.toThrow('denied');
  });
});
