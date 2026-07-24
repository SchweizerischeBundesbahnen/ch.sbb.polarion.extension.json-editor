import { useEffect, useMemo, useRef, useState } from 'react';
import { PageLayout, SearchableSelect } from '@grigoriev/react-sbb-polarion';
import { mountJsonEditorPanel } from '../formext/mount';
import type { PanelContext } from '../formext/types';
import { fetchDocuments } from '../services/documents';
import type { ProjectDocument } from '../services/documents';
import { getProjectIdFromScope, getScope } from '../services/scope';
import { fetchWorkItems } from '../services/workitems';
import type { ProjectWorkItem } from '../services/workitems';

const HOST_ID = 'json-editor-panel';

type EntityType = 'workitem' | 'document';

/**
 * Dev-only harness for the WorkItem / Document Properties JSON editor panel. It exercises the **real**
 * form-extension mount path (`mountJsonEditorPanel`) in `vite dev`: the panel is mounted inside a
 * shadow root exactly as in the Polarion editor, so the encapsulated styling, the File dropdown, the
 * petrel code editor and the Edit/Validate/Save flow can be eyeballed and driven locally.
 *
 * There is no REST endpoint to list existing JSON attachments (in Polarion the list is computed
 * server-side and embedded in the fragment), so this harness starts the panel with an empty
 * attachment list: it drives the "New file" create/save flow and the editor. The "load an existing
 * file" path is covered by the Vitest tests (which mock the content endpoint).
 */
export default function PanelDev() {
  const projectId = getProjectIdFromScope(getScope());
  const [entityType, setEntityType] = useState<EntityType>('workitem');
  const [workItems, setWorkItems] = useState<ProjectWorkItem[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [entityId, setEntityId] = useState('');
  const [validateOnSave, setValidateOnSave] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setEntityId('');
    setError(null);
    const load = entityType === 'workitem' ? fetchWorkItems(projectId) : fetchDocuments(projectId);
    load
      .then((list) => {
        if (cancelled) return;
        if (entityType === 'workitem') setWorkItems(list as ProjectWorkItem[]);
        else setDocuments(list as ProjectDocument[]);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load entities. Set VITE_BEARER_TOKEN in ui/.env.local and restart dev.');
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, entityType]);

  const options =
    entityType === 'workitem'
      ? workItems.map((w) => ({ id: w.workItemId, name: w.title ? `${w.workItemId} - ${w.title}` : w.workItemId }))
      : documents.map((d) => ({ id: `${d.spaceId}/${d.moduleName}`, name: `${d.spaceId} / ${d.moduleName}` }));

  const context: PanelContext | undefined = useMemo(() => {
    if (!entityId) return undefined;
    if (entityType === 'workitem') {
      return { projectId, entityId, spaceId: '', validateOnSave };
    }
    const [spaceId, moduleName] = entityId.split('/');
    return { projectId, entityId: moduleName, spaceId, validateOnSave };
  }, [projectId, entityType, entityId, validateOnSave]);

  useEffect(() => {
    if (!hostRef.current || !context) return undefined;
    // Re-mounts when the context changes; mountInShadow reuses the shadow root and clears it.
    const root = mountJsonEditorPanel(`#${HOST_ID}`, { context, attachments: [] });
    return () => root?.unmount();
  }, [context]);

  return (
    <PageLayout title="JSON Editor Panel (dev harness)">
      <p className="landing-intro">
        Mounts the JSON editor panel through the real <code>mountJsonEditorPanel</code> path - inside a shadow root with
        react-sbb-polarion&apos;s stylesheet plus the panel CSS injected into it. Pick a WorkItem or Document to feed
        the panel the context it reads from the editor in Polarion, then drive New file / Edit / Validate / Save.
      </p>

      {!projectId && (
        <div className="alert alert-error">
          Pick a project scope from the <a href="?">Overview</a> page first - entities are listed per project.
        </div>
      )}

      {projectId && (
        <>
          <div className="landing-scope">
            <label>Entity type:</label>
            <SearchableSelect
              value={entityType}
              onChange={(v) => setEntityType(v as EntityType)}
              options={[
                { id: 'workitem', name: 'WorkItem' },
                { id: 'document', name: 'Document' },
              ]}
              placeholder=""
            />
          </div>
          <div className="landing-scope">
            <label>{entityType === 'workitem' ? 'WorkItem:' : 'Document:'}</label>
            <SearchableSelect
              value={entityId}
              onChange={setEntityId}
              options={options}
              placeholder="Select…"
              allowEmpty
            />
          </div>
          <div className="landing-scope">
            <label>
              <input type="checkbox" checked={validateOnSave} onChange={(e) => setValidateOnSave(e.target.checked)} />{' '}
              Validate on save
            </label>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
        </>
      )}

      {context && (
        <div
          id={HOST_ID}
          ref={hostRef}
          style={{ maxWidth: 640, border: '1px solid #ddd', padding: 12, marginTop: 12 }}
        />
      )}
    </PageLayout>
  );
}
