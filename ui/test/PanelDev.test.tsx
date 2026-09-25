import { pageViolations } from '@sbb-polarion/react-sbb-polarion/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import App from '../src/App';
import { installFetchMock } from './mockFetch';

// The dev harness for the JSON editor panel (?feature=panel). Not opened in Polarion and excluded from
// coverage; checked here for its own form controls. The panel it mounts has its own tests.

const origUrl = window.location.pathname + window.location.search;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', origUrl);
});

describe('Panel dev harness, accessibility', () => {
  it('has no WCAG A/AA violations', async () => {
    installFetchMock([
      { method: 'GET', match: /\/polarion\/rest\/v1\/projects\/elibrary\/workitems/, json: { data: [] } },
    ]);
    window.history.replaceState({}, '', '?feature=panel&scope=project/elibrary/');
    render(<App />);
    await vi.waitFor(() => expect(document.querySelectorAll('.landing-scope .sd-trigger')).toHaveLength(2));
    expect(await pageViolations()).toEqual([]);
  });
});
