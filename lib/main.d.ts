import Schema from '@deepseek-ai/schemastery';
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "dsh-github-trending";
export type Config = {
    firecrawlBaseUrl?: string;
    trendingSource?: string;
    trendingCacheTtlMs?: number;
    trendingTimeoutMs?: number;
    trendingAgentTimeoutMs?: number;
    trendingAgentMaxCredits?: number;
};
export declare const Config: Schema<Schemastery.ObjectS<NoInfer<{
    firecrawlBaseUrl: Schema<string, string, "plain">;
    trendingSource: Schema<string, string, "defined">;
    trendingCacheTtlMs: Schema<number, number, "defined">;
    trendingTimeoutMs: Schema<number, number, "defined">;
    trendingAgentTimeoutMs: Schema<number, number, "defined">;
    trendingAgentMaxCredits: Schema<number, number, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    firecrawlBaseUrl: Schema<string, string, "plain">;
    trendingSource: Schema<string, string, "defined">;
    trendingCacheTtlMs: Schema<number, number, "defined">;
    trendingTimeoutMs: Schema<number, number, "defined">;
    trendingAgentTimeoutMs: Schema<number, number, "defined">;
    trendingAgentMaxCredits: Schema<number, number, "defined">;
}>>, "plain">;
export declare function apply(ctx: Context, config?: Config): void;
