import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { TrendingService, createFileCacheStore, TRENDING_ITEM_SCHEMA } = await import('../lib/trending/service.js');

const row = {
  name: 'owner/repo', url: 'https://github.com/owner/repo', description: 'A useful project',
  descriptionZh: '一个有用的项目', language: 'TypeScript', stars: '12,345', starsToday: '321',
};
const json = (data) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });

// 1. 一次 scrape 同时得到榜单、译文与总结
{
  const calls = [];
  const fetchMock = async (url, options) => {
    calls.push({ url, body: options.body ? JSON.parse(options.body) : undefined });
    return json({ success: true, data: { json: {
      repositories: [row], summary: '中文总结', observations: ['要点一'],
    } } });
  };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trending-standalone-'));
  const service = new TrendingService({ apiKey: 'k', source: 'scrape', store: createFileCacheStore(dir) }, fetchMock, () => 1_700_000_000_000);
  const board = await service.get('daily');

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.firecrawl.dev/v2/scrape');
  assert.deepEqual(calls[0].body.formats[0].schema.properties.repositories.items.properties.name, TRENDING_ITEM_SCHEMA.properties.name);
  assert.equal(board.items[0].stars, 12345, 'thousands separator normalised');
  assert.equal(board.insight.summary, '中文总结');
  assert.deepEqual(board.insight.descriptionsZh, { 'owner/repo': '一个有用的项目' });
  assert.equal(board.insightMode, 'scrape');
  assert.equal(Object.prototype.hasOwnProperty.call(board.items[0], 'descriptionZh'), false, 'sidecar never leaks into a row');

  // 缓存命中与落盘复用
  await service.get('daily');
  assert.equal(calls.length, 1, 'cache hit does not spend credits');
  const reloaded = new TrendingService({ apiKey: 'k', source: 'scrape', store: createFileCacheStore(dir) },
    async () => { throw new Error('persisted board must not hit the network'); }, () => 1_700_000_000_001);
  assert.equal((await reloaded.get('daily')).fetchedAt, board.fetchedAt);
  reloaded.dispose();
  service.dispose();
  fs.rmSync(dir, { recursive: true, force: true });
}

// 2. 时钟回拨不再永久命中
{
  let now = 1_700_000_000_000;
  let calls = 0;
  const service = new TrendingService({ apiKey: 'k', source: 'scrape' }, async () => {
    calls++;
    return json({ success: true, data: { json: { repositories: [{ ...row, stars: 1, starsToday: 1 }], summary: 's', observations: ['o'] } } });
  }, () => now);
  await service.get('daily');
  const first = calls;
  now -= 600_000;
  await service.get('daily');
  assert.ok(calls > first, 'rewound clock refetches');
  service.dispose();
}

// 3. 路由只暴露 trending 与 settings，且拒绝跨站写
{
  const { registerTrendingRoutes } = await import('../lib/api/routes.js');
  const bound = new Map();
  const webServer = { exact: new Map(), prefixes: new Map(), register: (route) => { bound.set(route.path, route.handler); return () => {}; } };
  const ctx = { get: () => { throw new Error('undeclared service access'); }, effect: (fn) => { const dispose = fn(); return typeof dispose === 'function' ? dispose : () => {}; } };
  const settings = { snapshot: () => ({ hasKey: true, trendingSource: 'scrape' }), save: () => ({ trendingSource: 'scrape' }), key: () => 'k' };
  const service = new TrendingService({ apiKey: 'k', source: 'scrape' }, async () => json({ success: true, data: { json: { repositories: [row], summary: 's', observations: ['o'] } } }));
  registerTrendingRoutes(ctx, service, settings, webServer);
  assert.deepEqual([...bound.keys()].sort(), ['/api/github-trending/settings', '/api/github-trending/trending']);

  const handler = bound.get('/api/github-trending/trending');
  let status = 0;
  let body = '';
  const res = { setHeader() {}, end(text) { body = text; }, set statusCode(v) { status = v; }, get statusCode() { return status; } };
  const req = { method: 'POST', headers: { origin: 'https://evil.example', host: 'localhost:3000', 'content-type': 'application/json' },
    on(event, cb) { if (event === 'end') cb(); } };
  await handler(req, res);
  assert.equal(status, 403);
  assert.match(body, /仅允许本地页面/);
  service.dispose();
}

