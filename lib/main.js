import Schema from '@deepseek-ai/schemastery';
import { FirecrawlSettings } from './trending/settings.js';
import { TrendingService, createFileCacheStore } from './trending/service.js';
import { createTrendingTool } from './tools/trending.js';
import { registerTrendingRoutes } from './api/routes.js';
import { registerTrendingCommand } from './commands/trending.js';
export const name = 'dsh-github-trending';
const ConfigSchema = Schema.object({
    firecrawlBaseUrl: Schema.string(),
    trendingSource: Schema.string().default('scrape'),
    trendingCacheTtlMs: Schema.number().default(10_800_000),
    trendingTimeoutMs: Schema.number().default(60_000),
    trendingAgentTimeoutMs: Schema.number().default(180_000),
    trendingAgentMaxCredits: Schema.number().default(300),
});
export const Config = ConfigSchema;
export function apply(ctx, config = Config({})) {
    const settings = new FirecrawlSettings();
    const trending = new TrendingService({
        baseUrl: config.firecrawlBaseUrl || process.env.FIRECRAWL_BASE_URL,
        apiKey: settings.key(),
        store: createFileCacheStore(),
        cacheTtlMs: config.trendingCacheTtlMs,
        timeoutMs: config.trendingTimeoutMs,
        source: settings.source() ?? (String(config.trendingSource).toLowerCase() === 'agent' ? 'agent' : 'scrape'),
        agentTimeoutMs: config.trendingAgentTimeoutMs,
        agentMaxCredits: config.trendingAgentMaxCredits,
    });
    ctx.effect(() => () => trending.dispose());
    ctx.inject(['webServer'], (scope) => {
        registerTrendingRoutes(scope, trending, settings, scope.get('webServer'));
    });
    ctx.inject(['tools'], (scope) => {
        const tools = scope.get('tools');
        if (tools && typeof tools.register === 'function') {
            tools.register(createTrendingTool(trending));
        }
    });
    ctx.inject(['commands'], (scope) => {
        registerTrendingCommand(scope.get('commands'), trending);
    });
}
