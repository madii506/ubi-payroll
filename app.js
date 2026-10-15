/* bukz — app. Reads window.BUKZ (config.js) and ledger.json. No fake numbers: without a CA the shop is "pre-launch". */
(function () {
  'use strict';
  const C = window.UBI || {};
  const CARD_USD = +C.CARD_USD || 99.99, CARD_GTA = +C.CARD_GTA || 8e6;
  const XHANDLE = (String(C.X || '').match(/x\.com\/([A-Za-z0-9_]+)/) || [])[1] || '';
  const GPU = C.GTA_PER_USD || 80000;
  const CA = String(C.CA || '').trim();
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = n => Math.round(n).toLocaleString('en-US');

  const fmt = {
    usd(n) { if (n == null || isNaN(n)) return '—'; const a = Math.abs(n); if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'; if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'; if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K'; return '$' + n.toFixed(2); },
    usdFull(n) { return '$' + nf(n); },
    gta(n) { return 'GTA$ ' + nf(n); },
    gtaShort(n) { const a = Math.abs(n); if (a >= 1e6) return 'GTA$ ' + String(+(n / 1e6).toFixed(2)) + 'M'; if (a >= 1e3) return 'GTA$ ' + String(+(n / 1e3).toFixed(0)) + 'K'; return 'GTA$ ' + nf(n); },
    px(n) { if (n == null || isNaN(n)) return '—'; if (n >= 1) return '$' + n.toFixed(4); if (n >= 0.001) return '$' + n.toFixed(6); return '$' + n.toPrecision(3); },
    pct(n) { if (n == null || isNaN(n)) return '—'; return (n > 0 ? '+' : '') + n.toFixed(1) + '%'; },
    sol(n) { return String(+(+n || 0).toFixed(3)) + ' SOL'; },
    date(s) { return s ? String(s).slice(0, 10) : '—'; }
  };

  /* ---------- toasts */
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3100);
  }

  /* ---------- tabs */
  const tabs = $('#tabs'), ind = $('.ind', tabs), tabBtns = $$('button[data-tab]', tabs);
  function moveInd() { const b = $('button.on', tabs); if (!b) return; ind.style.left = b.offsetLeft + 'px'; ind.style.width = b.offsetWidth + 'px'; }
  function go(name, scroll) {
    if (!$('#tab-' + name)) name = 'home';
    tabBtns.forEach(b => b.classList.toggle('on', b.dataset.tab === name));
    $$('.panel').forEach(p => p.classList.toggle('on', p.id === 'tab-' + name));
    moveInd();
    if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
    if (scroll !== false) window.scrollTo({ top: 0, behavior: 'smooth' });
    if (tabs.scrollWidth > tabs.clientWidth + 2) { const b = $('button.on', tabs); b && b.scrollIntoView({ block: 'nearest', inline: 'center' }); }
  }
  tabs.addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) go(b.dataset.tab); });
  document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) { e.preventDefault(); go(b.dataset.go); } });
  window.addEventListener('hashchange', () => go(location.hash.slice(1) || 'home'));
  window.addEventListener('resize', moveInd);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveInd);
  setTimeout(moveInd, 400);
  document.addEventListener('keydown', e => {
    if (e.target.matches('input,textarea,select') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') { closeDrawer(); return; }
    const i = +e.key; if (i >= 1 && i <= tabBtns.length) go(tabBtns[i - 1].dataset.tab);
  });

  /* ---------- links + CA */
  const buyUrl = CA ? 'https://pump.fun/coin/' + CA : 'https://pump.fun/';
  const chartUrl = CA ? 'https://dexscreener.com/solana/' + CA : 'https://dexscreener.com/solana';
  $('#buy').href = buyUrl; $('#chart').href = chartUrl; const bt = $('#buytop'); if (bt) bt.href = buyUrl; const xl = $('#xlink'); if (xl) xl.href = C.X || 'https://x.com/';
  function copyCA() {
    const done = () => toast('CA copied');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(CA).then(done, () => legacyCopy(CA, done));
    else legacyCopy(CA, done);
  }
  function legacyCopy(text, done) { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed'); } ta.remove(); }
  if (CA) {
    $('#ca-text').textContent = CA; $('#ca-box').classList.add('set'); $('#ca-box').hidden = false;
    const cp = $('#copyca'); cp.disabled = false; cp.addEventListener('click', copyCA); $('#ca-text').addEventListener('click', copyCA);
  }

  /* ---------- countdowns: #cd = next payday, #cd2 = the new city */
  const release = new Date(C.RELEASE || '2026-11-19T00:00:00-05:00').getTime();
  const cdEls = $$('#cd b'), cd2 = $$('#cd2 b');
  function nextPayday() {
    const dow = C.PAYDAY_DOW == null ? NaN : +C.PAYDAY_DOW, hr = C.PAYDAY_HOUR_UTC == null ? 18 : +C.PAYDAY_HOUR_UTC;
    const now = new Date(); const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hr, 0, 0));
    let add = isNaN(dow) ? (d.getTime() <= now.getTime() ? 1 : 0) : (dow - d.getUTCDay() + 7) % 7; if (!isNaN(dow) && add === 0 && d.getTime() <= now.getTime()) add = 7; d.setUTCDate(d.getUTCDate() + add); return d.getTime();
  }
  function split(ms) { const s = Math.max(0, Math.floor(ms / 1000)); return [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60]; }
  function tick() {
    split(nextPayday() - Date.now()).forEach((n, i) => { const v = String(n).padStart(2, '0'); if (cdEls[i].textContent === v) return; cdEls[i].textContent = v; cdEls[i].classList.remove('pop'); void cdEls[i].offsetWidth; cdEls[i].classList.add('pop'); });
    const r = release - Date.now(); split(r).forEach((n, i) => { if (cd2[i]) cd2[i].textContent = r <= 0 ? '00' : String(n).padStart(2, '0'); });
  }
  tick(); setInterval(tick, 1000);

  /* ---------- cash card rates (official store list prices) */
  const CARDS = [[99.99, 8000000], [49.99, 3500000], [19.99, 1250000], [9.99, 500000], [4.99, 200000], [2.99, 100000]];
  function renderRates() {
    const tb = $('#rates tbody'); tb.innerHTML = '';
    const best = Math.max.apply(null, CARDS.map(c => c[1] / c[0]));
    CARDS.forEach(([usd, gta]) => { const per = gta / usd; const tr = document.createElement('tr'); if (per === best) tr.className = 'best';
      tr.innerHTML = '<td>$' + usd.toFixed(2) + ' card</td><td class="n">$' + usd.toFixed(2) + '</td><td class="n">' + fmt.gta(gta) + '</td><td class="n">' + nf(per) + (per === best ? ' ★' : '') + '</td>'; tb.appendChild(tr); });
  }

  /* ---------- state from the ledger. entry: {date, type: fees|payday|payslip, sol, usd, gta, handle, platform, handles, note, proof, img} */
  const state = { entries: [], updated: '', registered: 0, feesSol: 0, feesUsd: 0, paidUsd: 0, gtaOut: 0, paydays: [], slips: [], handles: new Set(), pot: 0, live: null, rugShown: false };
  function compute() {
    let sol = 0, fusd = 0, pusd = 0, gta = 0; const H = new Set(); state.paydays = []; state.slips = [];
    for (const e of state.entries) {
      if (e.type === 'fees') { sol += +e.sol || 0; fusd += +e.usd || 0; }
      else if (e.type === 'payday') { pusd += +e.usd || 0; state.paydays.push(e); }
      else if (e.type === 'payslip') { gta += +e.gta || 0; state.slips.push(e); if (e.handle) H.add(String(e.handle).toLowerCase()); }
    }
    state.feesSol = sol; state.feesUsd = fusd; state.paidUsd = pusd; state.gtaOut = gta; state.handles = H; state.pot = Math.max(0, fusd - pusd);
  }
  async function loadLedger() {
    try {
      const r = await fetch('ledger.json?ts=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      state.entries = (j.entries || []).slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
      state.updated = j.updated || ''; state.registered = +j.registered || 0;
    } catch (e) { state.entries = []; }
    compute(); renderAll();
  }

  /* ---------- pot + counters */
  function renderNext() {
    const p = Math.min(1, state.pot / CARD_USD), cards = Math.floor(state.pot / CARD_USD);
    $('#next-name').textContent = '$' + state.pot.toFixed(2) + ' · ' + cards + (cards === 1 ? ' card' : ' cards') + ' ready';
    $('#next-tag').textContent = state.paydays.length ? 'payday #' + (state.paydays.length + 1) : 'first payday';
    const bar = $('#next-bar'); bar.className = p >= 1 ? 'full' : ''; requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = (p * 100).toFixed(1) + '%'; }));
    $('#next-sub').textContent = cards ? fmt.gta(cards * CARD_GTA) + ' goes out at 18:00 UTC · ' + (state.registered || 0) + ' on the payroll' : '$' + Math.max(0, CARD_USD - state.pot).toFixed(2) + ' to the first card · ' + (state.registered || 0) + ' on the payroll';
    countTo($('#g-n'), state.registered, v => String(Math.round(v))); countTo($('#g-bal'), state.gtaOut, fmt.gta);
    countTo($('#g-usd'), state.paydays.length, v => String(Math.round(v))); countTo($('#g-sol'), state.feesSol, fmt.sol);
    countTo($('#p-n'), state.slips.length, v => String(Math.round(v))); countTo($('#p-h'), state.handles.size, v => String(Math.round(v)));
    const mx = state.slips.reduce((a, b) => Math.max(a, +b.gta || 0), 0); $('#p-max').textContent = mx ? fmt.gtaShort(mx) : '—';
    const last = state.paydays[state.paydays.length - 1]; $('#p-last').textContent = last ? fmt.date(last.date) : '—';
  }
  function renderWall() {
    const box = $('#wall'); box.innerHTML = '';
    const imgs = state.entries.filter(e => e.img);
    imgs.slice().reverse().forEach(e => { const a = document.createElement('a'); a.className = 'rc'; a.href = e.proof || e.img; a.target = '_blank'; a.rel = 'noopener'; a.innerHTML = '<img src="' + esc(e.img) + '" alt="" loading="lazy"><span>' + esc(e.handle || '') + ' · ' + esc(fmt.date(e.date)) + '</span>'; box.appendChild(a); });
    $('#wall-empty').hidden = imgs.length > 0;
  }
  function closeDrawer() { }
  function renderMissions() { }

  /* ---------- register on X */
  $('#reg').href = 'https://x.com/intent/post?text=' + encodeURIComponent((XHANDLE ? '@' + XHANDLE + ' ' : '') + 'put me on the payroll: my GTA handle is ____ on ____ (PC / PlayStation / Xbox). holding $UBI.');

  /* ---------- ledger table + csv */
  const TYPES = { fees: 'Fees claimed', payday: 'Payday', payslip: 'Payslip' };
  function renderLedger() {
    const tb = $('#ledger tbody'); tb.innerHTML = '';
    state.entries.slice().reverse().forEach(e => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td class="n">' + esc(fmt.date(e.date)) + '</td><td><span class="tag ' + (e.type === 'payslip' ? 'ok' : e.type === 'payday' ? '' : 'dim') + '">' + esc(TYPES[e.type] || e.type) + '</span></td>' +
        '<td class="n">' + (e.sol != null ? esc(fmt.sol(e.sol)) : '—') + '</td><td class="n">' + (e.usd != null ? '$' + (+e.usd).toFixed(2) : '—') + '</td><td class="n">' + (e.gta != null ? nf(e.gta) : '—') + '</td>' +
        '<td>' + (e.handle ? esc(e.handle) + (e.platform ? ' · ' + esc(e.platform) : '') : (e.handles ? e.handles + ' handles' : esc(e.note || ''))) + '</td>' +
        '<td>' + (e.proof ? '<a href="' + esc(e.proof) + '" target="_blank" rel="noopener">view ↗</a>' : '—') + '</td>';
      tb.appendChild(tr);
    });
    $('#l-empty').hidden = state.entries.length > 0;
    $('#l-meta').textContent = 'updated: ' + (state.updated || '—') + ' · entries: ' + state.entries.length + ' · on the payroll: ' + (state.registered || 0);
  }
  $('#csv').addEventListener('click', () => {
    const rows = [['date', 'type', 'sol', 'usd', 'gta', 'handle', 'platform', 'handles', 'note', 'proof']];
    state.entries.forEach(e => rows.push([e.date, e.type, e.sol, e.usd, e.gta, e.handle, e.platform, e.handles, e.note, e.proof]));
    const csv = rows.map(r => r.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'ubi-payslips.csv';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast(state.entries.length ? 'Payslips exported' : 'Exported an empty ledger. Payday is 18:00 UTC.');
  });

  /* ---------- calculator */
  const vol = $('#c-vol'), fee = $('#c-fee'), cn = $('#c-n');
  function setPct(el) { el.style.setProperty('--pct', ((el.value - el.min) / (el.max - el.min) * 100) + '%'); }
  function calc() {
    setPct(vol); setPct(fee); setPct(cn);
    const v = +vol.value, f = +fee.value, n = +cn.value, week = v * f / 100, cards = Math.floor(week / CARD_USD), gta = cards * CARD_GTA;
    $('#c-vol-o').textContent = fmt.usdFull(v); $('#c-fee-o').textContent = f.toFixed(2) + '%'; $('#c-n-o').textContent = nf(n);
    $('#c-fees').textContent = fmt.usdFull(week); $('#c-cars').textContent = String(cards); $('#c-gta').textContent = fmt.gta(gta);
    $('#c-days').textContent = cards >= n ? fmt.gtaShort(CARD_GTA) + ' each' : cards ? cards + ' of ' + nf(n) + ' paid, rest in the draw' : 'pot too small today';
  }
  vol.addEventListener('input', calc); fee.addEventListener('input', calc); cn.addEventListener('input', calc);

  /* ---------- live data (DexScreener), honest offline states */
  function offline(word, stamp) { const lw = $('#live-word'); if (lw) lw.textContent = word; const dot = $('.dot'); if (dot) dot.classList.remove('live'); document.body.classList.remove('live'); $('#stamp').textContent = stamp; if (state.live) { state.live = null; renderTicker(); } }
  function wanted(L) {
    const t = L.buys + L.sells; if (!t) return 0; const r = L.buys / t;
    let w = r >= .75 ? 5 : r >= .65 ? 4 : r >= .55 ? 3 : r >= .45 ? 2 : 1; if (t < 10) w = Math.min(w, 2); return w;
  }
  async function live() {
    if (!CA) { offline('pre-launch', 'CA not set'); return; }
    try {
      const r = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + CA, { cache: 'no-store' }); if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      const pairs = (j.pairs || []).filter(p => p.chainId === 'solana'); if (!pairs.length) throw new Error('no pair');
      pairs.sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0));
      const p = pairs[0];
      const L = {
        price: +p.priceUsd || 0, h1: +((p.priceChange || {}).h1 || 0), m5: +((p.priceChange || {}).m5 || 0), h24: +((p.priceChange || {}).h24 || 0),
        buys: ((p.txns || {}).h1 || {}).buys || 0, sells: ((p.txns || {}).h1 || {}).sells || 0,
        marketCap: p.marketCap || p.fdv || 0, vol: (p.volume || {}).h24 || 0,
        bonded: pairs.some(x => x.dexId && x.dexId !== 'pumpfun'), dexPaid: !!(p.info && (p.info.imageUrl || (p.info.socials || []).length || (p.info.websites || []).length)),
        pair: p.pairAddress
      };
      state.live = L; renderLive(L);
    } catch (e) { offline('offline', 'no data'); }
  }
  function renderLive(L) {
    const lw = $('#live-word'); if (lw) lw.textContent = 'live'; const dot = $('.dot'); if (dot) dot.classList.add('live'); document.body.classList.add('live');
    $('#stamp').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    countTo($('#s-mc'), L.marketCap, fmt.usd); countTo($('#s-vol'), L.vol, fmt.usd); $('#s-px').textContent = fmt.px(L.price);
    const h = $('#s-h1'); h.textContent = fmt.pct(L.h1); h.className = L.h1 > 0 ? 'up' : L.h1 < 0 ? 'down' : '';
    $('#s-bs').textContent = L.buys + ' / ' + L.sells;
    const wl = wanted(L); $('#s-wl').textContent = '★'.repeat(wl) + '☆'.repeat(5 - wl);
    $$('#stars i').forEach((s, i) => s.classList.toggle('on', i < wl));
    if (L.h1 <= -30 && !state.rugShown) { state.rugShown = true; rug(L); }
    if (state.lastMc && L.marketCap >= state.lastMc * 1.15) toast('Cash up: ' + fmt.usd(L.marketCap));
    state.lastMc = L.marketCap;
    renderMissions(); renderTicker();
  }
  function rug(L) { $('#rug-why').textContent = fmt.pct(L.h1) + ' in an hour. payday is still 18:00.'; $('#rugged').hidden = false; document.body.classList.add('rug'); }
  $('#rug-x').addEventListener('click', () => { $('#rugged').hidden = true; document.body.classList.remove('rug'); toast('respawned. payday is still 18:00.'); });

  /* ---------- route animation */
  const nodes = $$('#flow .node'); let fi = 0;
  setInterval(() => { nodes.forEach((n, i) => n.classList.toggle('lit', i === fi)); fi = (fi + 1) % nodes.length; }, 1400);

  /* ---------- the scene: a neon road into the city, drawn on the canvas behind everything */
  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = $('#bg'), cx2 = cv.getContext('2d');
  const scene = { t: 0, speed: 0.3, k: 0.1, w: 0, h: 0, stars: [], bld: [], cars: [], last: 0 };
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function seedScene() {
    const R = rng(7);
    scene.stars = Array.from({ length: 170 }, () => ({ x: R(), y: R() * 0.55, r: 0.5 + R() * 1.3, p: R() * 6.28 }));
    scene.bld = []; let x = -0.02;
    while (x < 1.05) { const w = 0.014 + R() * 0.045; scene.bld.push({ x, w, h: 0.03 + R() * 0.12, win: Array.from({ length: 2 + Math.floor(R() * 7) }, () => ({ x: R(), y: R(), p: R() * 6.28 })) }); x += w + 0.004; }
    scene.cars = Array.from({ length: 6 }, (_, i) => ({ lane: (i % 2 ? 1 : -1) * (0.3 + R() * 0.55), z: 0.3 + R() * 8, v: 0.5 + R() * 0.7, away: i % 2 === 0 }));
  }
  function sizeScene() { const dpr = Math.min(2, window.devicePixelRatio || 1); scene.w = innerWidth; scene.h = innerHeight; cv.width = Math.round(scene.w * dpr); cv.height = Math.round(scene.h * dpr); cx2.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function laneX(L, y, hz, vx, w, h) { const f = (y - hz) / (h + 40 - hz); return vx + L * (2 + (w * 0.11 - 2) * f); }
  function drawScene(now) {
    const dt = Math.min(0.05, scene.last ? (now - scene.last) / 1000 : 0); scene.last = now; scene.t += dt * scene.speed;
    const c = cx2, w = scene.w, h = scene.h, k = scene.k, hz = h * 0.6, vx = w / 2, S = 0.55;
    let g = c.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, '#07100f'); g.addColorStop(1, '#0a2a24'); c.fillStyle = g; c.fillRect(0, 0, w, hz);
    g = c.createLinearGradient(0, hz, 0, h); g.addColorStop(0, '#08241e'); g.addColorStop(1, '#07100f'); c.fillStyle = g; c.fillRect(0, hz, w, h - hz);
    c.fillStyle = '#fff';
    for (const s of scene.stars) { c.globalAlpha = (0.3 + 0.7 * Math.abs(Math.sin(scene.t * 0.9 + s.p))) * (0.45 + 0.55 * k); c.beginPath(); c.arc(s.x * w, s.y * h, s.r, 0, 6.2832); c.fill(); }
    c.globalAlpha = 1;
    const sr = Math.min(w, h) * 0.17, sx = w * 0.72, sy = hz - sr * 0.2;
    c.save(); c.beginPath(); c.rect(0, 0, w, hz); c.clip(); c.globalAlpha = 0.3 + 0.7 * k;
    g = c.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 2.4); g.addColorStop(0, 'rgba(40,200,140,.38)'); g.addColorStop(1, 'rgba(40,200,140,0)'); c.fillStyle = g; c.fillRect(sx - sr * 2.4, sy - sr * 2.4, sr * 4.8, sr * 4.8);
    g = c.createLinearGradient(0, sy - sr, 0, sy + sr); g.addColorStop(0, '#e9fff4'); g.addColorStop(0.4, '#6ff0b8'); g.addColorStop(1, '#128a62'); c.fillStyle = g; c.beginPath(); c.arc(sx, sy, sr, 0, 6.2832); c.fill();
    c.fillStyle = '#0a2a24'; let y = sy + sr * 0.08, i = 0;
    while (y < sy + sr) { const band = Math.max(3, sr * 0.1 - i * sr * 0.011), gap = Math.max(2, sr * 0.018 + i * sr * 0.011); c.fillRect(sx - sr - 2, y + band, sr * 2 + 4, gap); y += band + gap; i++; }
    c.restore();
    c.fillStyle = '#06081a';
    for (const b of scene.bld) c.fillRect(b.x * w, hz - b.h * h, b.w * w, b.h * h + 2);
    for (const b of scene.bld) { const bx = b.x * w, bw = b.w * w, bh = b.h * h; for (const win of b.win) { if (Math.sin(scene.t * 0.5 + win.p) < -0.25) continue; c.fillStyle = win.p > 4.2 ? 'rgba(200,255,225,.85)' : 'rgba(255,228,170,.6)'; c.globalAlpha = 0.25 + 0.75 * k; c.fillRect(bx + 2 + win.x * (bw - 5), hz - bh + 3 + win.y * (bh - 7), 2, 2); } }
    c.globalAlpha = 1;
    c.strokeStyle = 'rgba(72,230,150,' + (0.35 + 0.65 * k) + ')'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, hz + 0.5); c.lineTo(w, hz + 0.5); c.stroke();
    c.lineWidth = 1;
    for (let n = -14; n <= 14; n++) { const a = (0.1 + 0.28 * (1 - Math.abs(n) / 14)) * (0.35 + 0.65 * k); c.strokeStyle = 'rgba(72,230,150,' + a + ')'; c.beginPath(); c.moveTo(vx + n * 2, hz); c.lineTo(vx + n * w * 0.11, h + 40); c.stroke(); }
    const frac = scene.t % 1;
    for (let n = 0; n < 16; n++) { const z = n + 1 - frac, p = 1 / (1 + z * S), yy = hz + (h - hz) * p; c.strokeStyle = 'rgba(72,230,150,' + ((0.06 + 0.6 * p) * (0.35 + 0.65 * k)) + ')'; c.lineWidth = 0.6 + 2.2 * p; c.beginPath(); c.moveTo(0, yy); c.lineTo(w, yy); c.stroke(); }
    for (const car of scene.cars) {
      car.z += dt * car.v * scene.speed * 2.2 * (car.away ? 1 : -1);
      if (car.z > 9.5) car.z = 0.25; if (car.z < 0.25) car.z = 9.5;
      const p = 1 / (1 + car.z * S), yy = hz + (h - hz) * p, x = laneX(car.lane, yy, hz, vx, w, h), r = 0.8 + 5 * p, gap = 2 + 9 * p;
      const col = car.away ? '255,92,122' : '255,246,224'; const a = (0.25 + 0.75 * p) * (0.3 + 0.7 * k);
      c.fillStyle = 'rgba(5,6,18,' + (0.5 + 0.5 * p) + ')'; c.fillRect(x - gap - r * 1.4, yy - r * 1.6, (gap + r * 1.4) * 2, r * 2.6);
      c.fillStyle = 'rgba(' + col + ',' + (a * 0.18) + ')'; c.fillRect(x - gap - r * 2.2, yy - r * 1.2, (gap + r * 2.2) * 2, r * 2.4);
      c.fillStyle = 'rgba(' + col + ',' + a + ')'; c.fillRect(x - gap - r, yy - r * 0.5, r * 2, r); c.fillRect(x + gap - r, yy - r * 0.5, r * 2, r);
    }
    c.fillStyle = 'rgba(7,12,16,' + (0.82 * (1 - k)) + ')'; c.fillRect(0, 0, w, h);
  }
  function loop(now) { if (!document.hidden) drawScene(now); else scene.last = 0; requestAnimationFrame(loop); }
  seedScene(); sizeScene(); window.addEventListener('resize', sizeScene);
  if (REDUCED) { scene.speed = 0; drawScene(0); } else requestAnimationFrame(loop);
  function tweenScene(k, speed, ms) { const t0 = performance.now(), k0 = scene.k, s0 = scene.speed; (function f(now) { const u = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - u, 3); scene.k = k0 + (k - k0) * e; scene.speed = s0 + (speed - s0) * e; if (u < 1) requestAnimationFrame(f); })(t0); }

  /* ---------- intro */
  const intro = $('#intro'); let introTimer = null;
  const TIPS = ['loading the new city…', 'fees buy the cars.', 'receipts on the wall.', 'items stay in the shop. not backing.', 'not affiliated with rockstar or take-two.', 'ready.'];
  function startIntro() {
    clearTimeout(introTimer); window.scrollTo(0, 0); closeDrawer();
    document.body.classList.add('intro'); document.body.classList.remove('in');
    intro.hidden = false; intro.className = '';
    scene.k = 1; scene.speed = 1.7; scene.last = 0;
    requestAnimationFrame(() => requestAnimationFrame(() => { intro.classList.add('go'); }));
    introTimer = setTimeout(enterShop, 3000);
  }
  function enterShop() {
    if (intro.hidden) return;
    clearTimeout(introTimer); try { sessionStorage.setItem('bukz-intro', '1'); } catch (e) { }
    intro.classList.add('out'); document.body.classList.remove('intro'); document.body.classList.add('in');
    tweenScene(0.1, 0.3, 1600); moveInd();
    setTimeout(() => { intro.hidden = true; }, 900);
  }
  intro.addEventListener('click', enterShop);
  document.addEventListener('keydown', e => { if (!intro.hidden && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); enterShop(); } });
  $('#replay').addEventListener('click', () => { go('home', false); startIntro(); });
  if (REDUCED) { intro.hidden = true; document.body.classList.remove('intro'); document.body.classList.add('in'); }
  else startIntro();

  /* ---------- pointer: tilt on items, light on cards */
  if (window.matchMedia && window.matchMedia('(hover: hover)').matches && !REDUCED) {
    document.addEventListener('pointermove', e => {
      const el = e.target.closest('.item,.card,.mission'); if (!el) return;
      const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--mx', (px * 100).toFixed(1) + '%'); el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      if (el.classList.contains('item')) el.style.transform = 'perspective(900px) rotateX(' + ((0.5 - py) * 9).toFixed(2) + 'deg) rotateY(' + ((px - 0.5) * 11).toFixed(2) + 'deg) translateY(-4px)';
    });
    document.addEventListener('pointerout', e => { const el = e.target.closest('.item'); if (el && !el.contains(e.relatedTarget)) el.style.transform = ''; });
  }

  /* ---------- ticker */
  function renderTicker() {
    const parts = []; const L = state.live;
    if (L) parts.push('<span class="live"><em>live</em><b>' + fmt.usd(L.marketCap) + ' mcap</b> · ' + fmt.px(L.price) + ' · 1h ' + esc(fmt.pct(L.h1)) + '</span>');
    else parts.push('<span><em class="dim">' + (CA ? 'offline' : 'pre-launch') + '</em><b>universal basic income for the new city</b></span>');
    parts.push('<span><em>payday</em><b>every day 18:00 utc</b></span>');
    parts.push('<span><em class="dim">payroll</em><b>' + (state.registered || 0) + ' handles</b> · pot $' + state.pot.toFixed(2) + '</span>');
    parts.push('<span><em class="dim">paid out</em><b>' + esc(fmt.gta(state.gtaOut)) + '</b> · ' + state.slips.length + ' payslips</span>');
    parts.push('<span><em class="dim">fees</em><b>' + esc(fmt.sol(state.feesSol)) + '</b> claimed</span>');
    parts.push('<span><em class="dim">minimum</em><b>$' + (C.MIN_HOLD_USD || 0) + ' of $UBI</b> to be on the payroll</span>');
    const html = parts.join(''); const tk = $('#tk'); if (tk) tk.innerHTML = html + html;
  }

  /* ---------- count-ups */
  function countTo(el, to, f) {
    if (!el) return; const from = +el.dataset.v || 0; if (from === to) { el.textContent = f(to); return; }
    el.dataset.v = to; const t0 = performance.now(), d = REDUCED ? 0 : 750;
    (function step(now) { const u = d ? Math.min(1, (now - t0) / d) : 1, e = 1 - Math.pow(1 - u, 3); el.textContent = f(from + (to - from) * e); if (u < 1) requestAnimationFrame(step); })(t0);
  }

  /* ---------- boot */
  function renderAll() { renderNext(); renderWall(); renderLedger(); renderTicker(); calc(); }
  compute(); renderRates(); renderAll();
  go(location.hash.slice(1) || 'home', false);
  loadLedger();
  live(); setInterval(() => { if (!document.hidden) live(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) live(); });
})();
