'use strict';
(() => {
  const { $, $$, clamp, lerp, smooth, seg, ease, DPR, reduce, FONT, PAL, windowed, fitCanvas } = window.VDHStory;
  const sec = $('#st-chart'), M = window.VIDIHAND_METRICS; if (!sec || !M) return;
  const DS = 'gen_humanego_1h';
  const METRICS = [
    { key: 'FAIL', src: 'FAcc', tf: x => 100 - x, tab: 'Frame accuracy', name: 'failed frames', axis: 'Failed frames in the wild (%, log scale)', short: 'failed frames', Y: [0.06, 40], ticks: [0.1, 0.3, 1, 3, 10, 30], log: true, ratio: true,
      fmt: e => `${(100 - e).toFixed(2)}% frame accuracy` },
    { key: 'MPJPE-abs-p', tab: '3D error', name: 'absolute 3D joint error', axis: 'Absolute 3D joint error in the wild (mm)', unit: 'mm', short: 'error', Y: [20, 160], ticks: [40, 80, 120, 160], grid: 20, dec: 1 },
    { key: 'EPE2D-p', tab: '2D error', name: '2D joint error', axis: '2D joint error in the wild (px)', unit: 'px', short: '2D error', Y: [0, 36], ticks: [0, 10, 20, 30], grid: 5, dec: 1 },
    { key: 'Jitter', tab: 'Jitter', name: 'jitter', axis: 'Jitter in the wild (mm/frame², log scale)', unit: 'mm/frame²', short: 'jitter', Y: [1.2, 60], ticks: [2, 5, 10, 20, 50], log: true, dec: 2 },
  ];
  const pts = M.methods.map(m => {
    const v = (m.versions[m.default] || {})[DS];
    return v && m.fps && METRICS.every(k => v[k.src || k.key] != null)
      ? { id: m.id, name: m.name, ours: !!m.ours, v1: m.id === 'vidihand_v1', v: Object.fromEntries(METRICS.map(k => [k.key, k.tf ? k.tf(v[k.src]) : v[k.key]])), fps: m.fps, venue: m.venue } : null;
  }).filter(Boolean);
  const ours = pts.find(q => q.ours), v1 = pts.find(q => q.v1), base = pts.filter(q => !q.ours);
  const speed = Math.round(ours.fps / v1.fps);
  METRICS.forEach(k => {
    k.best = base.reduce((a, b) => (b.v[k.key] < a.v[k.key] ? b : a));
    k.gain = Math.round(100 * (1 - ours.v[k.key] / k.best.v[k.key]));
    k.v1gain = Math.round(100 * (1 - ours.v[k.key] / v1.v[k.key]));
    k.x = (k.best.v[k.key] / ours.v[k.key]).toFixed(1); k.v1x = (v1.v[k.key] / ours.v[k.key]).toFixed(1);
  });
  const K3D = METRICS.find(k => k.key === 'MPJPE-abs-p');
  const order = base.slice().sort((a, b) => b.v[K3D.key] - a.v[K3D.key]);
  order.forEach((q, i) => (q.t0 = 0.06 + 0.26 * i / (order.length - 1)));
  ours.t0 = 0.36;
  const canvas = $('#ch-canvas'), stage = $('#ch-stage'), tip = $('#ch-tip'), caps = $$('.ch-caps p', sec), tabs = $('#ch-metric');
  const X = [1, 100];
  const st = { k: METRICS.indexOf(K3D), from: METRICS.indexOf(K3D), t: 1 };
  let hover = null, last = { p: 0, geo: null };

  tabs.innerHTML = METRICS.map((k, i) => `<button type="button" aria-pressed="${i === st.k}" data-i="${i}">${k.tab}</button>`).join('');
  function captions() {
    const k = METRICS[st.k], f = x => x.toFixed(k.dec);
    caps[1].innerHTML = k.ratio
      ? `<b class="st-ours">ViDiHand2</b>: <b>${(100 - ours.v[k.key]).toFixed(2)}%</b> frame accuracy at <b>${Math.round(ours.fps)} FPS</b>.`
      : `<b class="st-ours">ViDiHand2</b>: <b>${f(ours.v[k.key])} ${k.unit}</b> ${k.name} at <b>${Math.round(ours.fps)} FPS</b>.`;
    if (k.ratio) {
      caps[2].innerHTML = `<b>${k.x}×</b> fewer ${k.name} than the best baseline, <b>${k.best.name}</b>.`;
      caps[3].innerHTML = `<b>${speed}×</b> faster than <b class="st-v1">ViDiHand</b>, at higher frame accuracy.`;
      return;
    }
    caps[2].innerHTML = k.gain >= 20
      ? `<b>${k.gain}%</b> lower ${k.name} than the best baseline, <b>${k.best.name}</b>.`
      : `The lowest ${k.name} of all ${pts.length} methods, <b>${k.gain}%</b> below the next, <b>${k.best.name}</b>.`;
    caps[3].innerHTML = `<b>${speed}×</b> faster than <b class="st-v1">ViDiHand</b>, with <b>${k.v1gain}%</b> lower ${k.name}.`;
  }
  tabs.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const i = +b.dataset.i; if (i === st.k) return;
    st.from = st.k; st.k = i; st.t = 0; captions();
    $$('button', tabs).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    const t0 = performance.now();
    (function step(now) { st.t = reduce ? 1 : clamp((now - t0) / 700); draw(); if (st.t < 1) requestAnimationFrame(step); })(t0);
  });
  captions();

  function geometry(w, h, d) {
    const narrow = w / d < 640;
    const m = { l: (narrow ? 44 : 64) * d, r: (narrow ? 14 : 30) * d, t: (narrow ? 52 : 34) * d, b: 46 * d };
    const px = f => m.l + (Math.log10(f) - Math.log10(X[0])) / (Math.log10(X[1]) - Math.log10(X[0])) * (w - m.l - m.r);
    const pyk = (k, e) => m.t + (k.log ? Math.log(e / k.Y[0]) / Math.log(k.Y[1] / k.Y[0]) : (e - k.Y[0]) / (k.Y[1] - k.Y[0])) * (h - m.t - m.b);
    const tt = ease(st.t), A = METRICS[st.from], B = METRICS[st.k];
    const py = q => lerp(pyk(A, q.v[A.key]), pyk(B, q.v[B.key]), tt);
    return { m, px, py, pyk, narrow };
  }
  function draw() {
    const p = reduce ? 1 : cp;
    const [w, h] = fitCanvas(canvas), ctx = canvas.getContext('2d'), d = DPR();
    const g = geometry(w, h, d), { m, px, py, pyk } = g, k = METRICS[st.k];
    last = { p, geo: g };
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round';
    const ax = ease(seg(p, 0, 0.08)), tt = ease(st.t);
    [[METRICS[st.from], 1 - tt], [k, tt]].forEach(([K, a]) => {
      if (a <= 0 || (K === k && st.from === st.k && a < 1)) return;
      ctx.globalAlpha = ax * a;
      ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 1 * d;
      const gl = K.log ? K.ticks : (() => { const a = []; for (let e = K.Y[0] + K.grid; e <= K.Y[1] + 1e-6; e += K.grid) if (!(e % (K.grid * 2) && K.grid < 20)) a.push(e); return a; })();
      gl.forEach(e => { ctx.beginPath(); ctx.moveTo(m.l, pyk(K, e)); ctx.lineTo(lerp(m.l, w - m.r, ax), pyk(K, e)); ctx.stroke(); });
      ctx.fillStyle = '#86868b'; ctx.textAlign = 'right'; ctx.font = `500 ${12 * d}px ${FONT}`;
      K.ticks.forEach(e => ctx.fillText(`${e}`, m.l - 8 * d, pyk(K, e) + 4 * d));
      ctx.fillStyle = '#a1a1a6'; ctx.font = `600 ${12.5 * d}px ${FONT}`; ctx.textAlign = 'left';
      ctx.fillText(`${g.narrow ? K.axis.replace(' in the wild', '') : K.axis}, lower is better ↑`, m.l, g.narrow ? 16 * d : m.t - 14 * d);
    });
    ctx.globalAlpha = ax;
    ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 1 * d;
    [1, 2, 5, 10, 20, 50, 100].forEach(f => { ctx.beginPath(); ctx.moveTo(px(f), h - m.b); ctx.lineTo(px(f), lerp(h - m.b, m.t, ax)); ctx.stroke(); });
    ctx.fillStyle = '#86868b'; ctx.font = `500 ${12 * d}px ${FONT}`; ctx.textAlign = 'center';
    [1, 2, 5, 10, 20, 50, 100].forEach(f => ctx.fillText(`${f}`, px(f), h - m.b + 18 * d));
    ctx.fillStyle = '#a1a1a6'; ctx.font = `600 ${12.5 * d}px ${FONT}`;
    ctx.textAlign = 'right'; ctx.fillText('Speed (FPS, log scale), faster →', w - m.r, h - m.b + 38 * d);
    ctx.globalAlpha = 1;

    const best = k.best;
    const steady = st.t >= 1 ? 1 : 0;
    const LABELED = new Set([ours.id, v1.id, best.id, ...(g.narrow ? [] : ['handdgp', ...(k.key === 'Jitter' ? [] : ['ace_ego_hand'])])]);
    const dot = (q, a, fade = 1) => {
      if (a <= 0) return;
      const pop = 1 + 0.5 * Math.sin(Math.PI * clamp(a * 1.2));
      const col = q.ours ? '#39ab38' : PAL(q.name), r = (q.ours ? 9 : 6) * d * (a < 1 ? pop : 1) * (hover === q ? 1.35 : 1);
      const x = px(q.fps), y = py(q);
      if (q.ours && a < 1) { ctx.strokeStyle = `rgba(57,171,56,${(1 - a).toFixed(3)})`; ctx.lineWidth = 2 * d; ctx.beginPath(); ctx.arc(x, y, lerp(10, 70, a) * d, 0, 7); ctx.stroke(); }
      ctx.globalAlpha = clamp(a * 2) * fade;
      if (q.ours) { ctx.save(); ctx.shadowColor = '#39ab38'; ctx.shadowBlur = 28 * d; }
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x, y, r + 2 * d, 0, 7); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      if (q.ours) ctx.restore();
      if ((LABELED.has(q.id) && steady) || hover === q || q.ours) labelQ.push(() => {
        ctx.globalAlpha = clamp(a * 2) * fade;
        ctx.font = `${q.ours ? 700 : 600} ${(q.ours ? 15 : 12.5) * d}px ${FONT}`;
        ctx.fillStyle = q.ours ? '#f5f5f7' : '#d2d2d7';
        const ft = ctx.fillText.bind(ctx); ctx.fillText = (t, x, y) => { ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 4 * d; ctx.lineJoin = 'round'; ctx.strokeText(t, x, y); ctx.restore(); ft(t, x, y); };
        if (q.ours) { ctx.textAlign = 'center'; ctx.fillText(q.name, x, y - r - 12 * d); }
        else if (q === best && k.gain < 20 && g.narrow) { }
        else if (q === best && k.gain < 20) { ctx.textAlign = 'right'; ctx.fillText(q.name, x - r - 10 * d, y + 4 * d); }
        else if (q === best) { ctx.textAlign = 'center'; ctx.fillText(q.name, x, g.narrow ? y + r + 16 * d : y - r - 8 * d); }
        else if (q.v1 && g.narrow) { ctx.textAlign = 'center'; ctx.fillText(q.name, x, y + r + 16 * d); }
        else {
          const right = x > w * 0.72; ctx.textAlign = right ? 'right' : 'left';
          ctx.fillText(q.name, right ? x - r - 8 * d : x + r + 8 * d, y + 4 * d);
        }
        ctx.fillText = ft;
        ctx.globalAlpha = 1;
      });
      ctx.globalAlpha = 1;
    };
    const labelQ = [];
    ctx.textBaseline = 'alphabetic';
    const recede = 1 - 0.55 * seg(p, 0.88, 1);
    base.forEach(q => dot(q, seg(p, q.t0, q.t0 + 0.05), hover === q || q === v1 || q === k.best ? 1 : recede));
    dot(ours, seg(p, ours.t0, ours.t0 + 0.1));
    labelQ.forEach(f => f());
    const gGap = ease(seg(p, 0.5, 0.64)) * steady, gSpd = ease(seg(p, 0.72, 0.88)) * steady;
    if (k.best === v1) { }
    else if (gGap > 0 && k.gain < 20) {
      ctx.globalAlpha = gGap; ctx.fillStyle = '#39ab38'; ctx.font = `700 ${(g.narrow ? 13 : 16) * d}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.fillText(`Lowest of all ${pts.length}`, px(ours.fps), py(ours) + 32 * d); ctx.globalAlpha = 1;
    } else if (gGap > 0) {
      const x = px(ours.fps), y0 = py(best), yo = py(ours) + 13 * d, x0 = px(best.fps) + 9 * d;
      ctx.strokeStyle = '#39ab38'; ctx.fillStyle = '#39ab38'; ctx.lineWidth = 2 * d; ctx.setLineDash([4 * d, 4 * d]);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(lerp(x0, x, Math.min(1, gGap * 2)), y0); ctx.stroke(); ctx.setLineDash([]);
      if (gGap > 0.5) {
        const t = (gGap - 0.5) * 2, ya = lerp(y0, yo, t);
        ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, ya); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y0, 3 * d, 0, 7); ctx.fill();
        if (t > 0.9) { ctx.beginPath(); ctx.moveTo(x - 5 * d, ya + 7 * d); ctx.lineTo(x, ya); ctx.lineTo(x + 5 * d, ya + 7 * d); ctx.stroke(); }
        ctx.globalAlpha = seg(t, 0.5, 1); ctx.font = `700 ${(g.narrow ? 15 : 20) * d}px ${FONT}`;
        const gl = k.ratio ? `${k.x}× fewer` : `−${k.gain}%`, room = w - (x + 12 * d) > ctx.measureText(gl).width + 4 * d;
        ctx.textAlign = room ? 'left' : 'right'; ctx.fillText(gl, room ? x + 12 * d : x - 12 * d, (y0 + yo) / 2 + 7 * d); ctx.globalAlpha = 1;
      }
    }
    if (gSpd > 0) {
      const A = [px(v1.fps), py(v1)], B = [px(ours.fps), py(ours)];
      const C = [lerp(A[0], B[0], 0.4), lerp(A[1], B[1], 0.6)];
      const P = t => [(1 - t) * (1 - t) * A[0] + 2 * (1 - t) * t * C[0] + t * t * B[0], (1 - t) * (1 - t) * A[1] + 2 * (1 - t) * t * C[1] + t * t * B[1]];
      let tEnd = 1; while (tEnd > 0.5 && Math.hypot(P(tEnd)[0] - B[0], P(tEnd)[1] - B[1]) < 15 * d) tEnd -= 0.005;
      const t1 = lerp(0.06, tEnd, gSpd);
      ctx.strokeStyle = '#ba81c3'; ctx.lineWidth = 2 * d; ctx.setLineDash([5 * d, 5 * d]); ctx.beginPath();
      for (let i = 0; i <= 40; i++) { const q = P(lerp(0.06, t1, i / 40)); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
      ctx.stroke(); ctx.setLineDash([]);
      const E = P(t1), F = P(t1 - 0.02), ang = Math.atan2(E[1] - F[1], E[0] - F[0]);
      ctx.fillStyle = '#ba81c3'; ctx.beginPath(); ctx.moveTo(E[0], E[1]);
      ctx.lineTo(E[0] - 11 * d * Math.cos(ang - 0.4), E[1] - 11 * d * Math.sin(ang - 0.4)); ctx.lineTo(E[0] - 11 * d * Math.cos(ang + 0.4), E[1] - 11 * d * Math.sin(ang + 0.4)); ctx.fill();
      ctx.globalAlpha = seg(gSpd, 0.6, 1); ctx.font = `700 ${(g.narrow ? 14 : 19) * d}px ${FONT}`; ctx.textAlign = 'center';
      const L = P(0.3), txt = k.ratio ? `${speed}× faster, ${k.v1x}× fewer ${k.short}` : `${speed}× faster, −${k.v1gain}% ${k.short}`, tw = ctx.measureText(txt).width, fh = (g.narrow ? 14 : 19) * d;
      const lx = clamp(L[0], m.l + tw / 2 + 10 * d, w - m.r - tw / 2 - 10 * d), ly = Math.max(L[1] - 18 * d, m.t + fh);
      ctx.fillStyle = 'rgba(0,0,0,0.82)'; ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(lx - tw / 2 - 10 * d, ly - fh, tw + 20 * d, fh + 12 * d, 8 * d) : ctx.rect(lx - tw / 2 - 10 * d, ly - fh, tw + 20 * d, fh + 12 * d); ctx.fill();
      ctx.fillStyle = '#ba81c3'; ctx.fillText(txt, lx, ly); ctx.globalAlpha = 1;
    }

    windowed(caps.slice(0, 3), [[0, 0.35], [0.35, 0.5], [0.5, 1]], p, 0.05, 12);
    { const o = smooth(seg(p, 0.72, 0.8)); caps[3].style.opacity = o.toFixed(3); caps[3].style.transform = `translate3d(0, ${((1 - o) * 12).toFixed(1)}px, 0)`; }
  }
  stage.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect(), d = DPR(), g = last.geo; if (!g) return;
    const mx = (e.clientX - r.left) * d, my = (e.clientY - r.top) * d, k = METRICS[st.k];
    let bestQ = null, bd = 24 * d;
    pts.forEach(q => { if (last.p < q.t0 + 0.02) return; const dd = Math.hypot(g.px(q.fps) - mx, g.py(q) - my); if (dd < bd) { bd = dd; bestQ = q; } });
    if (bestQ !== hover) { hover = bestQ; draw(); }
    if (hover) {
      tip.hidden = false;
      tip.innerHTML = `<b>${hover.name}</b>${hover.venue ? `<span>${hover.venue}</span>` : ''}<div>${k.ratio ? k.fmt(hover.v[k.key]) : `${hover.v[k.key].toFixed(k.dec)} ${k.unit}`} · ${hover.fps.toFixed(1)} FPS</div>`;
      const tx = g.px(hover.fps) / d, ty = g.py(hover) / d;
      tip.style.left = `${clamp(tx, 90, r.width - 90)}px`; tip.style.top = `${ty}px`;
      tip.classList.toggle('below', ty < 80);
    } else tip.hidden = true;
  });
  stage.addEventListener('pointerleave', e => { if (e.pointerType !== 'mouse') return; hover = null; tip.hidden = true; draw(); });
  stage.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') stage.dispatchEvent(new PointerEvent('pointermove', { clientX: e.clientX, clientY: e.clientY, bubbles: true })); });
  let cp = 0;
  new IntersectionObserver((es, io) => es.forEach(e => {
    if (!e.isIntersecting) return; io.disconnect();
    const t0 = performance.now();
    (function run(now) { cp = clamp((now - t0) / 6500); draw(); if (cp < 1) requestAnimationFrame(run); })(t0);
  }), { threshold: 0.45 }).observe(stage);
  addEventListener('resize', draw);
  draw();
})();
