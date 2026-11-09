import { TRENDING_PERIODS, type TrendingPeriod, type TrendingService } from '../trending/service.js';
import { renderTrendingMarkdown } from '../renderers/trending.js';

const SCOPES = [...TRENDING_PERIODS, 'all'];

/**
 * /trending 指令：与 github_trending 工具共用同一个服务实例，因此缓存也共享。
 */
export function registerTrendingCommand(commandsService: any, trending: TrendingService): void {
  if (!commandsService || typeof commandsService.register !== 'function') return;
  commandsService.register({
    name: 'trending',
    description: '查看 GitHub 每日 / 每周 / 每月热点榜单',
    async handler({ rawInput }: { rawInput: string }) {
      const scope = (rawInput || '').trim().toLowerCase() || 'daily';
      if (!SCOPES.includes(scope)) {
        return { kind: 'error', text: '用法：/trending [daily|weekly|monthly|all]' };
      }
      const periods: TrendingPeriod[] = scope === 'all' ? [...TRENDING_PERIODS] : [scope as TrendingPeriod];
      const results = await Promise.allSettled(periods.map(period => trending.get(period)));
      const items = results.flatMap(result => (result.status === 'fulfilled' ? [result.value] : []));
      const errors = results.flatMap((result, index) => (result.status === 'rejected'
        ? [{ period: periods[index], message: result.reason instanceof Error ? result.reason.message : String(result.reason) }]
        : []));
      if (items.length === 0) {
        return { kind: 'error', text: errors.map(e => `${e.period}：${e.message}`).join('\n') || '无法获取热点榜单' };
      }
      return { kind: 'success', text: renderTrendingMarkdown({ items, errors }) };
    },
  });
}
