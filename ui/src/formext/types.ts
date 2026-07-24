/**
 * The context the JSON editor panel needs to talk to the REST API and build file names. In Polarion
 * this is computed server-side by JsonEditorFormExtension and embedded in the fragment
 * (data-* attributes); the dev harness builds it from a picked WorkItem / Document.
 */
export interface PanelContext {
  projectId: string;
  /** WorkItem id, or (for a Document) the module/document name. */
  entityId: string;
  /** The document's space id; empty for a WorkItem. */
  spaceId: string;
  /** Whether Save must validate the JSON first (the `validateOnSave` form-layout attribute). */
  validateOnSave: boolean;
}

/** A JSON attachment already present on the WorkItem / Document. */
export interface Attachment {
  id: string;
  fileName: string;
}
