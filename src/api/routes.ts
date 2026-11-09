import type { FirecrawlSettings } from '../trending/settings.js';
import { TrendingService, parseTrendingPeriod } from '../trending/service.js';

const PREFIX = '/api/github-trending';

function sendJson(res: any, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

function readJsonBody(req: any, limit = 8192): Promise<any> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('请求体过大'));
        req.destroy?.();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new Error('请求体不是合法 JSON'));
      }
    });
    req.on('error', () => reject(new Error('读取请求体失败')));
  });
}

/** 只接受同源、带 JSON Content-Type 的写请求，避免任意网页触发额度消耗或改配置。 */
function guardLocalWrite(req: any, res: any, opts: { requireJson?: boolean } = {}): boolean {
  const origin = typeof req.headers?.origin === 'string' ? req.headers.origin : '';
  const host = String(req.headers?.host || '');
  if (origin) {
    let originHost = '';
    try { originHost = new URL(origin).host; } catch { originHost = ''; }
    if (!originHost || originHost !== host) {
      sendJson(res, 403, { ok: false, error: '仅允许本地页面调用' });
      return false;
    }
  }
  if (opts.requireJson) {
    const type = String(req.headers?.['content-type'] || '');
    if (!type.includes('application/json')) {
      sendJson(res, 415, { ok: false, error: '需要 Content-Type: application/json' });
      return false;
    }
  }
  return true;
}

export function registerTrendingRoutes(ctx: any, service: TrendingService, settings: FirecrawlSettings): void {
  const webServer = typeof ctx?.get === 'function' ? ctx.get('webServer') : undefined;
  if (!webServer || typeof webServer.register !== 'function') return;

  const bind = (route: any) => {
    if (typeof ctx.effect !== 'function') {
      webServer.register(route);
      return;
    }
    // Cordis 插件热重载时旧 disposer 可能没跑完，先清掉同名残留再注册，避免 duplicate route。
    ctx.effect(() => {
      const table = route.kind === 'exact' ? webServer.exact : webServer.prefixes;
      if (table && typeof table.has === 'function' && table.has(route.path)) table.delete(route.path);
      return webServer.register(route);
    }, `github-trending: ${route.path}`);
  };

  bind({ kind: 'exact', path: `${PREFIX}/settings`, handler: async (req: any, res: any) => {
    if (req.method === 'GET') {
      if (!guardLocalWrite(req, res)) return;
      sendJson(res, 200, { ok: true, data: settings.snapshot() });
      return;
    }
    if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: '仅支持 GET / POST 请求' }); return; }
    if (!guardLocalWrite(req, res, { requireJson: true })) return;
    try {
      const body = await readJsonBody(req, 4096);
      const state = settings.save(body);
      service.setApiKey(settings.key());
      if (state.trendingSource === 'scrape' || state.trendingSource === 'agent') {
        service.setSource(state.trendingSource);
      }
      sendJson(res, 200, { ok: true, data: state });
    } catch (error: any) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
  } });

  bind({ kind: 'exact', path: `${PREFIX}/trending`, handler: async (req: any, res: any) => {
    if (req.method === 'GET') {
      sendJson(res, 200, { ok: true, data: service.status() });
      return;
    }
    if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: '仅支持 GET / POST 请求' }); return; }
    if (!guardLocalWrite(req, res, { requireJson: true })) return;
    let period;
    let refresh;
    try {
      const body = await readJsonBody(req);
      period = parseTrendingPeriod(body?.period ?? 'daily');
      if (body?.refresh !== undefined && typeof body.refresh !== 'boolean') throw new Error('refresh 必须为布尔值');
      refresh = body?.refresh === true;
    } catch (error: any) {
      sendJson(res, 400, { ok: false, error: error.message });
      return;
    }
    try {
      sendJson(res, 200, { ok: true, data: await service.get(period, refresh) });
    } catch (error: any) {
      sendJson(res, service.status().configured ? 502 : 503, { ok: false, error: error.message });
    }
  } });
}
