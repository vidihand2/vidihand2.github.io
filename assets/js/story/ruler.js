'use strict';
(() => {
  const { $, $$, clamp, DPR, demoVisibility, FONT, PAL, near, makeVideo, fitCanvas, LOAD } = window.VDHStory;
  const sec = $('#st-ruler'); if (!sec) return;
  const BONES = [[0, 1], [1, 2], [2, 3], [3, 17], [0, 4], [4, 5], [5, 6], [6, 18], [0, 7], [7, 8], [8, 9], [9, 20], [0, 10], [10, 11], [11, 12], [12, 19], [0, 13], [13, 14], [14, 15], [15, 16]];
  const GREEN = '#39ab38', ORANGE = '#ff9f0a', RED = '#ff453a';
  const TOL = 10;
  const errCol = e => (Math.abs(e) <= TOL ? GREEN : Math.abs(e) <= 50 ? ORANGE : RED);
  const shownErr = (c, gt) => Math.round((+c.toFixed(1) - gt) * 100) / 10;
  function build() {
    const D = window.VIDIHAND_RULER; if (!D) return;
    const ours = D.methods.find(m => m.key === 'vidihand_v2');
    D.methods.forEach(m => { const a = m.d.filter(c => c != null); m.in1 = Math.round(100 * a.filter(c => Math.abs(c - D.gt) * 10 <= TOL).length / a.length); });
    const others = ['wilor', 'hawor', 'vidihand_v1', 'ace_ego_hand'].map(k => D.methods.find(m => m.key === k));
    const colOf = m => (m === ours ? GREEN : PAL(m.name));
    let pick = others[0];
    const v = makeVideo('assets/video/ruler/measurement.mp4');
    v.className = 'ru-src'; v.setAttribute('aria-hidden', 'true'); $('.ru-panels', sec).prepend(v);
    LOAD.add(30, () => LOAD.warm(v));
    const poster = new Image(); LOAD.image(30, sec, poster, 'assets/video/ruler/measurement.jpg'); poster.onload = () => redraw(true);
    const panels = [$('#ru-base'), $('#ru-ours')].map(f => ({ c: $('canvas', f), mae: $('.ru-mae', f) })), baseName = $('#ru-base .ru-name');
    const chart = $('#ru-chart'), pickEl = $('#ru-pick'), play = $('#ru-play');
    const vs = () => (innerWidth > 760 ? 'vs ' : '');
    pickEl.innerHTML = others.map((m, i) => `<button type="button" aria-pressed="${i === 0}" data-k="${m.key}">${i === 0 ? vs() : ''}${m.name}</button>`).join('');
    function labels() {
      baseName.textContent = pick.name; baseName.style.color = colOf(pick);
      panels[0].mae.innerHTML = `mean error <b>${pick.mae.toFixed(1)} mm</b> · ${pick.in1}% of frames within 1 cm`;
      panels[1].mae.innerHTML = `mean error <b>${ours.mae.toFixed(1)} mm</b> · ${ours.in1}% of frames within 1 cm`;
    }
    pickEl.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      pick = others.find(m => m.key === b.dataset.k);
      $$('button', pickEl).forEach(x => { x.setAttribute('aria-pressed', String(x === b)); x.textContent = (x === b ? vs() : '') + others.find(m => m.key === x.dataset.k).name; });
      labels(); redraw(true);
    });
    labels();

    let shown = 0, rvfc = false;
    const frame = () => { if (!rvfc && !v.seeking) shown = clamp(Math.floor(v.currentTime * D.fps + 1e-3), 0, D.n - 1); return shown; };
    if (v.requestVideoFrameCallback) {
      const cb = (now, meta) => { rvfc = true; shown = clamp(Math.round(meta.mediaTime * D.fps), 0, D.n - 1); redraw(true); v.requestVideoFrameCallback(cb); };
      v.requestVideoFrameCallback(cb);
    }
    function drawPanel(P, m, t) {
      const [w, h] = fitCanvas(P.c), ctx = P.c.getContext('2d'), d = DPR();
      const src = snapOk ? snap : (poster.complete && poster.naturalWidth ? poster : null);
      if (src) ctx.drawImage(src, 0, 0, w, h); else { ctx.fillStyle = '#111'; ctx.fillRect(0, 0, w, h); }
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(0, 0, w, h);
      const s = w / D.width, J = m.j[t], col = colOf(m);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      J.forEach(H => {
        if (!H) return;
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.6 * d; ctx.beginPath();
        BONES.forEach(([a, b]) => { ctx.moveTo(H[a][0] * s, H[a][1] * s); ctx.lineTo(H[b][0] * s, H[b][1] * s); }); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; H.forEach(q => { ctx.beginPath(); ctx.arc(q[0] * s, q[1] * s, 1.8 * d, 0, 7); ctx.fill(); });
      });
      const dist = m.d[t];
      if (!J[0] || !J[1] || dist == null) {
        ctx.font = `600 ${14 * d}px ${FONT}`; ctx.fillStyle = RED; ctx.textAlign = 'center'; ctx.fillText('Hand lost', w / 2, 30 * d); return;
      }
      const A = [J[0][16][0] * s, J[0][16][1] * s], B = [J[1][16][0] * s, J[1][16][1] * s];
      const e = shownErr(dist, D.gt), ec = errCol(e);
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 6 * d; ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...B); ctx.stroke();
      ctx.strokeStyle = ec; ctx.lineWidth = 3 * d; ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...B); ctx.stroke();
      [A, B].forEach(q => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q[0], q[1], 7 * d, 0, 7); ctx.fill(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(q[0], q[1], 4.6 * d, 0, 7); ctx.fill(); });
      const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2 - 30 * d;
      const big = `${dist.toFixed(1)} cm`, small = `${e >= 0 ? '+' : '−'}${Math.abs(e).toFixed(0)} mm`;
      ctx.font = `700 ${(w / d < 420 ? 15 : 19) * d}px ${FONT}`; const bw = ctx.measureText(big).width;
      ctx.font = `600 ${(w / d < 420 ? 11 : 13) * d}px ${FONT}`; const sw = ctx.measureText(small).width;
      const pw = bw + sw + 30 * d, ph = (w / d < 420 ? 28 : 34) * d;
      const px = clamp(mx - pw / 2, 6 * d, w - pw - 6 * d), py = clamp(my - ph / 2, 6 * d, h - ph - 6 * d);
      ctx.fillStyle = ec; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px, py, pw, ph, ph / 2) : ctx.rect(px, py, pw, ph); ctx.fill();
      ctx.fillStyle = ec === ORANGE ? '#1d1d1f' : '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = `700 ${(w / d < 420 ? 15 : 19) * d}px ${FONT}`; ctx.fillText(big, px + 12 * d, py + ph / 2 + 1 * d);
      ctx.globalAlpha = 0.85; ctx.font = `600 ${(w / d < 420 ? 11 : 13) * d}px ${FONT}`; ctx.fillText(small, px + 18 * d + bw, py + ph / 2 + 1 * d); ctx.globalAlpha = 1;
      ctx.textBaseline = 'alphabetic';
    }
    function drawChart(t) {
      const [w, h] = fitCanvas(chart), ctx = chart.getContext('2d'), d = DPR(), narrow = w / d < 560;
      const Y = [16, 34], m = { l: (narrow ? 34 : 44) * d, r: 10 * d, t: 26 * d, b: 26 * d };
      const X = i => m.l + i / (D.n - 1) * (w - m.l - m.r), Yp = c => m.t + (Y[1] - clamp(c, Y[0], Y[1])) / (Y[1] - Y[0]) * (h - m.t - m.b);
      ctx.clearRect(0, 0, w, h);
      D.occ.forEach(([a, b]) => {
        const o0 = clamp(a * D.fps, 0, D.n - 1), o1 = clamp(b * D.fps, 0, D.n - 1);
        ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(X(o0), m.t, X(o1) - X(o0), h - m.t - m.b);
        ctx.fillStyle = '#a1a1a6'; ctx.font = `600 ${11.5 * d}px ${FONT}`; ctx.textAlign = 'center';
        ctx.fillText(narrow ? 'Behind the cup' : 'Hand behind the cup', (X(o0) + X(o1)) / 2, m.t - 8 * d);
      });
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1 * d; ctx.fillStyle = '#86868b'; ctx.font = `500 ${11 * d}px ${FONT}`; ctx.textAlign = 'right';
      [16, 20, 25, 30, 34].forEach(c => { ctx.beginPath(); ctx.moveTo(m.l, Yp(c)); ctx.lineTo(w - m.r, Yp(c)); ctx.stroke(); ctx.fillText(`${c}`, m.l - 6 * d, Yp(c) + 4 * d); });
      ctx.fillText('cm', m.l - 6 * d, m.t + 18 * d);
      ctx.fillStyle = 'rgba(57,171,56,0.22)'; ctx.fillRect(m.l, Yp(D.gt + TOL / 10), w - m.l - m.r, Yp(D.gt - TOL / 10) - Yp(D.gt + TOL / 10));
      ctx.setLineDash([5 * d, 5 * d]); ctx.strokeStyle = 'rgba(245,245,247,0.7)'; ctx.beginPath(); ctx.moveTo(m.l, Yp(D.gt)); ctx.lineTo(w - m.r, Yp(D.gt)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#d2d2d7'; ctx.textAlign = 'right'; ctx.font = `600 ${11.5 * d}px ${FONT}`; ctx.fillText(`Ruler ${D.gt} cm ± 1 cm`, w - m.r - 4 * d, Yp(D.gt + TOL / 10) - 6 * d);
      [pick, ours].forEach(M => {
        ctx.strokeStyle = colOf(M); ctx.lineWidth = (M === ours ? 2.4 : 1.8) * d; ctx.beginPath(); let on = false;
        M.d.forEach((c, i) => { if (c == null) { on = false; return; } on ? ctx.lineTo(X(i), Yp(c)) : ctx.moveTo(X(i), Yp(c)); on = true; }); ctx.stroke();
      });
      { let k = -1; pick.d.forEach((c, i) => { if (c != null && c > Y[1] && (k < 0 || c > pick.d[k])) k = i; });
        if (k >= 0) { ctx.fillStyle = colOf(pick); ctx.font = `700 ${11.5 * d}px ${FONT}`; ctx.textAlign = X(k) > w - 90 * d ? 'right' : 'left';
          ctx.fillText(`↑ ${pick.d[k].toFixed(1)} cm`, X(k) + (ctx.textAlign === 'left' ? 6 : -6) * d, m.t + 11 * d); } }
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5 * d; ctx.beginPath(); ctx.moveTo(X(t), m.t); ctx.lineTo(X(t), h - m.b); ctx.stroke();
      [pick, ours].forEach(M => { const c = M.d[t]; if (c == null) return; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(X(t), Yp(c), 6.6 * d, 0, 7); ctx.fill();
        ctx.fillStyle = errCol(shownErr(c, D.gt)); ctx.beginPath(); ctx.arc(X(t), Yp(c), 4.2 * d, 0, 7); ctx.fill(); ctx.strokeStyle = colOf(M); ctx.lineWidth = 1.6 * d; ctx.beginPath(); ctx.arc(X(t), Yp(c), 5 * d, 0, 7); ctx.stroke(); });
      ctx.fillStyle = '#86868b'; ctx.font = `500 ${11 * d}px ${FONT}`; ctx.textAlign = 'left';
      ctx.fillText('0 s', m.l, h - 8 * d); ctx.textAlign = 'right'; ctx.fillText(`${((D.n - 1) / D.fps).toFixed(1)} s`, w - m.r, h - 8 * d);
    }
    let last = -1, snapAt = -1;
    const snap = document.createElement('canvas'); let snapOk = false;
    function grab() {
      if (v.readyState < 2 || v.seeking || !v.videoWidth) return;
      if (snapOk && snapAt === v.currentTime) return;
      if (snap.width !== v.videoWidth) { snap.width = v.videoWidth; snap.height = v.videoHeight; }
      snap.getContext('2d').drawImage(v, 0, 0); snapOk = true; snapAt = v.currentTime;
    }
    function redraw(force) {
      const t = frame(); if (!force && t === last) return; last = t; grab();
      drawPanel(panels[0], pick, t); drawPanel(panels[1], ours, t); drawChart(t);
    }
    let inView = false, user = null;
    const setBtn = () => { const p = v.paused; play.setAttribute('aria-label', p ? 'Play' : 'Pause'); play.classList.toggle('paused', p); };
    v.addEventListener('play', setBtn); v.addEventListener('pause', setBtn);
    new IntersectionObserver(es => es.forEach(e => {
      inView = e.isIntersecting;
      if (inView) LOAD.present(v).then(() => { if (inView && user !== 'pause') v.play().catch(() => {}); }); else v.pause();
    }), demoVisibility).observe($('.ru-panels', sec));
    play.addEventListener('click', () => { if (v.paused) { user = null; v.play().catch(() => {}); } else { user = 'pause'; v.pause(); } });
    const seek = e => { const r = chart.getBoundingClientRect(), ml = (r.width < 560 ? 34 : 44);
      const i = clamp((e.clientX - r.left - ml) / (r.width - ml - 10)) * (D.n - 1); go((Math.round(i) + 0.5) / D.fps); };
    let pend = null;
    const go = t => { if (v.seeking) { pend = t; return; } v.currentTime = t; };
    let tp = null;
    const startScrub = e => { user = 'pause'; v.pause(); try { chart.setPointerCapture(e.pointerId); } catch { } seek(e); };
    chart.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') startScrub(e); else tp = { id: e.pointerId, x: e.clientX, y: e.clientY, on: false }; });
    chart.addEventListener('pointermove', e => {
      if (tp && tp.id === e.pointerId) {
        if (!tp.on && Math.abs(e.clientX - tp.x) > 6 && Math.abs(e.clientX - tp.x) > Math.abs(e.clientY - tp.y)) { tp.on = true; startScrub(e); }
        else if (tp.on) seek(e);
        return;
      }
      if (e.buttons && chart.hasPointerCapture(e.pointerId)) seek(e);
    });
    chart.addEventListener('pointerup', e => { if (tp && tp.id === e.pointerId && !tp.on) startScrub(e); tp = null; });
    chart.addEventListener('pointercancel', () => { tp = null; });
    v.addEventListener('seeked', () => { if (pend != null) { const t = pend; pend = null; v.currentTime = t; return; }
      shown = clamp(Math.floor(v.currentTime * D.fps + 1e-3), 0, D.n - 1); redraw(true); });
    v.addEventListener('loadeddata', () => redraw(true));
    (function loop() { if (inView || near(sec)) redraw(false); requestAnimationFrame(loop); })();
    addEventListener('resize', () => redraw(true));
    redraw(true);
  }
  build();
})();
