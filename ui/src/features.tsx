import type { ComponentType } from 'react';
import About from './pages/About';
import PanelDev from './pages/PanelDev';

/**
 * A single navigable page of the app. The `id` is what appears in the URL as `?feature=<id>` and is
 * also what `hivemodule.xml` points its admin extenders at. Keep the ids stable and aligned with the
 * existing extender ids.
 */
export interface Feature {
  id: string;
  label: string;
  description: string;
  component: ComponentType;
}

export const FEATURES: Feature[] = [
  {
    id: 'about',
    label: 'About',
    description: 'Extension version and general information.',
    component: About,
  },
  {
    id: 'panel',
    label: 'JSON Editor Panel (dev)',
    description:
      'Dev harness for the WorkItem / Document Properties JSON editor panel - mounts it via the real shadow-root path (not a Polarion admin page).',
    component: PanelDev,
  },
];

export function findFeature(id: string | null): Feature | undefined {
  return FEATURES.find((f) => f.id === id);
}
