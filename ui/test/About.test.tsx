import { pageViolations } from '@sbb-polarion/react-sbb-polarion/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import App from '../src/App';
import { installFetchMock } from './mockFetch';

// The About page is a thin wrapper feeding react-sbb-polarion's shared About component this app's
// sendRequest / appIcon / restApiUrl. Rendered through the router with the generic About endpoints
// mocked; RSP owns the deeper coverage of the component itself.

const origUrl = window.location.pathname + window.location.search;

const aboutRoutes = () => [
  {
    method: 'GET',
    match: /\/version$/,
    json: { bundleName: 'JSON Editor', bundleVendor: 'SBB', bundleVersion: '5.1.2' },
  },
  { method: 'GET', match: /\/configuration-properties$/, json: { properties: [], obsoleteProperties: [] } },
  { method: 'GET', match: /\/configuration-status/, json: [] },
  { method: 'GET', match: /\/readme$/, respond: () => new Response('<h1>Readme</h1>', { status: 200 }) },
];

async function renderAbout() {
  installFetchMock(aboutRoutes());
  window.history.replaceState({}, '', '?feature=about&embedded=true');
  render(<App />);
  await vi.waitFor(() => expect(document.querySelector('.about-table')).not.toBeNull());
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', origUrl);
});

describe('About page', () => {
  it('renders the shared About page for ?feature=about', async () => {
    await renderAbout();
    expect(document.body.textContent).toContain('JSON Editor');
    expect(document.querySelector('.about-page .app-icon')).not.toBeNull();
  });
});

describe('About page, accessibility', () => {
  it('has no WCAG A/AA violations', async () => {
    await renderAbout();
    await vi.waitFor(() => expect(document.body.textContent).toContain('Readme'));
    expect(await pageViolations()).toEqual([]);
  });
});
