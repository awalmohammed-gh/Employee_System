import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

let server, Loader, BrandingContext;
before(async () => {
  server = await createServer({ configFile: false, root: 'client', plugins: [react()], server: { middlewareMode: true, watch: null }, appType: 'custom' });
  Loader = (await server.ssrLoadModule('/src/components/ui/WorkspaceLoader.jsx')).default;
  BrandingContext = (await server.ssrLoadModule('/src/context/BrandingContext.jsx')).default;
});
after(async () => { await server?.close(); });
const render = (branding, props = {}) => renderToStaticMarkup(createElement(BrandingContext.Provider, { value: branding }, createElement(Loader, props)));

test('all loader variants display the current company logo and announce loading', () => {
  for (const props of [{}, { fullScreen: false }, { compact: true }, { inline: true }]) {
    const html = render({ companyName: 'Example Organization', logoUrl: '/uploads/current-logo.png' }, props);
    assert.match(html, /src="\/uploads\/current-logo.png"/);
    assert.match(html, /role="status"/);
    assert.match(html, /aria-live="polite"/);
  }
});
test('branding changes replace the logo without a hardcoded override', () => {
  const first = render({ companyName: 'First Company', logoUrl: '/first.png' });
  const next = render({ companyName: 'Updated Company', logoUrl: '/updated.png' }, { logoUrl: '/stale.png' });
  assert.match(first, /src="\/first.png"/);
  assert.match(next, /src="\/updated.png"/);
  assert.doesNotMatch(next, /first.png|stale.png/);
});
test('missing branding uses a neutral fallback; a configured name supplies initials', () => {
  assert.doesNotMatch(render({}), /<img|WorkPulse|eyenit/i);
  assert.match(render({ companyName: 'Example Organization', logoUrl: '' }), />EO<\/span>/);
});
test('inline loaders fit inside buttons and section loaders do not cover the page', () => {
  const inline = render({}, { inline: true });
  assert.match(inline, /company-loader--inline/);
  assert.doesNotMatch(inline, /<div|company-loader__copy|company-loader--page/);
  assert.match(render({}, { fullScreen: false }), /company-loader--section/);
});
