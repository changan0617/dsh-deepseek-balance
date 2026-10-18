// dsh-deepseek-balance — Client bundle (web).
// Transparent floating balance bar on shell.overlay.
// Position: default bottom-left above settings button, draggable both axes.
// Width: mirrors the conversation column width when measurable.
// Reads data from the host route /api/dsh-deepseek-balance
// (GET query; POST { key } sets a manual key, '' clears it).
window.__ModuleLoader__.load({
  id: 'dsh-deepseek-balance',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    let react = require('react');

    // Stable drag state at bundle scope: survives re-renders so dragging is continuous.
    const dragState = { active: false, moved: false, startX: 0, startY: 0, offX: 0, offY: 0 };

    const CSS = `
.dsb-root { pointer-events: auto; position: fixed; bottom: 60px; left: 16px; z-index: 1000; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
.dsb-card { background: transparent; border: none; box-shadow: none; }
.dsb-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 10px; font-size: 16px; cursor: grab; user-select: none; touch-action: none; border-radius: 8px; }
.dsb-head:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent); }
.dsb-head:active { cursor: grabbing; }
.dsb-cluster { display: flex; align-items: center; gap: 8px; white-space: nowrap; flex: none; padding: 0 2px; }
.dsb-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--dsw-alias-state-warn-primary); flex: none; }
.dsb-dot.ok { background: var(--dsw-alias-state-success-primary); }
.dsb-dot.err { background: var(--dsw-alias-state-error-primary); }
.dsb-title { color: var(--dsw-alias-label-secondary); font-weight: 500; white-space: nowrap; }
.dsb-amount { color: var(--dsw-alias-label-primary); font-weight: 600; font-size: 17px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.dsb-actions { display: flex; align-items: center; gap: 2px; pointer-events: auto; flex: none; opacity: 0; transition: opacity 0.15s; }
.dsb-head:hover .dsb-actions { opacity: 1; }
.dsb-btn { border: none; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; font-size: 13px; line-height: 1; padding: 3px 6px; border-radius: 6px; white-space: nowrap; }
.dsb-btn:hover { color: var(--dsw-alias-label-primary); background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent); }
.dsb-body { padding: 4px 12px 10px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; pointer-events: auto; }
.dsb-row { display: flex; justify-content: space-between; font-size: 13px; padding: 1px 0; }
.dsb-row .v { font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-primary); }
.dsb-total { font-size: 15px; font-weight: 700; color: var(--dsw-alias-label-primary); }
.dsb-label { font-size: 11px; color: var(--dsw-alias-label-secondary); margin-bottom: 2px; }
.dsb-input { width: 100%; box-sizing: border-box; background: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 70%, transparent); color: var(--dsw-alias-label-primary); border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; padding: 6px 8px; font-size: 13px; outline: none; }
.dsb-input:focus { border-color: var(--dsw-alias-brand-primary); }
.dsb-keyrow { display: flex; gap: 6px; align-items: center; }
.dsb-status { font-size: 11px; color: var(--dsw-alias-label-secondary); display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.dsb-status.err { color: var(--dsw-alias-state-error-primary); }
.dsb-warn { font-size: 12px; color: var(--dsw-alias-state-warn-primary); }
.dsb-hint { font-size: 11px; color: var(--dsw-alias-label-secondary); line-height: 1.5; }
.dsb-link { background: none; border: none; padding: 0; font-size: 11px; color: var(--dsw-alias-label-secondary); cursor: pointer; text-decoration: underline; }
.dsb-link:hover { color: var(--dsw-alias-label-primary); }
`;

    function currencySymbol(currency) {
      const map = { CNY: '\u00a5', USD: '$', EUR: '\u20ac', GBP: '\u00a3' };
      return map[currency] !== undefined ? map[currency] : currency + ' ';
    }

    function formatTime(ts) {
      if (!ts) return '';
      const d = new Date(ts);
      const pad = (n) => (n < 10 ? '0' + n : String(n));
      return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    }

    function keySourceText(source) {
      if (source === 'manual') return '\u624b\u52a8\u952e';
      if (source === 'credential') return '\u51ed\u636e DEEPSEEK_API_KEY';
      if (source === 'env') return '\u73af\u5883\u53d8\u91cf';
      return '\u672a\u914d\u7f6e';
    }

    function BalanceCard() {
      const [expanded, setExpanded] = react.useState(false);
      const [data, setData] = react.useState(null);
      const [status, setStatus] = react.useState('loading');
      const [message, setMessage] = react.useState('');
      const [keySource, setKeySource] = react.useState('none');
      const [keyInput, setKeyInput] = react.useState('');
      const [colWidth, setColWidth] = react.useState(null);
      const [pos, setPos] = react.useState(null);

      function applyPayload(payload) {
        if (payload === null || payload === undefined || typeof payload !== 'object') {
          setStatus('error');
          setMessage('\u54cd\u5e94\u65e0\u6548');
          return;
        }
        const b = payload.balance;
        if (b !== null && b !== undefined && typeof b === 'object') {
          if (typeof b.keySource === 'string') setKeySource(b.keySource);
          if (b.ok === true) {
            setData({
              available: b.available === true,
              infos: Array.isArray(b.infos) ? b.infos : [],
              fetchedAt: b.fetchedAt || Date.now(),
            });
            setStatus('ok');
            setMessage('');
          } else if (b.code === 'no-key') {
            setStatus('no-key');
            setMessage((b && b.message) || '\u672a\u914d\u7f6e API Key');
          } else {
            setStatus('error');
            setMessage((b && b.message) || (payload.error) || '\u67e5\u8be2\u5931\u8d25');
          }
        }
      }

      async function refresh() {
        setStatus('loading');
        try {
          const res = await fetch('/api/dsh-deepseek-balance', { cache: 'no-store' });
          let payload = null;
          try { payload = await res.json(); } catch (err) { payload = null; }
          applyPayload(payload);
        } catch (err) {
          setStatus('error');
          setMessage(String((err && err.message) || err));
        }
      }

      async function saveKey() {
        const k = keyInput.trim();
        if (k.length === 0) return;
        try {
          await fetch('/api/dsh-deepseek-balance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: k }),
          });
        } catch (err) { /* handled by refresh */ }
        setKeyInput('');
        await refresh();
      }

      async function clearManualKey() {
        try {
          await fetch('/api/dsh-deepseek-balance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: '' }),
          });
        } catch (err) { /* handled by refresh */ }
        setKeyInput('');
        await refresh();
      }

      // Track only the conversation column WIDTH; position stays free-floating.
      react.useEffect(() => {
        function measure() {
          const col = document.querySelector('[data-slot="conversation"]');
          if (col === null) { setColWidth(null); return; }
          const w = col.getBoundingClientRect().width;
          if (w > 0) setColWidth(w);
        }
        measure();
        let ro = null;
        if (typeof ResizeObserver === 'function') {
          ro = new ResizeObserver(() => { measure(); });
          const col = document.querySelector('[data-slot="conversation"]');
          if (col !== null) ro.observe(col);
        }
        window.addEventListener('resize', measure);
        return () => {
          if (ro !== null) ro.disconnect();
          window.removeEventListener('resize', measure);
        };
      }, []);

      react.useEffect(() => {
        refresh();
        const timer = window.setInterval(() => { refresh(); }, 60000);
        return () => { window.clearInterval(timer); };
      }, []);

      function onPointerDown(e) {
        if (e.button !== 0) return;
        const t = e.target;
        if (t !== null && typeof t.closest === 'function' && t.closest('button')) return;
        dragState.active = true;
        dragState.moved = false;
        dragState.startX = e.clientX;
        dragState.startY = e.clientY;
        const cardEl = e.currentTarget.parentElement;
        const rect = cardEl.getBoundingClientRect();
        dragState.offX = e.clientX - rect.left;
        dragState.offY = e.clientY - rect.top;
        e.currentTarget.setPointerCapture(e.pointerId);
      }

      function onPointerMove(e) {
        if (!dragState.active) return;
        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.moved = true;
        if (dragState.moved) setPos({ x: e.clientX - dragState.offX, y: e.clientY - dragState.offY });
      }

      function onPointerUp(e) {
        if (!dragState.active) return;
        dragState.active = false;
        if (!dragState.moved) setExpanded((v) => !v);
      }

      const infos = (data !== null && Array.isArray(data.infos)) ? data.infos : [];
      const dotClass = (status === 'error' || (status === 'ok' && data !== null && data.available !== true)) ? 'dsb-dot err' : (status === 'ok' ? 'dsb-dot ok' : 'dsb-dot');
      const headAmount = (status === 'ok' && infos.length > 0) ? (currencySymbol(infos[0].currency) + infos[0].total) : '\u2014';

      const head = react.createElement('div', {
        className: 'dsb-head',
        title: '\u62d6\u52a8\u79fb\u52a8\u4f4d\u7f6e\uff1b\u70b9\u51fb\u5c55\u5f00/\u6536\u8d77',
        onPointerDown: onPointerDown,
        onPointerMove: onPointerMove,
        onPointerUp: onPointerUp,
        onPointerCancel: onPointerUp,
      },
        react.createElement('div', { className: 'dsb-cluster' },
          react.createElement('span', { className: dotClass }),
          react.createElement('span', { className: 'dsb-title' }, 'DeepSeek'),
          react.createElement('span', { className: 'dsb-amount' }, headAmount),
        ),
        react.createElement('div', { className: 'dsb-actions' },
          react.createElement('button', { className: 'dsb-btn', title: '\u7acb\u5373\u5237\u65b0', onClick: () => refresh() }, '\u21bb'),
          react.createElement('button', { className: 'dsb-btn', title: expanded ? '\u6536\u8d77' : '\u5c55\u5f00', onClick: () => setExpanded((v) => !v) }, expanded ? '\u2013' : '+'),
        ),
      );

      let body = null;
      if (expanded) {
        if (status === 'no-key') {
          body = react.createElement('div', { className: 'dsb-body' },
            react.createElement('div', { className: 'dsb-warn' }, '\u672a\u914d\u7f6e API Key'),
            react.createElement('input', {
              className: 'dsb-input',
              type: 'password',
              placeholder: 'sk-...',
              value: keyInput,
              onChange: (e) => setKeyInput(e.target.value),
              onKeyDown: (e) => { if (e.key === 'Enter') saveKey(); },
            }),
            react.createElement('div', { className: 'dsb-keyrow' },
              react.createElement('button', { className: 'dsb-btn', onClick: () => saveKey(), style: { border: '1px solid var(--dsw-alias-border-l2)', borderRadius: '6px', padding: '4px 10px' } }, '\u4fdd\u5b58\u5e76\u67e5\u8be2'),
            ),
            react.createElement('div', { className: 'dsb-status err' },
              react.createElement('span', null, message),
              react.createElement('button', { className: 'dsb-btn', onClick: () => refresh() }, '\u91cd\u8bd5'),
            ),
          );
        } else {
          const rows = [];
          infos.forEach((info, i) => {
            rows.push(react.createElement('div', { key: 'c' + i, className: 'dsb-label' }, info.currency ? '\u5e01\u79cd\uff1a' + info.currency : '\u4f59\u989d'));
            rows.push(react.createElement('div', { key: 't' + i, className: 'dsb-row' },
              react.createElement('span', null, '\u603b\u4f59\u989d'),
              react.createElement('span', { className: 'v dsb-total' }, currencySymbol(info.currency) + info.total),
            ));
            if (info.granted !== '') {
              rows.push(react.createElement('div', { key: 'g' + i, className: 'dsb-row' },
                react.createElement('span', null, '\u8d60\u9001\u4f59\u989d'),
                react.createElement('span', { className: 'v' }, currencySymbol(info.currency) + info.granted),
              ));
            }
            if (info.topped !== '') {
              rows.push(react.createElement('div', { key: 'p' + i, className: 'dsb-row' },
                react.createElement('span', null, '\u5145\u503c\u4f59\u989d'),
                react.createElement('span', { className: 'v' }, currencySymbol(info.currency) + info.topped),
              ));
            }
          });
          rows.push(react.createElement('div', { key: 'key', className: 'dsb-label' }, '\u624b\u52a8 Key\uff08\u53ef\u9009\uff0c\u4f18\u5148\u4e8e\u81ea\u52a8\uff09'));
          rows.push(react.createElement('div', { key: 'krow', className: 'dsb-keyrow' },
            react.createElement('input', {
              className: 'dsb-input',
              type: 'password',
              placeholder: 'sk-...',
              value: keyInput,
              onChange: (e) => setKeyInput(e.target.value),
              onKeyDown: (e) => { if (e.key === 'Enter') saveKey(); },
            }),
          ));
          rows.push(react.createElement('div', { key: 'kbtns', className: 'dsb-keyrow' },
            react.createElement('button', { className: 'dsb-btn', onClick: () => saveKey(), style: { border: '1px solid var(--dsw-alias-border-l2)', borderRadius: '6px', padding: '4px 10px' } }, '\u4fdd\u5b58\u5e76\u67e5\u8be2'),
            keySource === 'manual' ? react.createElement('button', { className: 'dsb-link', onClick: () => clearManualKey() }, '\u6e05\u9664\u624b\u52a8 Key') : null,
          ));
          const statusText = status === 'loading' ? '\u67e5\u8be2\u4e2d\u2026' : (status === 'error' ? message : (message ? message : '\u66f4\u65b0\u4e8e ' + formatTime(data && data.fetchedAt)));
          rows.push(react.createElement('div', { key: 'status', className: 'dsb-status' + (status === 'error' ? ' err' : '') },
            react.createElement('span', null, statusText + ' \u00b7 Key: ' + keySourceText(keySource)),
          ));
          body = react.createElement('div', { className: 'dsb-body' },
            rows,
            (data !== null && data.available !== true && status === 'ok') ? react.createElement('div', { className: 'dsb-warn' }, '\u5e10\u6237\u4e0d\u53ef\u7528') : null,
          );
        }
      }

      const style = {};
      if (pos !== null) {
        style.left = pos.x + 'px';
        style.top = pos.y + 'px';
        style.bottom = 'auto';
      }
      if (colWidth !== null && colWidth > 0) style.width = colWidth + 'px';
      return react.createElement('div', { className: 'dsb-root', style: style },
        react.createElement('div', { className: 'dsb-card' }, head, body),
      );
    }

    exports.apply = function (ctx) {
      const slots = ctx.get('slots');
      if (slots === undefined) return;
      const styleEl = document.createElement('style');
      styleEl.textContent = CSS;
      document.head.append(styleEl);
      ctx.effect(() => () => { styleEl.remove(); });
      ctx.effect(() => slots.inject('shell.overlay', () => slots.register(
        { name: 'shell.overlay', id: 'deepseek-balance-overlay', order: 900, label: 'DeepSeek \u4f59\u989d' },
        () => react.createElement(BalanceCard),
      )));
    };

    return module.exports;
  }
});
