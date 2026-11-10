/**
 * 浏览器半边：注册一个 main 槽页面 + 侧边栏入口，渲染热点看板。
 * 零构建：本文件是手写 CommonJS 风格模块，宿主通过 __ModuleLoader__ 注入 React。
 */
(function () {
  var API = '/api/github-trending';
  var PERIODS = [['daily', '每日'], ['weekly', '每周'], ['monthly', '每月']];

  var CSS = [
    '.dsh-trending-panel{display:flex;flex-direction:column;gap:14px;padding:20px 22px;font-size:13px;color:var(--dsw-alias-label-primary,#1d1d1f)}',
    '.dsh-trending-head{display:flex;align-items:center;justify-content:space-between;gap:12px}',
    '.dsh-trending-head h2{margin:0;font-size:17px}',
    '.dsh-trending-tabs{display:flex;gap:6px}',
    '.dsh-trending-tab{border:1px solid var(--dsw-alias-border,rgba(60,60,67,.16));background:transparent;color:inherit;border-radius:999px;padding:4px 12px;cursor:pointer;font-size:12px}',
    '.dsh-trending-tab.active{background:var(--dsw-alias-bg-layer-2,#f2f2f7);border-color:var(--dsw-alias-link,#0a84ff)}',
    '.dsh-trending-btn{border:1px solid var(--dsw-alias-border,rgba(60,60,67,.16));background:transparent;color:inherit;border-radius:8px;padding:5px 12px;cursor:pointer;font-size:12px}',
    '.dsh-trending-btn:disabled{opacity:.5;cursor:default}',
    '.dsh-trending-body{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:16px;align-items:start}',
    '@media (max-width:900px){.dsh-trending-body{grid-template-columns:minmax(0,1fr)}}',
    '.dsh-trending-table{width:100%;border-collapse:collapse;font-size:12.5px}',
    '.dsh-trending-table th{text-align:left;font-weight:600;padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border,rgba(60,60,67,.16));white-space:nowrap}',
    '.dsh-trending-table td{padding:9px 10px;border-bottom:1px solid var(--dsw-alias-border,rgba(60,60,67,.08));vertical-align:top}',
    '.dsh-trending-name{font-weight:600;text-decoration:none;color:var(--dsw-alias-link,#0a84ff)}',
    '.dsh-trending-desc{color:var(--dsw-alias-label-secondary,#6e6e73);line-height:1.5}',
    '.dsh-trending-num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.dsh-trending-aside{border:1px solid var(--dsw-alias-border,rgba(60,60,67,.16));border-radius:12px;padding:14px}',
    '.dsh-trending-aside h3{margin:0 0 8px;font-size:13px}',
    '.dsh-trending-aside h4{margin:12px 0 6px;font-size:12px;color:var(--dsw-alias-label-secondary,#6e6e73)}',
    '.dsh-trending-aside p,.dsh-trending-aside li{line-height:1.6;font-size:12.5px}',
    '.dsh-trending-msg{font-size:12px;color:var(--dsw-alias-label-secondary,#6e6e73)}',
    '.dsh-trending-settings{display:flex;flex-direction:column;gap:10px;border:1px solid var(--dsw-alias-border,rgba(60,60,67,.16));border-radius:12px;padding:14px}',
    '.dsh-trending-settings input{width:100%;box-sizing:border-box;border-radius:8px;min-height:34px;border:1px solid var(--dsw-alias-border,rgba(60,60,67,.2));background:transparent;color:inherit;padding:0 10px}',
    '.dsh-trending-modes{display:flex;gap:10px;flex-wrap:wrap}',
    '.dsh-trending-mode{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border:1px solid var(--dsw-alias-border,rgba(60,60,67,.16));border-radius:10px;cursor:pointer;flex:1 1 200px}',
    '.dsh-trending-mode.active{border-color:var(--dsw-alias-link,#0a84ff)}',
    '.dsh-trending-mode small{color:var(--dsw-alias-label-secondary,#6e6e73)}',
  ].join('\n');

  function injectStyles() {
    if (typeof document === 'undefined') return;
    var id = 'dsh-github-trending-styles';
    var existing = document.getElementById(id);
    if (existing) existing.remove();
    var el = document.createElement('style');
    el.id = id;
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  var inject = ['slots'];
  var hostRequire = null;

  function apply(ctx) {
    if (typeof window === 'undefined' || !window.document) return;
    var React = hostRequire ? hostRequire('react') : (typeof window !== 'undefined' ? window.React : null);
    if (!React) throw new Error('dsh-github-trending: React 未注入');

    function h(type, props) {
      return React.createElement.apply(React, [type, props].concat(Array.prototype.slice.call(arguments, 2)));
    }

    function count(n) {
      return typeof n === 'number' ? n.toLocaleString('en-US') : '—';
    }

    function Panel() {
      var [period, setPeriod] = React.useState('daily');
      var [boards, setBoards] = React.useState({});
      var [busy, setBusy] = React.useState(false);
      var [error, setError] = React.useState('');
      var [configured, setConfigured] = React.useState(null);
      var [zh, setZh] = React.useState(true);
      var [settingsOpen, setSettingsOpen] = React.useState(false);
      var [key, setKey] = React.useState('');
      var [mode, setMode] = React.useState('scrape');
      var [message, setMessage] = React.useState('');

      var load = React.useCallback(async function (target, refresh) {
        setBusy(true);
        setError('');
        try {
          var res = await fetch(API + '/trending', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ period: target, refresh: Boolean(refresh) }),
          });
          var json = await res.json();
          if (!res.ok || !json.ok) throw new Error(json.error || '加载失败');
          setBoards(function (old) {
            var next = Object.assign({}, old);
            next[target] = json.data;
            return next;
          });
        } catch (e) {
          setError(e && e.message ? e.message : '加载失败');
        } finally {
          setBusy(false);
        }
      }, []);

      React.useEffect(function () {
        var controller = new AbortController();
        fetch(API + '/settings', { signal: controller.signal })
          .then(function (res) { return res.json(); })
          .then(function (json) {
            if (controller.signal.aborted || !json.ok) return;
            setConfigured(json.data.hasKey);
            if (json.data.trendingSource) setMode(json.data.trendingSource);
            if (json.data.hasKey) load(period);
          })
          .catch(function () { /* 首屏配置读取失败时保持提示 */ });
        return function () { controller.abort(); };
      }, []);

      var saveSettings = async function (payload) {
        setMessage('');
        try {
          var res = await fetch(API + '/settings', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          var json = await res.json();
          if (!res.ok || !json.ok) throw new Error(json.error || '保存失败');
          setConfigured(json.data.hasKey);
          if (json.data.trendingSource) setMode(json.data.trendingSource);
          setMessage('已保存');
          if (json.data.hasKey) load(period, true);
        } catch (e) {
          setMessage(e && e.message ? e.message : '保存失败');
        }
      };

      var board = boards[period];
      var insight = board && board.insight;

      return h('div', { className: 'dsh-trending-panel' },
        h('div', { className: 'dsh-trending-head' },
          h('h2', null, 'GitHub 热点'),
          h('div', { className: 'dsh-trending-tabs' },
            PERIODS.map(function (pair) {
              return h('button', {
                key: pair[0], className: 'dsh-trending-tab' + (period === pair[0] ? ' active' : ''),
                onClick: function () { setPeriod(pair[0]); if (!boards[pair[0]] || pair[0] !== period) load(pair[0]); },
              }, pair[1]);
            })),
          h('div', { style: { display: 'flex', gap: '8px' } },
            h('button', { className: 'dsh-trending-btn', onClick: function () { setZh(!zh); } }, zh ? '英文' : '中文'),
            h('button', { className: 'dsh-trending-btn', disabled: busy || !configured, onClick: function () { load(period, true); } }, busy ? '抓取中…' : '刷新'),
            h('button', { className: 'dsh-trending-btn', onClick: function () { setSettingsOpen(!settingsOpen); } }, '设置'))),

        settingsOpen ? h('div', { className: 'dsh-trending-settings' },
          h('label', null, 'Firecrawl API Key'),
          h('input', {
            type: 'password', value: key, placeholder: configured ? '已保存，留空则保留' : 'fc-…',
            onChange: function (event) { setKey(event.target.value); },
          }),
          h('div', { className: 'dsh-trending-modes' },
            [['scrape', 'Scrape', '一次抽取同时得到榜单、中文译文与总结，约 5 credits。'],
             ['agent', 'Agent', '一次 Agent 任务，条数更多、洞察更丰富，约 24–39 credits。']].map(function (option) {
              return h('label', { key: option[0], className: 'dsh-trending-mode' + (mode === option[0] ? ' active' : '') },
                h('input', { type: 'radio', name: 'dsh-trending-mode', value: option[0], checked: mode === option[0],
                  onChange: function () { saveSettings({ source: option[0] }); } }),
                h('strong', null, option[1]),
                h('small', null, option[2]));
            })),
          h('div', { style: { display: 'flex', gap: '8px' } },
            h('button', { className: 'dsh-trending-btn', disabled: !key.trim(), onClick: function () { saveSettings({ apiKey: key }); setKey(''); } }, '保存 Key'),
            h('button', { className: 'dsh-trending-btn', onClick: function () { saveSettings({ clear: true }); } }, '清除 Key')),
          message ? h('p', { className: 'dsh-trending-msg' }, message) : null) : null,

        !configured && configured !== null ? h('p', { className: 'dsh-trending-msg' }, '尚未配置 Firecrawl API Key') : null,
        error ? h('p', { className: 'dsh-trending-msg', role: 'alert' }, error) : null,
        busy && !board ? h('p', { className: 'dsh-trending-msg' }, '正在抓取…') : null,

        board ? h('div', { className: 'dsh-trending-body' },
          h('table', { className: 'dsh-trending-table' },
            h('thead', null, h('tr', null,
              h('th', null, '项目'), h('th', null, '简介'), h('th', null, '语言'),
              h('th', { className: 'dsh-trending-num' }, 'Star'), h('th', { className: 'dsh-trending-num' }, '周期新增'))),
            h('tbody', null, board.items.map(function (row) {
              var translated = insight && insight.descriptionsZh && insight.descriptionsZh[row.name];
              var text = zh && translated ? translated : row.description;
              return h('tr', { key: row.name },
                h('td', null, h('a', { className: 'dsh-trending-name', href: row.url, target: '_blank', rel: 'noopener noreferrer' }, row.name)),
                h('td', { className: 'dsh-trending-desc' }, text || '—'),
                h('td', null, row.language || '—'),
                h('td', { className: 'dsh-trending-num' }, count(row.stars)),
                h('td', { className: 'dsh-trending-num' }, row.starsToday === null ? '—' : '+' + count(row.starsToday)));
            }))),
          h('aside', { className: 'dsh-trending-aside' },
            h('h3', null, 'AI 趋势洞察'),
            insight
              ? h('div', null,
                  h('h4', null, '趋势总结'), h('p', null, insight.summary),
                  insight.observations && insight.observations.length
                    ? h('div', null, h('h4', null, '观察与发现'),
                        h('ol', null, insight.observations.map(function (item, index) { return h('li', { key: index }, item); })))
                    : null)
              : h('p', { className: 'dsh-trending-msg' }, '本次抓取没有返回总结'))) : null);
    }

    function SidebarIcon() {
      return h('span', { 'aria-hidden': 'true' }, '🔥');
    }

    if (ctx.effect) ctx.effect(function () { injectStyles(); return function () {}; }, 'github-trending: styles');
    else injectStyles();

    if (ctx.slots && typeof ctx.slots.inject === 'function') {
      ctx.slots.inject('sidebar.panellist', function () {
        return ctx.slots.register({ name: 'sidebar.panellist', id: 'trending', order: 21, label: 'Trending' }, SidebarIcon);
      });
      ctx.slots.inject('main', function () {
        return ctx.slots.register({ name: 'main', key: 'trending' }, Panel);
      });
    }
  }

  window.__ModuleLoader__.load({
    id: 'dsh-github-trending',
    factory: function (require) {
      hostRequire = require;
      var module = { exports: {} };
      var exports = module.exports;
      exports.apply = apply;
      exports.inject = inject;
      exports.name = 'dsh-github-trending';
      return module.exports;
    },
  });
}());
