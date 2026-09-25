import { pageViolations } from '@sbb-polarion/react-sbb-polarion/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import App from '../src/App';
import { findFeature } from '../src/features';
import { installFetchMock, jsonResponse } from './mockFetch';

// The top-level feature router: `?feature=<id>` selects a page, anything unmatched (incl. bare `/`)
// renders the dev Landing stub. Also covers the findFeature lookup. The About page has its own
// About.test.tsx.

const origUrl = window.location.pathname + window.location.search;

const PROJECTS = { data: [{ id: 'elibrary', attributes: { name: 'E-Library' } }] };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', origUrl);
  document.cookie = 'json-editor-dev-scope=; path=/; max-age=0';
});

describe('findFeature', () => {
  it('matches a known id and returns undefined otherwise', () => {
    expect(findFeature('about')?.id).toBe('about');
    expect(findFeature('panel')?.id).toBe('panel');
    expect(findFeature('nope')).toBeUndefined();
    expect(findFeature(null)).toBeUndefined();
  });
});

describe('App router', () => {
  it('renders the Landing stub with every feature linked when no feature is selected', async () => {
    installFetchMock([{ method: 'GET', match: /\/polarion\/rest\/v1\/projects/, json: PROJECTS }]);
    window.history.replaceState({}, '', '?'); // no feature -> Landing
    render(<App />);
    await vi.waitFor(() => expect(document.querySelector('.landing')).not.toBeNull());
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.feature-list a')).map((a) =>
      a.getAttribute('href'),
    );
    expect(links).toEqual(expect.arrayContaining(['?feature=about', '?feature=panel']));
  });

  it('pre-selects the scope from the ?scope param so feature links carry it', async () => {
    installFetchMock([{ method: 'GET', match: /\/polarion\/rest\/v1\/projects/, json: PROJECTS }]);
    window.history.replaceState({}, '', '?scope=project/elibrary');
    render(<App />);
    await vi.waitFor(() => expect(document.querySelector('.landing')).not.toBeNull());
    await vi.waitFor(() => {
      const hrefs = Array.from(document.querySelectorAll<HTMLAnchorElement>('.feature-list a')).map((a) =>
        a.getAttribute('href'),
      );
      expect(hrefs.some((h) => h?.includes('scope=project%2Felibrary%2F'))).toBe(true);
    });
  });

  it('shows an error when projects cannot be loaded', async () => {
    installFetchMock([
      { method: 'GET', match: /\/polarion\/rest\/v1\/projects/, respond: () => jsonResponse({}, 401) },
    ]);
    window.history.replaceState({}, '', '?');
    render(<App />);
    await vi.waitFor(() => expect(document.querySelector('.landing .alert-error')).not.toBeNull());
    expect(document.querySelector('.alert-error')!.textContent).toContain('Could not load projects');
  });
});

describe('Landing page, accessibility', () => {
  it('has no WCAG A/AA violations', async () => {
    installFetchMock([{ method: 'GET', match: /\/polarion\/rest\/v1\/projects/, json: PROJECTS }]);
    window.history.replaceState({}, '', '?');
    render(<App />);
    await vi.waitFor(() => expect(document.querySelector('.landing .sd-trigger')).not.toBeNull());
    expect(await pageViolations()).toEqual([]);
  });
});
