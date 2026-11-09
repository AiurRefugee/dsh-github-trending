import { type TrendingService } from '../trending/service.js';
/**
 * /trending 指令：与 github_trending 工具共用同一个服务实例，因此缓存也共享。
 */
export declare function registerTrendingCommand(commandsService: any, trending: TrendingService): void;
