/**
 * Fetches a project's documents from the standard Polarion platform REST API
 * (`GET /polarion/rest/v1/projects/{projectId}/documents`, JSON:API shape). Used only by the dev
 * panel harness to let a developer pick a real Document (space + name) to feed the panel, since
 * `vite dev` has no Polarion editor context. Proxied in dev and authenticated with VITE_BEARER_TOKEN.
 *
 * Each document carries `attributes.moduleFolder` (the space id) and `attributes.moduleName` (the
 * document name) - the two values the panel needs for a Document context.
 */

export interface ProjectDocument {
  spaceId: string;
  moduleName: string;
}

const documentsUrl = (projectId: string): string =>
  `/polarion/rest/v1/projects/${encodeURIComponent(projectId)}/documents` +
  `?page%5Bsize%5D=100&fields%5Bdocuments%5D=moduleName%2CmoduleFolder`;

export async function fetchDocuments(projectId: string): Promise<ProjectDocument[]> {
  const token = import.meta.env.VITE_BEARER_TOKEN;
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(documentsUrl(projectId), { headers, cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const body = await response.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = body?.data ?? [];
  return data
    .map((item) => ({
      spaceId: item?.attributes?.moduleFolder ?? '',
      moduleName: item?.attributes?.moduleName ?? '',
    }))
    .filter((d: ProjectDocument) => d.spaceId && d.moduleName)
    .sort((a: ProjectDocument, b: ProjectDocument) =>
      `${a.spaceId}/${a.moduleName}`.localeCompare(`${b.spaceId}/${b.moduleName}`),
    );
}
