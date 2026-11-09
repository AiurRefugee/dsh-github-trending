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
  const { registerTrendingRoutes } = await import('../lib/api/routes.js');
  const service = { status: () => ({ configured: false }) };
  const settings = { snapshot: () => ({ hasKey: false }) };
  // Service absent in CLI/TUI profiles: no eager lookup or exception.
  registerTrendingRoutes({ get: () => { throw Error('undeclared service'); } }, service, settings, undefined);
}
console.log('dsh-github-trending: scrape+insight, cache, clock bound, routes, command — all passed.');
