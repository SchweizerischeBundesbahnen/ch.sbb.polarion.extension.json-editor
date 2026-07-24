import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCookie, setCookie } from '../src/services/cookies';
import { fetchDocuments } from '../src/services/documents';
import { isEmbedded } from '../src/services/params';
import { fetchProjects } from '../src/services/projects';
import { getProjectIdFromScope, getScope } from '../src/services/scope';
import { fetchWorkItems } from '../src/services/workitems';
import { installFetchMock, jsonResponse } from './mockFetch';

const origUrl = window.location.pathname + window.location.search;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.history.replaceState({}, '', origUrl);
  document.cookie = 'je-test=; path=/; max-age=0';
});

describe('cookies', () => {
  it('round-trips a value and returns null for a missing one', () => {
    expect(getCookie('je-test')).toBeNull();
    setCookie('je-test', 'hello world');
    expect(getCookie('je-test')).toBe('hello world');
  });
});

describe('scope', () => {
  it('normalizes a trailing slash and extracts the project id', () => {
    window.history.replaceState({}, '', '?scope=project/elibrary');
    expect(getScope()).toBe('project/elibrary/');
    expect(getProjectIdFromScope(getScope())).toBe('elibrary');
  });

  it('returns empty for global scope', () => {
    window.history.replaceState({}, '', '?');
    expect(getScope()).toBe('');
    expect(getProjectIdFromScope('')).toBe('');
  });
});

describe('params', () => {
  it('is embedded only when ?embedded=true', () => {
    window.history.replaceState({}, '', '?embedded=true');
    expect(isEmbedded()).toBe(true);
    window.history.replaceState({}, '', '?');
    expect(isEmbedded()).toBe(false);
  });
});

describe('fetchProjects', () => {
  it('maps and sorts the JSON:API project list', async () => {
    installFetchMock([
      {
        method: 'GET',
        match: /\/polarion\/rest\/v1\/projects/,
        json: {
          data: [
            { id: 'zeta', attributes: { name: 'Zeta' } },
            { id: 'alpha', attributes: { name: 'Alpha' } },
          ],
        },
      },
    ]);
    const projects = await fetchProjects();
    expect(projects.map((p) => p.id)).toEqual(['alpha', 'zeta']);
  });

  it('throws on a non-OK response', async () => {
    installFetchMock([{ method: 'GET', match: /\/projects/, respond: () => jsonResponse({}, 401) }]);
    await expect(fetchProjects()).rejects.toThrow();
  });

  it('sends the bearer token when configured', async () => {
    vi.stubEnv('VITE_BEARER_TOKEN', 'tok');
    const fetchMock = installFetchMock([{ method: 'GET', match: /\/projects/, json: { data: [] } }]);
    await fetchProjects();
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>)['Authorization']).toBe('Bearer tok');
  });

  it('falls back through the id/name fields and drops rows without an id', async () => {
    installFetchMock([
      {
        method: 'GET',
        match: /\/projects/,
        json: {
          data: [
            { attributes: { id: 'beta', name: 'Beta' } }, // id from attributes.id
            { id: 'gamma' }, // name falls back to the id
            { attributes: {} }, // no id anywhere -> dropped
          ],
        },
      },
    ]);
    expect(await fetchProjects()).toEqual([
      { id: 'beta', name: 'Beta' },
      { id: 'gamma', name: 'gamma' },
    ]);
  });

  it('returns an empty list when the response has no data array', async () => {
    installFetchMock([{ method: 'GET', match: /\/projects/, json: {} }]);
    expect(await fetchProjects()).toEqual([]);
  });
});

describe('fetchDocuments', () => {
  it('sends the bearer token when configured', async () => {
    vi.stubEnv('VITE_BEARER_TOKEN', 'tok');
    const fetchMock = installFetchMock([{ method: 'GET', match: /\/documents/, json: { data: [] } }]);
    await fetchDocuments('elibrary');
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>)['Authorization']).toBe('Bearer tok');
  });

  it('throws on a non-OK response', async () => {
    installFetchMock([{ method: 'GET', match: /\/documents/, respond: () => jsonResponse({}, 500) }]);
    await expect(fetchDocuments('elibrary')).rejects.toThrow();
  });

  it('maps moduleFolder/moduleName and drops incomplete rows', async () => {
    installFetchMock([
      {
        method: 'GET',
        match: /\/projects\/elibrary\/documents/,
        json: {
          data: [
            { attributes: { moduleFolder: 'Spec', moduleName: 'Catalog' } },
            { attributes: { moduleFolder: '', moduleName: 'NoSpace' } },
          ],
        },
      },
    ]);
    const docs = await fetchDocuments('elibrary');
    expect(docs).toEqual([{ spaceId: 'Spec', moduleName: 'Catalog' }]);
  });

  it('sorts multiple documents by space/name and drops rows missing a field', async () => {
    installFetchMock([
      {
        method: 'GET',
        match: /\/documents/,
        json: {
          data: [
            { attributes: { moduleFolder: 'Spec', moduleName: 'Zeta' } },
            { attributes: { moduleFolder: 'Spec', moduleName: 'Alpha' } },
            { attributes: { moduleFolder: 'Only' } }, // no moduleName -> dropped
            { attributes: {} }, // neither field -> dropped
          ],
        },
      },
    ]);
    expect(await fetchDocuments('elibrary')).toEqual([
      { spaceId: 'Spec', moduleName: 'Alpha' },
      { spaceId: 'Spec', moduleName: 'Zeta' },
    ]);
  });

  it('returns an empty list when the response has no data array', async () => {
    installFetchMock([{ method: 'GET', match: /\/documents/, json: {} }]);
    expect(await fetchDocuments('elibrary')).toEqual([]);
  });
});

describe('fetchWorkItems', () => {
  it('strips the project prefix from the JSON:API id', async () => {
    installFetchMock([
      {
        method: 'GET',
        match: /\/projects\/elibrary\/workitems/,
        json: { data: [{ id: 'elibrary/EL-42', attributes: { title: 'A title' } }] },
      },
    ]);
    const items = await fetchWorkItems('elibrary');
    expect(items).toEqual([{ workItemId: 'EL-42', title: 'A title' }]);
  });

  it('throws on a non-OK response', async () => {
    installFetchMock([{ method: 'GET', match: /\/workitems/, respond: () => jsonResponse({}, 500) }]);
    await expect(fetchWorkItems('elibrary')).rejects.toThrow();
  });

  it('sends the bearer token when configured', async () => {
    vi.stubEnv('VITE_BEARER_TOKEN', 'tok');
    const fetchMock = installFetchMock([{ method: 'GET', match: /\/workitems/, json: { data: [] } }]);
    await fetchWorkItems('elibrary');
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>)['Authorization']).toBe('Bearer tok');
  });

  it('sorts by id, keeps a prefix-less id, defaults a missing title, and drops rows without an id', async () => {
    installFetchMock([
      {
        method: 'GET',
        match: /\/workitems/,
        json: {
          data: [
            { id: 'elibrary/EL-9', attributes: { title: 'Nine' } },
            { id: 'EL-7' }, // no "project/" prefix -> used as-is; no title -> ''
            { attributes: {} }, // no id -> dropped
          ],
        },
      },
    ]);
    expect(await fetchWorkItems('elibrary')).toEqual([
      { workItemId: 'EL-7', title: '' },
      { workItemId: 'EL-9', title: 'Nine' },
    ]);
  });

  it('returns an empty list when the response has no data array', async () => {
    installFetchMock([{ method: 'GET', match: /\/workitems/, json: {} }]);
    expect(await fetchWorkItems('elibrary')).toEqual([]);
  });
});