// 4. /trending 指令
{
  const { registerTrendingCommand } = await import('../lib/commands/trending.js');
  const registered = [];
  const service = {
    get: async (period) => ({ period, sourceUrl: 'https://github.com/trending?since=daily', fetchedAt: '2026-11-09T00:00:00.000Z', stale: false,
      items: [{ name: 'owner/repo', url: 'https://github.com/owner/repo', description: 'd', language: 'TS', stars: 1, starsToday: 1 }] }),
  };
  registerTrendingCommand({ register: (cmd) => registered.push(cmd) }, service);
  const command = registered.find((cmd) => cmd.name === 'trending');
  assert.ok(command, 'registers /trending');
  const output = await command.handler({ rawInput: 'weekly' });
  assert.equal(output.kind, 'success');
  assert.match(output.text, /GitHub weekly/);
  const bad = await command.handler({ rawInput: 'yearly' });
  assert.equal(bad.kind, 'error');
}

// 5. Startup regression: the deployed entry uses the same injected-service contract as src.
// This catches accidental releases of stale lib/*.js even when TypeScript compiles.
{
  const srcMain = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const builtMain = fs.readFileSync(new URL('../lib/main.js', import.meta.url), 'utf8');
  const srcRoutes = fs.readFileSync(new URL('../src/api/routes.ts', import.meta.url), 'utf8');
  const builtRoutes = fs.readFileSync(new URL('../lib/api/routes.js', import.meta.url), 'utf8');
  for (const entry of [srcMain, builtMain]) {
    assert.match(entry, /ctx\.inject\(\['webServer'\]/);
    assert.match(entry, /ctx\.inject\(\['tools'\]/);
    assert.match(entry, /ctx\.inject\(\['commands'\]/);
    assert.doesNotMatch(entry, /const tools\s*=\s*ctx\.tools/);
  }
  for (const routeCode of [srcRoutes, builtRoutes]) {
    assert.doesNotMatch(routeCode, /ctx\??\.get\(['"]webServer['"]\)/);
    assert.match(routeCode, /registerTrendingRoutes\(/);
  }
  // Import the actual deployed entry and simulate a DSH profile without any optional services.
  const plugin = await import('../lib/main.js');
  assert.equal(plugin.name, 'dsh-github-trending');
  const injections = [];
  const context = {
    effect(fn) { return fn(); },
    inject(names, fn) {
      injections.push(names[0]);
      if (names[0] === 'tools') {
        fn({ get(name) { assert.equal(name, 'tools'); return { register(tool) {
          assert.equal(tool.name, 'github_trending');
        } }; } });
      }
      // webServer / commands are unavailable here; Cordis invokes those later when ready.
    },
    get() { throw new Error('root context cannot access undeclared services'); },
  };
  assert.doesNotThrow(() => plugin.apply(context));
  assert.deepEqual(injections, ['webServer', 'tools', 'commands']);
  const { registerTrendingRoutes } = await import('../lib/api/routes.js');
  const service = { status: () => ({ configured: false }) };
  const settings = { snapshot: () => ({ hasKey: false }) };
  // Service absent in CLI/TUI profiles: no eager lookup or exception.
  registerTrendingRoutes({ get: () => { throw Error('undeclared service'); } }, service, settings, undefined);
}

// 6. Sidebar navigation smoke test: the host resolves sidebar id via the main keyed slot.
// Reproduce the real browser entry registration to detect mismatched keys before release.
{
  const vm = await import('node:vm');
  const clientCode = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8');
  let plugin;
  const browser = { document: {}, __ModuleLoader__: { load(def) {
    plugin = def.factory((id) => {
      assert.equal(id, 'react');
      return { createElement: () => ({}) };
    });
  } } };
  vm.runInNewContext(clientCode, { window: browser }, { filename: 'client.js' });
  assert.equal(plugin.name, 'dsh-github-trending');
  const registered = [];
  const ctx = {
    effect: () => {},
    slots: {
      inject(name, register) { register(); },
      register(meta, component) {
        registered.push({ meta, component });
        return () => {};
      },
    },
  };
  plugin.apply(ctx);
  const sidebar = registered.find(item => item.meta.name === 'sidebar.panellist');
  const main = registered.find(item => item.meta.name === 'main');
  assert.ok(sidebar && main, 'both sidebar and main panel must be registered');
  assert.equal(sidebar.meta.id, main.meta.key, 'sidebar id must match main key for DSH navigation');
  assert.equal(typeof main.component, 'function');
}


// 7. Modal UI smoke test: settings is a dialog, not an inline form inside dashboard layout.
{
  const vm = await import('node:vm');
  const code = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8');
  let entry, state = [], cursor = 0;
  const React = {
    createElement(type, props, ...children) { return { type, props: props || {}, children: children.flat() }; },
    useState(initial) {
      const i = cursor++;
      if (!(i in state)) state[i] = initial;
      return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next; }];
    },
    useCallback(fn) { return fn; },
    useRef(value) { return { current: value }; },
    useEffect() {},
  };
  const browser = { document: {}, __ModuleLoader__: { load(def) { entry = def.factory(() => React); } } };
  vm.runInNewContext(code, { window: browser }, { filename: 'client.js' });
  let Page;
  entry.apply({ effect() {}, slots: { inject(_name, cb) { cb(); },
    register(meta, component) { if (meta.name === 'main') Page = component; return () => {}; } } });
  function render() { cursor = 0; return Page(); }
  function all(node, filter, found = []) {
    if (!node || typeof node !== 'object') return found;
    if (filter(node)) found.push(node);
    for (const child of node.children || []) all(child, filter, found);
    return found;
  }
  let tree = render();
  assert.equal(all(tree, n => n.props.role === 'dialog').length, 0, 'dialog is hidden by default');
  const settingsButton = all(tree, n => n.props['aria-label'] === '打开热点看板设置')[0];
  assert.ok(settingsButton, 'settings trigger exists in dashboard header');
  settingsButton.props.onClick();
  tree = render();
  const dialog = all(tree, n => n.props.role === 'dialog')[0];
  assert.ok(dialog, 'click opens a real accessible dialog');
  assert.equal(dialog.props['aria-modal'], true);
  assert.equal(dialog.props['aria-labelledby'], 'dsh-trending-settings-title');
  assert.ok(all(dialog, n => n.type === 'input' && n.props.type === 'password').length === 1);
  assert.equal(all(tree, n => n.props.className === 'dsh-trending-settings').length, 0,
    'old inline settings panel is removed');
  all(dialog, n => n.props['aria-label'] === '关闭设置')[0].props.onClick();
  assert.equal(all(render(), n => n.props.role === 'dialog').length, 0, 'close button dismisses dialog');
}

// 8. DSH main slot is height-constrained; a long table must remain vertically scrollable.
{
  const vm = await import('node:vm');
  const source = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8');
  const styles = [];
  const doc = {
    getElementById() { return null; },
    createElement(tag) { assert.equal(tag, 'style'); return { id: '', textContent: '' }; },
    head: { appendChild(el) { styles.push(el.textContent); } },
  };
  let entry;
  const browser = { document: doc, __ModuleLoader__: { load(def) {
    entry = def.factory(() => ({ createElement() {} }));
  } } };
  vm.runInNewContext(source, { window: browser, document: doc }, { filename: 'client.js' });
  entry.apply({ effect(callback) { callback(); }, slots: { inject() {} } });
  const css = styles.join('\n');
  const root = css.match(/\.dsh-trending-panel\{([^}]+)\}/);
  assert.ok(root, 'main panel scroll styles are injected');
  for (const property of ['box-sizing:border-box', 'width:100%', 'max-width:100%', 'height:100%', 'min-height:0', 'overflow-y:auto', 'overflow-x:hidden']) {
    assert.ok(root[1].includes(property), 'main panel requires ' + property);
  }
  // A width:100% content-box root plus padding overflows its host viewport.
  const layout = css.match(/\\.dsh-trending-body\\{([^}]+)\\}/);
  assert.ok(layout && layout[1].includes('max-width:100%'), 'two-column layout must not enlarge the root');
  const table = css.match(/\.dsh-trending-table-scroll\{([^}]+)\}/);
  assert.ok(table && table[1].includes('overflow-x:auto'), 'wide tables must retain horizontal scrolling');
}
console.log('dsh-github-trending: scrape+insight, cache, clock bound, routes, command — all passed.');
