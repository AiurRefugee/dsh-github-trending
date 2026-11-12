import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const episodeFile = /^\d{4}-\d{2}-\d{2}-[a-f0-9]{64}\.mp3$/;
const escapeXml = value => String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));

export async function publishPodcast({ dir, days, today, article, audio, previousEpisodes = [], siteUrl, now = new Date() }) {
  const base = new URL(siteUrl.endsWith('/') ? siteUrl : siteUrl + '/');
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw Error('播客网址必须为无凭据的 HTTPS 地址');
  const folder = path.join(dir, 'episodes');
  await mkdir(folder, { recursive: true });
  const hash = createHash('sha256').update(audio).digest('hex');
  const file = `${today}-${hash}.mp3`;
  const publishedAt = now.toISOString();
  const existing = previousEpisodes.find(e => e.file === file);
  const current = existing || { file, publishedAt, size: audio.length, description: article };
  const currentDay = days.find(d => d.date === today);
  if (!currentDay) throw Error('播客缺少今日历史记录');
  currentDay.episodes = [...previousEpisodes.filter(e => e.file !== file), current];
  const episodes = days.flatMap(d => Array.isArray(d.episodes) ? d.episodes : [])
    .filter(e => typeof e.file === 'string' && episodeFile.test(e.file) && Number.isSafeInteger(e.size) && e.size > 0 && Number.isFinite(Date.parse(e.publishedAt)));
  // Do not emit an enclosure for missing or corrupted local audio.
  await writeFile(path.join(folder, file), audio);
  for (const e of episodes) {
    const bytes = await readFile(path.join(folder, e.file));
    if (bytes.length !== e.size || createHash('sha256').update(bytes).digest('hex') !== e.file.slice(11, -4)) throw Error('播客音频不存在或不完整');
  }
  const keep = new Set(episodes.map(e => e.file));
  for (const name of await readdir(folder)) {
    if (episodeFile.test(name) && !keep.has(name)) await unlink(path.join(folder, name));
  }
  const items = episodes.sort((a,b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).map(e => {
    const url = new URL('episodes/' + e.file, base).href;
    return `<item><title>GitHub 热点速播 · ${escapeXml(e.file.slice(0,10))}</title><guid isPermaLink="false">${escapeXml(url)}</guid><pubDate>${new Date(e.publishedAt).toUTCString()}</pubDate><description>${escapeXml(e.description || 'GitHub 热点项目中文速播')}</description><enclosure url="${escapeXml(url)}" length="${e.size}" type="audio/mpeg"/></item>`;
  }).join('\n');
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>GitHub 热点速播</title><link>${escapeXml(base.href)}</link><description>每天用中文介绍 GitHub 热点项目。</description><language>zh-cn</language><atom:link href="${escapeXml(new URL('feed.xml',base).href)}" rel="self" type="application/rss+xml"/>${items}</channel></rss>\n`;
  await writeFile(path.join(dir, 'feed.xml'), rss);
}
