/**
 * 浏览器半边：注册一个 main 槽页面 + 侧边栏入口，渲染热点看板。
 * 零构建：本文件是手写 CommonJS 风格模块，宿主通过 __ModuleLoader__ 注入 React。
 */
(function () {
  var API = '/api/github-trending';
  var PERIODS = [['daily', '每日'], ['weekly', '每周'], ['monthly', '每月']];

  var CSS = [
    ".dsh-trending-panel{--trend-accent:var(--dsw-alias-link,#007aff);--trend-surface:var(--dsw-alias-bg-layer-1,#fff);--trend-elevated:var(--dsw-alias-bg-layer-2,#f5f5f7);--trend-text:var(--dsw-alias-label-primary,#1d1d1f);--trend-muted:var(--dsw-alias-label-secondary,#74747a);--trend-border:var(--dsw-alias-border,rgba(60,60,67,.10));box-sizing:border-box;display:flex;flex-direction:column;gap:20px;width:100%;max-width:100%;height:100%;max-height:100%;min-width:0;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch;scrollbar-gutter:stable;padding:clamp(16px,2.3vw,32px);font:13px/1.55 -apple-system,BlinkMacSystemFont,\"SF Pro Text\",\"Segoe UI\",sans-serif;color:var(--trend-text)}",
    ".dsh-trending-panel *{box-sizing:border-box}",
    ".dsh-trending-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;flex-wrap:wrap}",
    ".dsh-trending-headline{min-width:0}",
    ".dsh-trending-kicker{display:block;margin-bottom:7px;color:var(--trend-accent);font-size:10px;font-weight:750;letter-spacing:.15em}",
    ".dsh-trending-head h2{margin:0 0 5px;font-size:clamp(23px,2.2vw,31px);font-weight:730;letter-spacing:-.035em;line-height:1.2}",
    ".dsh-trending-subtitle{margin:0;color:var(--trend-muted);font-size:12px}",
    ".dsh-trending-head-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;min-width:0}",
    ".dsh-trending-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--trend-border);background:var(--trend-surface);color:var(--trend-text);border-radius:11px;padding:9px 14px;min-height:36px;font:inherit;font-size:12px;font-weight:600;cursor:pointer;transition:background .18s,transform .18s}",
    ".dsh-trending-btn:hover{background:var(--trend-elevated)}",
    ".dsh-trending-btn:active{transform:scale(.98)}",
    ".dsh-trending-btn:disabled{opacity:.45;cursor:default;transform:none}",
    ".dsh-trending-btn-primary{border-color:transparent;background:var(--trend-accent);color:#fff}",
    ".dsh-trending-btn-primary:hover{background:var(--trend-accent);filter:brightness(1.08)}",
    ".dsh-trending-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0;flex-wrap:wrap}",
    ".dsh-trending-tabs,.dsh-trending-language{display:inline-flex;gap:3px;align-items:center;border-radius:13px;padding:4px;background:var(--trend-elevated)}",
    ".dsh-trending-tab,.dsh-trending-locale{border:0;background:transparent;color:var(--trend-muted);border-radius:10px;padding:8px 15px;min-height:35px;font:inherit;font-size:12px;font-weight:600;cursor:pointer;transition:background .18s,color .18s}",
    ".dsh-trending-tab.active,.dsh-trending-locale.active{background:var(--trend-surface);color:var(--trend-text);box-shadow:0 1px 6px rgba(0,0,0,.09)}",
    ".dsh-trending-toolbar-label{color:var(--trend-muted);font-size:11px;padding:0 10px 0 8px}",
    ".dsh-trending-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:var(--trend-muted);font-size:11px}",
    ".dsh-trending-meta-dot{height:5px;width:5px;border-radius:50%;background:#30b96a;flex:none}",
    ".dsh-trending-meta a{color:var(--trend-accent);text-decoration:none}",
    ".dsh-trending-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(250px,300px);gap:17px;align-items:start;width:100%;max-width:100%;min-width:0;min-height:min-content;flex-shrink:0;padding-bottom:3px}",
    ".dsh-trending-table-card,.dsh-trending-aside{background:var(--trend-surface);border:1px solid var(--trend-border);border-radius:18px;min-width:0;overflow:hidden;box-shadow:0 5px 24px rgba(0,0,0,.025)}",
    ".dsh-trending-table-scroll{width:100%;max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch}",
    ".dsh-trending-table{width:100%;min-width:680px;border-collapse:collapse;font-size:12px}",
    ".dsh-trending-table th{background:var(--trend-elevated);text-align:left;font-size:11px;font-weight:650;white-space:nowrap;color:var(--trend-muted);padding:14px 15px}",
    ".dsh-trending-table td{padding:15px;border-bottom:1px solid var(--trend-border);vertical-align:top}",
    ".dsh-trending-table tbody tr:last-child td{border-bottom:0}",
    ".dsh-trending-table tbody tr:hover{background:color-mix(in srgb,var(--trend-accent) 4%,transparent)}",
    ".dsh-trending-name{font-weight:700;text-decoration:none;color:var(--trend-accent);overflow-wrap:anywhere}",
    ".dsh-trending-name:hover{text-decoration:underline}",
    ".dsh-trending-desc{color:var(--trend-muted);line-height:1.65;min-width:240px}",
    ".dsh-trending-num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:600}",
    ".dsh-trending-gain{color:var(--trend-accent)}",
    ".dsh-trending-aside{position:sticky;top:16px;padding:21px}",
    ".dsh-trending-aside-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}",
    ".dsh-trending-spark{display:grid;place-items:center;flex:none;width:36px;height:36px;border-radius:12px;background:color-mix(in srgb,var(--trend-accent) 12%,transparent);color:var(--trend-accent);font-size:23px}",
    ".dsh-trending-aside h3{margin:0;font-size:15px;letter-spacing:-.02em}",
    ".dsh-trending-aside h4{margin:18px 0 8px;font-size:12px}",
    ".dsh-trending-aside p,.dsh-trending-aside li{line-height:1.75;font-size:12px}",
    ".dsh-trending-aside p{margin:0}",
    ".dsh-trending-aside ol{padding-left:21px;margin:0}",
    ".dsh-trending-aside li{margin-bottom:9px}",
    ".dsh-trending-aside-meta{font-size:10px;color:var(--trend-muted);letter-spacing:.04em}",
    ".dsh-trending-msg{font-size:12px;line-height:1.7;color:var(--trend-muted)}",
    ".dsh-trending-notice{padding:15px 17px;border-radius:13px;background:var(--trend-elevated);color:var(--trend-muted)}",
    ".dsh-trending-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8px;min-height:220px;background:var(--trend-surface);border:1px solid var(--trend-border);border-radius:18px}",
    ".dsh-trending-empty-icon{font-size:32px;color:var(--trend-accent)}",
    ".dsh-trending-empty strong{font-size:15px;color:var(--trend-text)}",
    ".dsh-trending-modal-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(12,15,22,.47);-webkit-backdrop-filter:blur(9px);backdrop-filter:blur(9px)}",
    ".dsh-trending-dialog{width:min(100%,560px);max-height:min(90vh,760px);overflow:auto;overscroll-behavior:contain;background:var(--trend-surface);border:1px solid var(--trend-border);border-radius:22px;box-shadow:0 25px 80px rgba(0,0,0,.23);color:var(--trend-text)}",
    ".dsh-trending-dialog-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:25px 27px 19px;border-bottom:1px solid var(--trend-border)}",
    ".dsh-trending-dialog-eyebrow{display:block;font-size:10px;color:var(--trend-accent);font-weight:700;letter-spacing:.12em;margin-bottom:7px}",
    ".dsh-trending-dialog-header h3{font-size:21px;letter-spacing:-.03em;margin:0}",
    ".dsh-trending-dialog-close{display:grid;place-items:center;border:0;background:var(--trend-elevated);color:var(--trend-muted);height:32px;width:32px;border-radius:50%;font-size:20px;cursor:pointer}",
    ".dsh-trending-dialog-body{display:flex;flex-direction:column;gap:17px;padding:22px 27px}",
    ".dsh-trending-field-label{font-size:12px;font-weight:650;display:block;margin-bottom:7px}",
    ".dsh-trending-field-hint{display:block;font-size:11px;color:var(--trend-muted);margin-top:7px;line-height:1.7}",
    ".dsh-trending-dialog input[type=password]{width:100%;min-height:42px;border:1px solid var(--trend-border);border-radius:11px;padding:10px 12px;font:inherit;color:var(--trend-text);background:var(--trend-elevated);outline:none}",
    ".dsh-trending-dialog input[type=password]:focus{border-color:var(--trend-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--trend-accent) 12%,transparent)}",
    ".dsh-trending-status{display:inline-flex;align-items:center;gap:7px;font-size:11px;color:var(--trend-muted)}",
    ".dsh-trending-status-dot{width:7px;height:7px;border-radius:50%;background:#34c759}",
    ".dsh-trending-modes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}",
    ".dsh-trending-mode{position:relative;display:flex;flex-direction:column;gap:5px;border:1px solid var(--trend-border);border-radius:13px;padding:15px;cursor:pointer;transition:border-color .18s,background .18s}",
    ".dsh-trending-mode.active{background:color-mix(in srgb,var(--trend-accent) 6%,var(--trend-surface));border-color:var(--trend-accent)}",
    ".dsh-trending-mode input[type=radio]{position:absolute;right:13px;top:14px;accent-color:var(--trend-accent)}",
    ".dsh-trending-mode strong{font-size:13px}",
    ".dsh-trending-mode small{color:var(--trend-muted);line-height:1.6;padding-right:6px}",
    ".dsh-trending-dialog-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 27px 24px;flex-wrap:wrap}",
    ".dsh-trending-dialog-actions{display:flex;gap:8px}",
    ".dsh-trending-dialog-msg{margin:0;font-size:12px;color:var(--trend-muted)}",
    ".dsh-trending-dialog [role=alert]{color:#d83c44}",
    ".dsh-trending-panel button:focus-visible{outline:2px solid var(--trend-accent);outline-offset:2px}",
    "body[data-ds-dark-theme] .dsh-trending-panel{--trend-surface:var(--dsw-alias-bg-layer-1,#242427);--trend-elevated:var(--dsw-alias-bg-layer-2,#303034);--trend-border:rgba(170,170,185,.09);--trend-text:var(--dsw-alias-label-primary,#f5f5f7);--trend-muted:var(--dsw-alias-label-secondary,#a1a1aa);--trend-accent:var(--dsw-alias-link,#5ac8fa)}",
    "body[data-ds-dark-theme] .dsh-trending-table-card,body[data-ds-dark-theme] .dsh-trending-aside{box-shadow:none}",
    "body[data-ds-dark-theme] .dsh-trending-table td{border-bottom-color:rgba(170,170,185,.075)}",
    "body[data-ds-dark-theme] .dsh-trending-tab.active,body[data-ds-dark-theme] .dsh-trending-locale.active{box-shadow:0 1px 6px rgba(0,0,0,.24)}",
    "@media(max-width:1120px){.dsh-trending-body{grid-template-columns:minmax(0,1fr)}.dsh-trending-aside{position:static}}",
    "@media(max-width:650px){.dsh-trending-panel{gap:16px;padding:13px}.dsh-trending-head-actions{width:100%;justify-content:flex-end}.dsh-trending-dialog-header,.dsh-trending-dialog-body{padding-left:18px;padding-right:18px}.dsh-trending-dialog-footer{padding:16px 18px 20px}.dsh-trending-modes{grid-template-columns:1fr}.dsh-trending-modal-overlay{padding:12px}}",
    "@media(prefers-reduced-motion:reduce){.dsh-trending-panel *{transition:none!important}}",
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
      var [settingsBusy, setSettingsBusy] = React.useState(false);
      var dialogRef = React.useRef(null);

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
        if (settingsBusy) return;
        setSettingsBusy(true);
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
          setMessage('设置已保存');
          if (json.data.hasKey) load(period, true);
        } catch (e) {
          setMessage(e && e.message ? e.message : '保存失败');
        } finally {
          setSettingsBusy(false);
        }
      };

      React.useEffect(function () {
        if (!settingsOpen) return;
        var previous = document.activeElement;
        var onKey = function (event) {
          if (event.key === 'Escape') { event.preventDefault(); setSettingsOpen(false); }
          if (event.key !== 'Tab' || !dialogRef.current) return;
          var focusable = dialogRef.current.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex]:not([tabindex="-1"])');
          if (!focusable.length) return;
          var first = focusable[0], last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', onKey);
        if (dialogRef.current) dialogRef.current.focus();
        return function () {
          document.removeEventListener('keydown', onKey);
          if (previous && typeof previous.focus === 'function') previous.focus();
        };
      }, [settingsOpen]);

      var board = boards[period];
      var insight = board && board.insight;

      var table = board ? h('div', { className: 'dsh-trending-body' },
        h('div', { className: 'dsh-trending-table-card' },
          h('div', { className: 'dsh-trending-table-scroll' },
            h('table', { className: 'dsh-trending-table' },
              h('thead', null, h('tr', null,
                h('th', null, '项目'), h('th', null, '项目简介'), h('th', null, '语言'),
                h('th', { className: 'dsh-trending-num' }, '总 Star'),
                h('th', { className: 'dsh-trending-num' }, '周期新增'))),
              h('tbody', null, board.items.map(function (row) {
                var translated = insight && insight.descriptionsZh && insight.descriptionsZh[row.name];
                var description = zh && translated ? translated : row.description;
                return h('tr', { key: row.name },
                  h('td', null, h('a', { className: 'dsh-trending-name', href: row.url, target: '_blank', rel: 'noopener noreferrer' }, row.name)),
                  h('td', { className: 'dsh-trending-desc', lang: zh && translated ? 'zh-CN' : undefined }, description || '—'),
                  h('td', null, row.language || '—'),
                  h('td', { className: 'dsh-trending-num' }, count(row.stars)),
                  h('td', { className: 'dsh-trending-num dsh-trending-gain' }, row.starsToday === null ? '—' : '+' + count(row.starsToday)));
              }))))),
        h('aside', { className: 'dsh-trending-aside', 'aria-label': 'AI 趋势洞察' },
          h('div', { className: 'dsh-trending-aside-head' },
            h('span', { className: 'dsh-trending-spark', 'aria-hidden': true }, '✦'),
            h('div', null,
              h('h3', null, 'AI 趋势洞察'),
              h('div', { className: 'dsh-trending-aside-meta' }, 'FIRECRAWL · ' + ({ daily: '每日', weekly: '每周', monthly: '每月' }[period])))),
          insight ? h('div', null,
            h('h4', null, '趋势总结'),
            h('p', null, insight.summary),
            insight.observations && insight.observations.length ?
              h('div', null, h('h4', null, '观察与发现'),
                h('ol', null, insight.observations.map(function (item, index) {
                  return h('li', { key: index }, item);
                }))) : null) :
            h('p', { className: 'dsh-trending-msg' }, '本次抓取暂无趋势总结。'))) : null;

      var settingsDialog = settingsOpen ? h('div', {
        className: 'dsh-trending-modal-overlay',
        onMouseDown: function (event) {
          if (event.target === event.currentTarget) setSettingsOpen(false);
        },
      },
        h('section', {
          className: 'dsh-trending-dialog', role: 'dialog', 'aria-modal': true,
          'aria-labelledby': 'dsh-trending-settings-title', tabIndex: -1, ref: dialogRef,
          onMouseDown: function (event) { event.stopPropagation(); },
        },
          h('div', { className: 'dsh-trending-dialog-header' },
            h('div', null,
              h('span', { className: 'dsh-trending-dialog-eyebrow' }, 'PREFERENCES'),
              h('h3', { id: 'dsh-trending-settings-title' }, '热点看板设置')),
            h('button', { type: 'button', className: 'dsh-trending-dialog-close', 'aria-label': '关闭设置',
              onClick: function () { setSettingsOpen(false); } }, '×')),
          h('div', { className: 'dsh-trending-dialog-body' },
            h('div', { className: 'dsh-trending-status' },
              h('span', { className: 'dsh-trending-status-dot', style: configured ? null : { background: '#ff9f0a' } }),
              configured ? 'Firecrawl API Key 已配置' : 'Firecrawl API Key 尚未配置'),
            h('div', null,
              h('label', { className: 'dsh-trending-field-label', htmlFor: 'dsh-trending-key' }, 'Firecrawl API Key'),
              h('input', { id: 'dsh-trending-key', type: 'password', value: key,
                autoComplete: 'off', spellCheck: false, placeholder: configured ? '已保存 · 留空则保留当前 Key' : 'fc-…',
                onChange: function (event) { setKey(event.target.value); } }),
              h('span', { className: 'dsh-trending-field-hint' }, '密钥仅保存在 DSH 服务端，不会显示在浏览器中。')),
            h('div', null,
              h('span', { className: 'dsh-trending-field-label' }, '抓取模式'),
              h('div', { className: 'dsh-trending-modes', role: 'radiogroup', 'aria-label': 'Firecrawl 抓取模式' },
                [['scrape', 'Scrape · 推荐', '一次提取榜单、中英简介与趋势总结，额度消耗较低。'],
                 ['agent', 'Agent · 深度分析', '使用 Firecrawl Agent 执行完整抓取与分析，额度消耗较高。']].map(function (option) {
                  return h('label', { key: option[0], className: 'dsh-trending-mode' + (mode === option[0] ? ' active' : '') },
                    h('input', { type: 'radio', name: 'dsh-trending-mode', value: option[0],
                      checked: mode === option[0], disabled: settingsBusy,
                      onChange: function () { saveSettings({ source: option[0] }); } }),
                    h('strong', null, option[1]), h('small', null, option[2]));
                }))),
            message ? h('p', { className: 'dsh-trending-dialog-msg', role: 'status' }, message) : null),
          h('div', { className: 'dsh-trending-dialog-footer' },
            h('button', { type: 'button', className: 'dsh-trending-btn', disabled: settingsBusy,
              onClick: function () { saveSettings({ clear: true }); } }, '清除 Key'),
            h('div', { className: 'dsh-trending-dialog-actions' },
              h('button', { type: 'button', className: 'dsh-trending-btn',
                onClick: function () { setSettingsOpen(false); } }, '关闭'),
              h('button', { type: 'button', className: 'dsh-trending-btn dsh-trending-btn-primary',
                disabled: settingsBusy || !key.trim(),
                onClick: function () { var value = key; if (value.trim()) { saveSettings({ apiKey: value }); setKey(''); } } },
                settingsBusy ? '保存中…' : '保存 Key'))))) : null;

      return h('div', { className: 'dsh-trending-panel' },
        h('header', { className: 'dsh-trending-head' },
          h('div', { className: 'dsh-trending-headline' },
            h('span', { className: 'dsh-trending-kicker' }, 'DISCOVER / OPEN SOURCE'),
            h('h2', null, 'GitHub 热点'),
            h('p', { className: 'dsh-trending-subtitle' }, '发现开源趋势，追踪值得关注的项目')),
          h('div', { className: 'dsh-trending-head-actions' },
            h('button', { className: 'dsh-trending-btn', type: 'button',
              disabled: busy || !configured, onClick: function () { load(period, true); } }, busy ? '刷新中…' : '↻ 刷新榜单'),
            h('button', { className: 'dsh-trending-btn', type: 'button', 'aria-label': '打开热点看板设置',
              onClick: function () { setMessage(''); setSettingsOpen(true); } }, '⚙ 设置'))),
        h('div', { className: 'dsh-trending-toolbar' },
          h('div', { className: 'dsh-trending-tabs', role: 'tablist', 'aria-label': '榜单周期' },
            PERIODS.map(function (pair) {
              return h('button', { key: pair[0], type: 'button', role: 'tab', 'aria-selected': period === pair[0],
                className: 'dsh-trending-tab' + (period === pair[0] ? ' active' : ''),
                onClick: function () { setPeriod(pair[0]); if (!boards[pair[0]]) load(pair[0]); } }, pair[1]);
            })),
          h('div', { className: 'dsh-trending-language', role: 'group', 'aria-label': '项目简介语言' },
            h('span', { className: 'dsh-trending-toolbar-label' }, '项目简介'),
            h('button', { className: 'dsh-trending-locale' + (zh ? ' active' : ''), type: 'button',
              'aria-pressed': zh, onClick: function () { setZh(true); } }, '中文'),
            h('button', { className: 'dsh-trending-locale' + (!zh ? ' active' : ''), type: 'button',
              'aria-pressed': !zh, onClick: function () { setZh(false); } }, 'English'))),
        board ? h('div', { className: 'dsh-trending-meta' },
          h('span', { className: 'dsh-trending-meta-dot', 'aria-hidden': true }),
          h('span', null, String(board.items.length) + ' 个项目'),
          h('span', null, '· ' + new Date(board.fetchedAt).toLocaleString('zh-CN') + (board.stale ? ' · 缓存数据' : '')),
          h('a', { href: board.sourceUrl, target: '_blank', rel: 'noopener noreferrer' }, 'GitHub 原榜 ↗')) : null,
        configured === false ? h('div', { className: 'dsh-trending-notice' },
          h('strong', null, '需要配置 Firecrawl'),
          h('p', null, '点击右上角「设置」添加 API Key，即可开始加载热点榜单。')) : null,
        error ? h('div', { className: 'dsh-trending-notice', role: 'alert' }, error) : null,
        busy && !board ? h('div', { className: 'dsh-trending-empty', role: 'status' },
          h('span', { className: 'dsh-trending-empty-icon' }, '◌'), h('strong', null, '正在获取热点榜单…'),
          h('span', { className: 'dsh-trending-msg' }, '正在通过 Firecrawl 提取 GitHub Trending 项目')) : null,
        !board && !busy && configured ? h('div', { className: 'dsh-trending-empty' },
          h('span', { className: 'dsh-trending-empty-icon' }, '✦'), h('strong', null, '暂无榜单数据'),
          h('span', { className: 'dsh-trending-msg' }, '点击刷新榜单重新获取')) : null,
        table,
        settingsDialog);
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
