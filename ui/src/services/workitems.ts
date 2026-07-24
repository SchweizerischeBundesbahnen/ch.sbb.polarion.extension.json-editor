/**
 * Fetches a project's WorkItem ids from the standard Polarion platform REST API
 * (`GET /polarion/rest/v1/projects/{projectId}/workitems`, JSON:API shape). Used only by the dev panel
 * harness to let a developer pick a real WorkItem to feed the panel a WorkItem context (spaceId empty).
 * Proxied in dev and authenticated with VITE_BEARER_TOKEN.
 */

export interface ProjectWorkItem {
  workItemId: string;
  title: string;
}

const workItemsUrl = (projectId: string): string =>
  `/polarion/rest/v1/projects/${encodeURIComponent(projectId)}/workitems` +
  `?page%5Bsize%5D=100&fields%5Bworkitems%5D=title`;

export async function fetchWorkItems(projectId: string): Promise<ProjectWorkItem[]> {
  const token = import.meta.env.VITE_BEARER_TOKEN;
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(workItemsUrl(projectId), { headers, cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const body = await response.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = body?.data ?? [];
  return data
    .map((item) => {
      // JSON:API ids look like "projectId/workItemId"; the panel needs only the WorkItem id.
      const rawId: string = item?.id ?? '';
      const workItemId = rawId.includes('/') ? rawId.slice(rawId.lastIndexOf('/') + 1) : rawId;
      return { workItemId, title: item?.attributes?.title ?? '' };
    })
    .filter((w: ProjectWorkItem) => w.workItemId)
    .sort((a: ProjectWorkItem, b: ProjectWorkItem) => a.workItemId.localeCompare(b.workItemId));
}
