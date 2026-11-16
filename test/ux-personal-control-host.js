import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise real module render paths before the world toolbar has mounted.
for (const [file, factory, key] of [
  ['ux-feel.js', 'createOmertaFeel', 'feelOpen'],
  ['ux-tools.js', 'createOmertaTools', 'toolsOpen'],
]) {
  const nodes = [];
  const element = () => ({ dataset: {}, parentElement: null,
    append(node) { node.parentElement = this; },
    remove() { this.parentElement = null; },
  });
  const top = element(), menu = element(), toolbar = element();
  let mounted = false;
  const document = {
    body: { style: { setProperty() {} }, dataset: {}, classList: { toggle() {} } },
    addEventListener() {},
    createElement() { const node = element(); nodes.push(node); return node; },
    getElementById(id) { return ({ top, 'game-menu-content': menu })[id] || null; },
    querySelector(selector) {
      if (selector === '#ux-workspace-toolbar .ux-workspace-controls') return mounted ? toolbar : null;
      return nodes.find(node => node.parentElement && key in node.dataset && selector === `[data-${key === 'feelOpen' ? 'feel' : 'tools'}-open]`) || null;
    },
    querySelectorAll() { return []; },
  };
  const state = { session: { accountId: 'alice' }, me: { id: 'alice1' }, currentTab: 'streets' };
  const context = { window: {}, document, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null } };
  vm.runInNewContext(readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8'), context);
  const module = context.window[factory]({ getState: () => state });
  module.render();
  const button = nodes.find(node => key in node.dataset);
  assert.equal(button.parentElement, menu, `${file}: initial control stays inside Menu, not the narrow header row`);
  assert.equal(typeof button.onclick, 'function', 'Control retains its interaction');
  mounted = true;
  module.render(); module.render();
  assert.equal(button.parentElement, toolbar, 'Existing control relocates when toolbar mounts');
  assert.equal(nodes.filter(node => key in node.dataset).length, 1, 'Repeated render never duplicates control');
  mounted = false;
  module.render();
  assert.equal(button.parentElement, menu, 'Missing toolbar returns control to Menu');
  state.session = {}; state.me = {};
  module.render();
  assert.equal(button.parentElement, null, 'Sign-out removes the control');
}
console.log('Personal control host regression passed.');
