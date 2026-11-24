'use strict';
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const L2 = (A, B, t) => [lerp(A[0], B[0], t), lerp(A[1], B[1], t)];
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const smooth = t => t * t * (3 - 2 * t);
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const DPR = () => Math.min(2, window.devicePixelRatio || 1);
  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const FONT = '-apple-system, BlinkMacSystemFont, Inter, "Segoe UI", sans-serif';
  const LOAD = window.VDH_LOAD;
  const MQ_DESK = matchMedia('(min-aspect-ratio: 11/10) and (min-width: 901px)'), MQ_LAND = matchMedia('(min-aspect-ratio: 11/10) and (max-width: 900px)');
  const modeNow = () => (MQ_DESK.matches ? 'desk' : MQ_LAND.matches ? 'land' : 'port');
  const C = { white: '#f5f5f7', axis: '#8e8e93', green: '#39ab38', red: '#ff6b5e', blue: '#5ac8fa', mute: '#a1a1a6' };
  const rgbOf = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const A = rgbOf(a), B = rgbOf(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp(t)))).join(',')})`; };
  const relaxCol = m => (m < 0.5 ? mix(C.red, '#d8d8dc', smooth(m / 0.5)) : mix('#d8d8dc', C.green, smooth((m - 0.5) / 0.5)));
  const ratioCol = r => (r < 1 ? mix(C.blue, C.white, (r - 0.8) / 0.2) : mix(C.white, C.red, (r - 1) / 0.25));
  const amber = a => `rgba(255,179,64,${a})`;
  const rrect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); };
  const relRect = (el, to) => { const a = el.getBoundingClientRect(), b = to.getBoundingClientRect(); return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height }; };

  function stepper(pin, stage, n, api) {
    const S = { s: 0, target: 0, top: 0, pitch: 1, drawn: NaN, gliding: false, goal: -1 };
    const root = document.documentElement;
    let run = false, vw = innerWidth, vh = innerHeight;
    function measure() {
      const nav = parseFloat(getComputedStyle(stage).top) || 0;
      S.pitch = Math.max(40, Math.round(api.resize()));
      const h = `${stage.offsetHeight + (n - 1) * S.pitch}px`; if (pin.style.height !== h) pin.style.height = h;
      S.top = Math.round(pin.getBoundingClientRect().top + scrollY - nav);
      S.drawn = NaN;
    }
    const yOf = k => S.top + k * S.pitch;
    const raw = () => { const r = (scrollY - S.top) / S.pitch, k = Math.round(r); return Math.abs(r - k) * S.pitch < 0.75 ? k : r; };
    const aim = () => clamp(raw(), -1, n);
    const onScreen = () => { const r = pin.getBoundingClientRect(); return r.bottom > -40 && r.top < innerHeight + 40; };
    const draw = () => { if (S.s !== S.drawn && onScreen()) { api.render(S.s); S.drawn = S.s; } };
    function frame() {
      run = false;
      S.s = S.target;
      draw();
    }
    function kick() {
      S.target = aim();
      if (!run) { run = true; requestAnimationFrame(frame); }
    }
    let anim = 0, idleT = 0, releasedTouch = false;
    function stop() { if (!S.gliding) return; anim++; S.gliding = false; S.goal = -1; root.style.scrollBehavior = ''; }
    function glide(k, dur) {
      const to = yOf(k), y0 = scrollY; stop(); clearTimeout(idleT);
      if (Math.abs(to - y0) < 1) return;
      root.style.scrollBehavior = 'auto';
      if (!(dur > 0)) { scrollTo(0, to); root.style.scrollBehavior = ''; return; }
      const id = ++anim, t0 = performance.now(); let lastY = y0; S.gliding = true; S.goal = k;
      (function f(now) {
        if (id !== anim) return;
        if (Math.abs(scrollY - lastY) > 2) { stop(); arm(); return; }
        const t = clamp((now - t0) / dur), e = t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
        scrollTo(0, y0 + (to - y0) * e); lastY = scrollY;
        if (t < 1) requestAnimationFrame(f); else stop();
      })(t0);
    }
    function cancelInput() {
      releasedTouch = false;
      clearTimeout(idleT);
      stop();
    }
    function arm() {
      clearTimeout(idleT);
      if (!releasedTouch || reduce) return;
      idleT = setTimeout(() => {
        releasedTouch = false;
        const r = raw();
        if (r > 0 && r < n - 1) glide(Math.round(r), 220);
      }, 250);
    }
    addEventListener('scroll', () => { kick(); if (releasedTouch) arm(); }, { passive: true });
    addEventListener('wheel', cancelInput, { passive: true });
    addEventListener('touchstart', cancelInput, { passive: true });
    addEventListener('touchcancel', cancelInput, { passive: true });
    addEventListener('touchend', e => {
      if (!e.touches.length && pin.contains(e.target)) { releasedTouch = true; arm(); }
    }, { passive: true });
    addEventListener('mousedown', cancelInput, true);
    addEventListener('keydown', e => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target, tag = t && t.tagName;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (e.key === ' ' && /^(BUTTON|A|SUMMARY|VIDEO)$/.test(tag)))) return;
      const d = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1, ' ': e.shiftKey ? -1 : 1 }[e.key];
      if (!d) { if (/^(Home|End)$/.test(e.key)) { stop(); clearTimeout(idleT); } return; }
      const r = S.gliding ? S.goal : raw();
      if (r < -0.01 || r > n - 1 + 0.01) return;
      const k = d > 0 ? Math.floor(r + 1e-3) + 1 : Math.ceil(r - 1e-3) - 1;
      if (k < 0 || k > n - 1) { stop(); return; }
      e.preventDefault(); cancelInput(); glide(k, 360);
    });
    const remeasure = () => { measure(); kick(); draw(); };
    addEventListener('resize', () => { if (innerWidth !== vw || Math.abs(innerHeight - vh) > 120) { vw = innerWidth; vh = innerHeight; remeasure(); } });
    addEventListener('orientationchange', () => requestAnimationFrame(() => { vw = innerWidth; vh = innerHeight; remeasure(); }));
    addEventListener('load', remeasure);
    const coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
    if (window.ResizeObserver) { let bh = 0; const ro = new ResizeObserver(() => { const h = document.body.offsetHeight; if (h === bh) return; bh = h;
      if (coarse && innerWidth === vw && innerHeight !== vh && Math.abs(innerHeight - vh) <= 120) return; remeasure(); }); ro.observe(document.body); }
    measure(); S.s = S.target = aim(); draw();
    S.redraw = () => { S.drawn = NaN; draw(); };
    S.go = (k, dur) => glide(clamp(k, 0, n - 1), dur === undefined ? clamp(260 + 0.3 * Math.abs(yOf(k) - scrollY), 300, 900) : dur);
    return S;
  }

  function capsByScroll(caps, s) {
    caps.forEach(({el, h3, p}, k) => {
      const distance = k - clamp(s, 0, caps.length - 1);
      const weight = clamp(1 - Math.abs(distance));
      el.style.visibility = Math.abs(distance) <= 1.5 ? 'visible' : 'hidden';
      h3.style.opacity = (0.50 + 0.50 * weight).toFixed(3);
      p.style.opacity = (0.27 + 0.73 * weight).toFixed(3);
    });
  }
  function noOrphans(els) {
    els.forEach(el => $$('h3, p', el).forEach(blk => {
      const tw = document.createTreeWalker(blk, NodeFilter.SHOW_TEXT), nodes = []; while (tw.nextNode()) nodes.push(tw.currentNode);
      for (let i = nodes.length - 1; i >= 0; i--) { const t = nodes[i].nodeValue, k = t.trimEnd().lastIndexOf(' '); if (k > 0) { nodes[i].nodeValue = t.slice(0, k) + ' ' + t.slice(k + 1); return; } if (t.trim()) continue; }
    }));
  }
  function fitCaptions(slot, els, mode, fitH) {
    els.forEach(el => { el.style.fontSize = ''; const h = $('h3', el), p = $('p', el); if (h) h.style.fontSize = ''; if (p) p.style.fontSize = ''; });
    if (mode !== 'desk') {
      const steps = mode === 'land' ? [[19, 13.5], [18, 13], [17, 13], [16, 13]] : slot.clientWidth >= 600 ? [[36, 19], [32, 18], [30, 17], [28, 16], [26, 16]] : [[24, 15], [23, 14.5], [22, 14], [20, 14], [19, 13.5], [18, 13]];
      els.forEach(el => {
        const h = $('h3', el), p = $('p', el);
        for (const [hs, ps] of steps) { if (el.offsetHeight <= fitH) break; if (h) h.style.fontSize = hs + 'px'; if (p) p.style.fontSize = ps + 'px'; }
      });
    }
    return Math.max(...els.map(e => e.offsetHeight));
  }

  function labeller(ctx, Lyt, reserved) {
    const placed = reserved.slice();
    const ovl = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const f = o => {
      const alpha = o.alpha == null ? 1 : o.alpha; if (alpha <= 0.01) return null;
      const size = Math.max(13, o.size || Lyt.fs), plate = o.plate !== false, pad = plate ? 7 : 1;
      ctx.font = `${o.weight || 600} ${size}px ${FONT}`;
      const tw = ctx.measureText(o.text).width, bw = tw + 2 * pad, bh = Math.round(size * 1.3) + (plate ? 4 : 0);
      const A = o.anchor || [o.x, o.y], cands = o.cands || [[0, 0]];
      let best = null, bestO = Infinity;
      for (const [dx, dy] of cands) {
        const cx = A[0] + dx, cy = A[1] + dy;
        const r = { x: o.align === 'left' ? cx : o.align === 'right' ? cx - bw : cx - bw / 2, y: cy - bh / 2, w: bw, h: bh };
        r.x = clamp(r.x, 6, Lyt.W - 6 - bw); r.y = clamp(r.y, Lyt.safeTop, Lyt.H - 12 - bh);
        const ov = placed.reduce((s, q) => s + ovl(r, q), 0);
        if (ov === 0) { best = r; break; }
        if (ov < bestO) { bestO = ov; best = r; }
      }
      placed.push(best);
      ctx.globalAlpha = alpha;
      if (o.anchor && o.leader !== false) {
        const nx = clamp(A[0], best.x, best.x + best.w), ny = clamp(A[1], best.y, best.y + best.h);
        if (Math.hypot(nx - A[0], ny - A[1]) > 10) {
          ctx.strokeStyle = o.color; ctx.globalAlpha = alpha * 0.7; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(nx, ny); ctx.stroke();
          ctx.globalAlpha = alpha; ctx.fillStyle = o.color; ctx.beginPath(); ctx.arc(A[0], A[1], 2.2, 0, 7); ctx.fill();
        }
      }
      if (plate) { ctx.fillStyle = 'rgba(0,0,0,0.66)'; rrect(ctx, best.x, best.y, best.w, best.h, 7); ctx.fill(); }
      ctx.fillStyle = o.color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(o.text, best.x + pad, best.y + best.h / 2 + 0.5);
      ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
      return best;
    };
    const ticks = [], tickR = new Set();
    f.text = (text, x, y, { size = 13, weight = 500, color = C.axis, align = 'center', alpha = 1 } = {}) => {
      if (alpha <= 0.01) return null;
      ctx.font = `${weight} ${size}px ${FONT}`; const w = ctx.measureText(text).width, h = Math.round(size * 1.2);
      const r = { x: align === 'left' ? x : align === 'right' ? x - w : x - w / 2, y: y - h / 2, w, h };
      if (r.y < Lyt.safeTop || r.y + r.h > Lyt.H - 4 || r.x < 2 || r.x + r.w > Lyt.W - 2) return null;
      placed.push(r); tickR.add(r); ticks.push({ r, text, y, size, weight, color, alpha });
      return r;
    };
    f.flush = () => {
      for (const t of ticks) {
        if (placed.some(q => q !== t.r && !tickR.has(q) && ovl(t.r, q) > 0)) continue;
        ctx.font = `${t.weight} ${t.size}px ${FONT}`; ctx.globalAlpha = t.alpha; ctx.fillStyle = t.color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(t.text, t.r.x, t.y + 0.5); ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
      }
      ticks.length = 0;
    };
        return f;
  }

  (function insight() {
    const sec = $('#st-idea.v2'), D = window.VIDIHAND_LIFT; if (!sec || !D) return;
    const pin = $('.ins-pin', sec), stage = $('.ins-stage', sec), view = $('.ins-view', sec), canvas = $('canvas', view);
    const photoBox = $('.ins-photo', sec), photo = $('.ins-photo img', sec), slot = $('.ins-cap', sec), caps = $$('.ins-c', slot);
    const scrims = $$('.ins-scrim, .ins-scrim-top', sec);
    const bar = $('.ins-chap', sec);
    const modOf = k => (window[k] && typeof window[k].render === 'function' ? window[k] : null);
    const FU = modOf('VDH_INSIGHT_FUSION'), AR = modOf('VDH_INSIGHT_AR');
    sec.classList.toggle('has-fu', !!FU); sec.classList.toggle('has-ar', !!AR);
    const LEN = { A: 288, F: FU ? 300 : 0, B: FU ? 180 : 192, R: AR ? 220 : 0 }, TOT = LEN.A + LEN.F + LEN.B + LEN.R;
    const PA = LEN.A / TOT, PF = PA + LEN.F / TOT, PB = PF + LEN.B / TOT, PB0 = FU ? 0.625 : 0.60, FX = FU ? FU.end || 0.93 : 1;
    const split = P => {
      if (P <= PA) return { p: 0.60 * P / PA, f: 0, q: 0 };
      if (FU && P < PF) { const f = (P - PA) / (PF - PA); return { p: 0.60 + 0.025 * seg(f, FX, 1), f, q: 0 }; }
      if (!AR || P <= PB) return { p: lerp(PB0, 1, clamp((P - PF) / (PB - PF))), f: 1, q: 0 };
      return { p: 1, f: 1, q: (P - PB) / (1 - PB) };
    };
    const Pmain = p => (p <= 0.60 ? PA * p / 0.60 : PF + (PB - PF) * clamp((p - PB0) / (1 - PB0))), Pfu = f => PA + (PF - PA) * f, Par = q => PB + (1 - PB) * q;
    const isM = e => !e.classList.contains('fu') && !e.classList.contains('ar'), capsM = caps.filter(isM), capsF = caps.filter(e => e.classList.contains('fu')), capsR = caps.filter(e => e.classList.contains('ar'));
    const ORDER = [...capsM.slice(0, 4), ...(FU ? capsF : []), ...capsM.slice(4), ...(AR ? capsR : [])];
    caps.filter(e => !ORDER.includes(e)).forEach(el => { el.style.display = 'none'; });
    const chapEls = $$('button', bar).filter(b => (FU || !b.classList.contains('ins-chap-fu')) && (AR || !b.classList.contains('ins-chap-ar')));
    const NAMES = chapEls.map(b => [b.textContent.trim(), b.dataset.short || b.textContent.trim()]);
    const iFU = FU ? 2 : -1, iC = FU ? 3 : 2, iAR = AR ? iC + 1 : -1;
    const CAPCH = [0, 1, 1, 1, ...(FU ? capsF.map(() => iFU) : []), iC, iC, ...(AR ? capsR.map(() => iAR) : [])];
    const CAP0 = chapEls.map((_, i) => CAPCH.indexOf(i)), NSEG = chapEls.map((_, i) => CAPCH.filter(c => c === i).length);
    const segEls = chapEls.map((el, i) => {
      $$('i, .ins-segs', el).forEach(e => e.remove());
      const box = document.createElement('span'); box.className = 'ins-segs'; box.setAttribute('aria-hidden', 'true');
      for (let k = 0; k < NSEG[i]; k++) box.appendChild(document.createElement('i'));
      el.appendChild(box); return [...box.children];
    });
    const N = ORDER.length;
    const REST = [...[0.10, 0.22, 0.40, 0.60].map(Pmain), ...(FU ? (FU.holds || [1]).slice(0, capsF.length).map(Pfu) : []), ...[0.78, 0.94].map(Pmain), ...(AR ? (AR.holds || [1]).slice(0, capsR.length).map(Par) : [])];
    while (REST.length < N) REST.push(1);
    const Pof = s => { if (s <= -1) return 0; if (s < 0) return REST[0] * (s + 1); if (s >= N - 1) return REST[N - 1]; const k = Math.floor(s); return lerp(REST[k], REST[k + 1], s - k); };
    noOrphans(ORDER);
    const CAPS = ORDER.map(el => ({ el, h3: $('h3', el), p: $('p', el) }));
    const flow = document.createElement('div');
    flow.className = 'ins-flow';
    pin.appendChild(flow);
    flow.append(...ORDER);

    chapEls.forEach((el, i) => el.addEventListener('click', () => {
      if (!ctl) return; ctl.go(CAP0[i] + (i === lastCi ? (lastStep + 1) % NSEG[i] : 0));
    }));
    LOAD.image(40, sec, photo, 'assets/img/method/lift_frame.jpg');
    photo.addEventListener('load', () => ctl && ctl.redraw());

    const PAR = D.parents, BONES = PAR.map((p, j) => [j, p]).slice(1);
    const ray = (uv, I) => [(uv[0] - I[2]) / I[0], (uv[1] - I[3]) / I[1], 1];
    const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const handAt = (read, rel, I, z) => read.map((uv, j) => { const q = ray(uv, I), dz = rel[j][2] - rel[0][2]; return q.map(v => v * (z + dz)); });
    const Lm = BONES.map(([c, p]) => len(D.rel[c], D.rel[p]));
    const Z = D.z, ZF = D.z_frame_f, IP = 0.28 * Z;
    const Q = D.read.map(uv => ray(uv, D.intr)), Q0 = Q[0], DZ = D.rel.map(r => r[2] - D.rel[0][2]);
    const plane = (u, v) => ray([u * D.W, v * D.H], D.intr).map(x => x * IP);
    const CORN = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => plane(u, v));
    const handZ = z => handAt(D.read, D.rel, D.intr, z);
    const VOTES = BONES.map(([c, p], b) => {
      const dq = [0, 1, 2].map(i => Q[c][i] - Q[p][i]), e = [0, 1, 2].map(i => DZ[c] * Q[c][i] - DZ[p] * Q[p][i]);
      const qa = dq[0] ** 2 + dq[1] ** 2 + dq[2] ** 2, qb = dq[0] * e[0] + dq[1] * e[1] + dq[2] * e[2], qc = e[0] ** 2 + e[1] ** 2 + e[2] ** 2 - Lm[b] ** 2;
      const disc = qb * qb - qa * qc; return disc >= 0 ? (-qb + Math.sqrt(disc)) / qa : NaN;
    });
    const VALID = BONES.map((_, b) => b).filter(b => Number.isFinite(VOTES[b])).sort((a, b) => Lm[b] - Lm[a]);
    const sqL = VALID.map(b => Math.sqrt(Lm[b])), sqMin = Math.min(...sqL), sqMax = Math.max(...sqL);
    const rad01 = b => (Math.sqrt(Lm[b]) - sqMin) / Math.max(1e-9, sqMax - sqMin);
    const dev = VALID.map(b => Math.abs(VOTES[b] - ZF)).sort((a, b) => a - b), MAD = dev[dev.length >> 1], HK = 1.345 * 1.4826 * MAD;
    const WGT = b => Math.min(1, HK / Math.max(1e-9, Math.abs(VOTES[b] - ZF)));
    const PALM = BONES.map(([, pp], b) => (pp === 0 ? b : -1)).filter(b => b >= 0);
    const medR = z => { const J = handZ(z); return PALM.reduce((s, b) => s + len(J[BONES[b][0]], J[BONES[b][1]]) / Lm[b], 0) / PALM.length; };
    const solveR = t => { let lo = 0.2, hi = 2; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; medR(m) < t ? (lo = m) : (hi = m); } return lo; };
    const ZSTAR = solveR(1), BAND = [solveR(0.95), solveR(1.05)];
    const NW = D.win.n, K0 = D.frame - D.win.start, RF = D.win.root_frame, RC = D.win.root;
    const okW = i => RF[i].every(Number.isFinite) && RC[i].every(Number.isFinite);
    const zfA = RF.map(q => q[2]), zcA = RC.map(q => q[2]);
    const onRays = (i, z) => handAt(D.win.read[i], D.win.rel[i], D.win.intr[i], z);
    const LmW = D.win.rel.map(r => BONES.map(([c, p]) => len(r[c], r[p])));
    const rootAt = (i, m) => RF[i].map((v, c) => lerp(v, RC[i][c], m));
    function terms(m) {
      let bone = 0, nb = 0, rep = 0, nr = 0; const zs = [];
      for (let i = 0; i < NW; i++) {
        if (!okW(i)) continue;
        const R = rootAt(i, m), X = onRays(i, R[2]), I = D.win.intr[i], rel = D.win.rel[i];
        BONES.forEach(([c, p], b) => { bone += Math.abs(len(X[c], X[p]) / LmW[i][b] - 1); nb++; });
        rel.forEach((q, j) => { const Y = q.map((v, c) => v - rel[0][c] + R[c]); rep += Math.hypot(I[0] * Y[0] / Y[2] + I[2] - D.win.read[i][j][0], I[1] * Y[1] / Y[2] + I[3] - D.win.read[i][j][1]); nr++; });
        zs.push(R[2]);
      }
      let tmp = 0; for (let i = 2; i < zs.length; i++) tmp += Math.abs(zs[i] - 2 * zs[i - 1] + zs[i - 2]);
      return { bone: 100 * bone / nb, rep: rep / nr, tmp: 1000 * tmp / Math.max(1, zs.length - 2) };
    }
    const T0 = terms(0), T1 = terms(1);
    let tmK = NaN, tmV = null; const termsAt = m => { const k = Math.round(m * 2000) / 2000; if (k !== tmK) { tmK = k; tmV = terms(k); } return tmV; };
    const UPX = (() => { const up = X => Math.max(...X.map(P => (P[2] - X[0][2]) + 0.03 * Math.abs(P[0] - X[0][0]) - 0.35 * (P[1] - X[0][1]))); let u = up(handZ(ZF));
      for (let i = 0; i < NW; i++) if (okW(i)) u = Math.max(u, up(onRays(i, zfA[i])), up(onRays(i, zcA[i]))); return 1.06 * u; })();
    const zAt = (i, m) => lerp(zfA[i], zcA[i], m);
    const d2 = (i, m) => (i >= 2 && okW(i) && okW(i - 1) && okW(i - 2) ? Math.abs(zAt(i, m) - 2 * zAt(i - 1, m) + zAt(i - 2, m)) : NaN);
    const D2MAX = Math.max(...Array.from({ length: NW }, (_, i) => d2(i, 0)).filter(Number.isFinite));
    let SPIKE = 1, JUMP = 0; for (let i = 1; i < NW; i++) if (okW(i) && okW(i - 1)) { const j = Math.abs(zfA[i] - zfA[i - 1]); if (j > JUMP) { JUMP = j; SPIKE = i; } }
    $$('[data-k]', sec).forEach(e => { const k = e.dataset.k; e.textContent = k === 'zf' ? (ZF * 100).toFixed(0) : k === 'jf' ? T0.tmp.toFixed(0) : k === 't1' ? T1.tmp.toFixed(1) : e.textContent; });

    const yawOf = p => 0.55 * ease(seg(p, 0.10, 0.17)) + 0.06 * seg(p, 0.17, 0.22) + 0.22 * ease(seg(p, 0.22, 0.25))
      + 0.03 * smooth(seg(p, 0.38, 0.40)) + 0.03 * smooth(seg(p, 0.57, 0.60)) + 0.04 * seg(p, 0.25, 0.60);
    const ZC = 0.5;
    function camera(p, zc) {
      const s = ease(seg(p, 0.10, 0.17)), yaw = yawOf(p), pitch = 0.16 * s + 0.08 * ease(seg(p, 0.22, 0.25)), dist = 1.15;
      const Cc = [Q0[0] * zc, Q0[1] * zc, zc];
      const eye1 = [Cc[0] + dist * Math.sin(yaw) * Math.cos(pitch), Cc[1] - dist * Math.sin(pitch), Cc[2] - dist * Math.cos(yaw) * Math.cos(pitch)];
      const eye = eye1.map(v => v * s), tgt = [0, 1, 2].map(i => lerp(i === 2 ? IP : 0, Cc[i], s));
      const f = tgt.map((v, i) => v - eye[i]); const fl = Math.hypot(...f); f.forEach((v, i) => (f[i] = v / fl));
      let r = [f[2], 0, -f[0]]; const rl = Math.hypot(...r); r = r.map(v => v / rl);
      const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
      return { s, raw: P => { const d = [P[0] - eye[0], P[1] - eye[1], P[2] - eye[2]]; const z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
        return [(d[0] * r[0] + d[1] * r[1] + d[2] * r[2]) / z, -(d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / z, z]; } };
    }
    function fitTo(raw, pts, box) {
      const B = pts.map(raw).filter(q => q[2] > 1e-3 && Number.isFinite(q[0]));
      const xs = B.map(q => q[0]), ys = B.map(q => q[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const foc = Math.min(box.w / Math.max(1e-6, x1 - x0), box.h / Math.max(1e-6, y1 - y0));
      return { foc, ox: box.x + box.w / 2 - foc * (x0 + x1) / 2, oy: box.y + box.h / 2 - foc * (y0 + y1) / 2 };
    }
    const blendF = (A, B, t) => (t <= 0 ? A : t >= 1 ? B : { foc: lerp(A.foc, B.foc, t), ox: lerp(A.ox, B.ox, t), oy: lerp(A.oy, B.oy, t) });
    function coverF(raw, box, zoom, aim) {
      const cs = CORN.map(raw), xs = cs.map(q => q[0]), ys = cs.map(q => q[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const hb = D.read.map(uv => raw(ray(uv, D.intr).map(v => v * IP)));
      const hx = (Math.min(...hb.map(q => q[0])) + Math.max(...hb.map(q => q[0]))) / 2, hy = (Math.min(...hb.map(q => q[1])) + Math.max(...hb.map(q => q[1]))) / 2;
      const foc = Math.max(box.w / (x1 - x0), box.h / (y1 - y0)) * zoom;
      const ax = aim ? aim[0] : box.x + box.w / 2, ay = aim ? aim[1] : box.y + box.h / 2;
      const ox = clamp(ax - foc * hx, box.x + box.w - foc * x1, box.x - foc * x0), oy = clamp(ay - foc * hy, box.y + box.h - foc * y1, box.y - foc * y0);
      return { foc, ox, oy };
    }
    const PTS_R = [[0, 0, 0], ...CORN, ...D.read.map(uv => ray(uv, D.intr).map(x => x * 0.75))];
    const ZNEAR = 0.45, ZFAR = 0.95;
    const atWrist = (H3, z0) => { const d = [0, 1, 2].map(i => Q0[i] * z0 - H3[0][i]); return H3.map(P => P.map((v, i) => v + d[i])); };
    const PTS_L1 = [...handZ(ZSTAR), ...atWrist(handZ(ZNEAR), ZSTAR), ...atWrist(handZ(ZFAR), ZSTAR)];
    const manoAt = z => D.rel.map(r => r.map((v, i) => v - D.rel[0][i] + Q0[i] * z));
    const PTS_L2 = [Q0.map(v => v * 0.44), Q0.map(v => v * 0.92), ...handZ(0.611)];

    function homography(P, w, h) {
      const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = P;
      const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
      let a, b, c, d, e, f, g, hh;
      if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) { a = x1 - x0; b = x2 - x1; c = x0; d = y1 - y0; e = y2 - y1; f = y0; g = 0; hh = 0; }
      else {
        const den = dx1 * dy2 - dx2 * dy1; g = (dx3 * dy2 - dx2 * dy3) / den; hh = (dx1 * dy3 - dx3 * dy1) / den;
        a = x1 - x0 + g * x1; b = x3 - x0 + hh * x3; c = x0; d = y1 - y0 + g * y1; e = y3 - y0 + hh * y3; f = y0;
      }
      return `matrix3d(${[a / w, d / w, 0, g / w, b / h, e / h, 0, hh / h, 0, 0, 1, 0, c, f, 0, 1].map(v => +v.toFixed(8)).join(',')})`;
    }

    let Lyt = null, pitch = 500;
    const ctx = canvas.getContext('2d');
    function resize() {
      const mode = modeNow();
      const sh = stage.clientHeight; let capH = 0;
      flow.style.left = slot.offsetLeft + 'px';
      flow.style.width = slot.clientWidth + 'px';
      if (mode === 'desk') {
        capH = fitCaptions(slot, ORDER, mode); pitch = Math.max(Math.round(0.44 * sh), capH + 48);
        const barB = relRect(bar, stage), top = barB.y + barB.h + 96;
        slot.style.setProperty('--cap-y', Math.round(clamp(sh - pitch - 84, top, Math.max(top, sh / 2 + 16 - capH / 2))) + 'px');
      } else {
        slot.style.removeProperty('--cap-y');
        const room = slot.clientHeight, peek = mode === 'port' && slot.clientWidth >= 600 ? 64 : 46; pitch = Math.max(120, room - peek); fitCaptions(slot, ORDER, mode, pitch - 18);
      }
      chapEls.forEach((el, i) => { el.firstChild.nodeValue = NAMES[i][0]; });
      if (mode === 'desk' && bar.scrollWidth > stage.clientWidth - 40) chapEls.forEach((el, i) => { el.firstChild.nodeValue = NAMES[i][1]; });
      const vr = view.getBoundingClientRect(), d = DPR(), W = vr.width, H = vr.height;
      const bw = Math.max(1, Math.round(W * d)), bh = Math.max(1, Math.round(H * d));
      if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
      const SW = stage.clientWidth, SH = stage.clientHeight, fs = clamp(SW / 110, 13, 17);
      const L = { mode, W, H, d, fs };
      const pct = (x, y, w, h) => ({ x: x * W, y: y * H, w: w * W, h: h * H });
      if (mode === 'desk') {
        const ch = relRect($('.ins-chap', sec), view); L.safeTop = ch.y + ch.h + 12;
        const win = relRect(slot, view), cap = { x: win.x, y: win.y + 28, w: win.w, h: capH };
        L.cap = { x: cap.x - 12, y: cap.y - 12, w: cap.w + 24, h: cap.h + 24 }; L.capBox = cap;
        L.peek = { x: cap.x - 12, y: cap.y + pitch - 14, w: cap.w + 24, h: Math.max(0, SH - (cap.y + pitch - 14)) };
        const capL = cap.x, capR = cap.x + cap.w, rE = W - Math.max(0.03 * W, capL * 0.6);
        L.boxJ = { x: 0, y: 0, w: W, h: H }; L.aimJ = [(capR + W) / 2, (L.safeTop + H) / 2]; L.zoomJ = 1.8;
        L.boxR = { x: Math.max(0.30 * W, capR + 32), y: L.safeTop, w: 0, h: 0.94 * H - L.safeTop }; L.boxR.w = W - Math.max(0.03 * W, capL * 0.3) - L.boxR.x;
        const lx = Math.max(0.34 * W, capL + 0.5 * cap.w);
        const l1x = Math.max(lx, capR + 0.06 * W);
        L.boxL = { x: l1x, y: L.safeTop + 10, w: rE - l1x, h: 0.80 * H - L.safeTop - 10 };
        const l2x = Math.max(lx, capR + Math.min(0.09 * W, 120));
        L.boxL2 = { x: l2x, y: L.safeTop + 24, w: rE - l2x - 140, h: 0.67 * H - L.safeTop - 24 };
        const pipH = Math.min(0.2 * SW * D.H / D.W, cap.y - 26 - (L.safeTop + 6));
        L.pip = { x: capL, y: L.safeTop + 6, w: pipH * D.W / D.H, h: pipH }; L.pipOff = pipH < 70;
        L.rulerOff = 0.08 * SH; L.panelRuler = null;
        const sideW = clamp(0.13 * W, 140, 210);
        L.side = { x: capR + 60, y: L.safeTop + 2 * fs, w: sideW, h: 0.62 * H - L.safeTop - 2 * fs };
        const cx0 = L.side.x + sideW + 44;
        L.chart = { x: cx0, y: L.safeTop + 2.2 * fs, w: rE - cx0, h: 0.57 * H - L.safeTop - 2.2 * fs };
        L.strip = { x: cx0, y: 0.57 * H + 2.4 * fs + 10, w: rE - cx0, h: 0.07 * H };
        L.energy = { x: cx0, y: 0.76 * H, w: rE - cx0, h: 0.18 * H, row: 28 };
        L.dot = [3.5, 8]; L.lw = 3.2;
      } else if (mode === 'land') {
        L.safeTop = 10; L.cap = null;
        L.boxJ = { x: 0, y: 0, w: W, h: H }; L.aimJ = [W / 2, H / 2]; L.zoomJ = 1.7; L.boxR = pct(0.03, 0.04, 0.94, 0.92);
        L.boxL = pct(0.04, 0.06, 0.92, 0.70); L.boxL2 = pct(0.04, 0.08, 0.66, 0.46);
        L.pip = { x: 8, y: 8, w: 0.22 * W, h: 0.22 * W * D.H / D.W };
        L.rulerOff = 0.09 * H; L.panelRuler = null;
        L.side = pct(0.02, 0.10, 0.28, 0.48);
        L.chart = { x: 0.40 * W, y: 10 + 1.6 * fs, w: 0.57 * W, h: 0.53 * H - 10 - 1.6 * fs };
        L.swap = true; const P = { x: 0.04 * W, y: 0.60 * H, w: 0.93 * W, h: H - 0.60 * H - 12 }, fsr = Math.max(13, fs - 2);
        L.strip = { x: L.chart.x, y: P.y + fsr + 10, w: L.chart.w, h: P.h - fsr - 14, lx: P.x };
        L.energy = { ...P, row: clamp(Math.floor((P.h - Math.max(13, fs - 1) - 28) / 3), 16, 30) };
        L.dot = [2.5, 5]; L.lw = 2.4;
      } else {
        const ipad = W >= 700;
        L.safeTop = 8; L.cap = null;
        const band = 0.62 * H;
        L.boxJ = { x: 0, y: 0, w: W, h: H }; L.aimJ = [W / 2, 0.45 * H]; L.zoomJ = 1.9;
        L.boxR = { x: 12, y: 10, w: W - 24, h: band - 20 };
        L.pip = { x: 10, y: 6, w: 0.3 * W, h: 0.3 * W * D.H / D.W };
        L.boxL = { x: 10, y: L.pip.h + 14, w: W - 20, h: H - L.pip.h - 14 - 4.2 * fs };
        L.boxL2 = { x: 10, y: L.pip.h * 0.55, w: W - 20, h: band - L.pip.h * 0.55 - 8 };
        L.rulerOff = 0; L.panelRuler = { x0: 22, x1: W - 30, y: band + 0.30 * (H - band) };
        L.side = { x: 6, y: 10 + 1.6 * fs, w: 0.34 * W - 12, h: band - 18 - 1.6 * fs };
        L.chart = { x: 0.34 * W + 30, y: 10 + 1.6 * fs, w: 0.66 * W - 40, h: band - 30 - 1.6 * fs };
        L.swap = true; const P = { x: 14, y: band + 10, w: W - 28, h: H - band - 18 }, fsr = Math.max(13, fs - 2);
        L.strip = { x: L.chart.x, y: P.y + fsr + 12, w: L.chart.w, h: Math.min(ipad ? 80 : 56, P.h - fsr - 16), lx: 14 };
        L.energy = { ...P, row: clamp(Math.floor((P.h - Math.max(13, fs - 1) - 28) / 3), 18, ipad ? 34 : 28) };
        L.dot = ipad ? [3, 6.5] : [2.5, 5]; L.lw = ipad ? 3 : 2.2;
      }
      Lyt = L;
      photo.style.width = (photo.naturalWidth || D.W) + 'px'; photo.style.height = (photo.naturalHeight || D.H) + 'px';
      const pad = parseFloat(getComputedStyle(slot).getPropertyValue('--cap-pad')) || 0;
      flow.style.top = (slot.offsetTop + pad) + 'px';
      flow.style.gridAutoRows = pitch + 'px';
      L.captionPad = pad;
      L.captionHeight = slot.clientHeight;
      flow.style.setProperty('--window-height', L.captionHeight + 'px');
      L.flowHeight = flow.offsetHeight;
      return pitch;
    }

    function depthL(p) {
      if (p < 0.25) return ZNEAR;
      if (p < 0.35) return ZNEAR * Math.pow(ZFAR / ZNEAR, seg(p, 0.25, 0.35));
      if (p < 0.38) return lerp(ZFAR, ZSTAR, ease(seg(p, 0.35, 0.38)));
      if (p < 0.50) return ZSTAR;
      return lerp(ZSTAR, ZF, ease(seg(p, 0.50, 0.54)));
    }
    function playhead(p) {
      if (p < 0.65) return K0;
      if (p < 0.665) return lerp(K0, 0, ease(seg(p, 0.65, 0.665)));
      if (p < 0.77) return lerp(0, NW - 1, seg(p, 0.665, 0.77));
      if (p < 0.78) return NW - 1;
      if (p < 0.80) return lerp(NW - 1, SPIKE, ease(seg(p, 0.78, 0.80)));
      if (p < 0.882) return SPIKE;
      { const t = seg(p, 0.882, 1); return t < 0.1 ? lerp(SPIKE, 0, ease(t / 0.1)) : lerp(0, NW - 1, (t - 0.1) / 0.9); }
    }

    let lastCi = -1, lastStep = -1, layer = null;
    function render(s) {
      const P = Pof(s), { p, f, q } = split(P), L = Lyt;
      { const k = (1 - smooth(seg(p, 0.10, 0.145))).toFixed(3); scrims.forEach(el => { if (el.style.opacity !== k) el.style.opacity = k; }); }
      capsByScroll(CAPS, s);
      const travel = clamp(s, 0, N - 1) * pitch;
      const windowTop = travel - L.captionPad;
      flow.style.setProperty('--window-top', windowTop + 'px');
      flow.style.clipPath = `inset(${windowTop}px 0 ${Math.max(0, L.flowHeight - windowTop - L.captionHeight)}px 0)`;
      const u01 = v => clamp(+v || 0);
      const beat = clamp(Math.round(s), 0, N - 1), ci = CAPCH[beat], step = beat - CAP0[ci];
      if (ci !== lastCi || step !== lastStep) {
        chapEls.forEach((el, i) => {
          const on = i === ci; el.classList.toggle('on', on); if (on) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
          segEls[i].forEach((sg, k) => { sg.classList.toggle('cur', on && k === step); sg.classList.toggle('past', on && k < step); });
        });
        lastStep = step;
      }
      if (ci !== lastCi) {
        lastCi = ci; const el = chapEls[ci];
        if (bar.scrollWidth > bar.clientWidth + 2) bar.scrollTo({ left: Math.max(0, el.offsetLeft - (bar.clientWidth - el.offsetWidth) / 2), behavior: reduce ? 'auto' : 'smooth' });
      }
      if (AR && q > 0) {
        ctx.setTransform(L.d, 0, 0, L.d, 0, 0); ctx.clearRect(0, 0, L.W, L.H); photo.style.visibility = 'hidden';
        AR.render(q, modEnv(ctx)); return;
      }
      if (FU && f > 0 && f < 1) {
        const a = u01(FU.enter(f)) * (1 - u01(FU.exit ? FU.exit(f) : 0));
        if (a >= 0.999) { ctx.setTransform(L.d, 0, 0, L.d, 0, 0); ctx.clearRect(0, 0, L.W, L.H); photo.style.visibility = 'hidden'; FU.render(f, modEnv(ctx)); }
        else {
          draw(p); ctx.setTransform(L.d, 0, 0, L.d, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`; ctx.fillRect(0, 0, L.W, L.H);
          if (!layer) layer = document.createElement('canvas');
          if (layer.width !== canvas.width || layer.height !== canvas.height) { layer.width = canvas.width; layer.height = canvas.height; }
          const lc = layer.getContext('2d'); lc.setTransform(1, 0, 0, 1, 0, 0); lc.clearRect(0, 0, layer.width, layer.height);
          FU.render(f, modEnv(lc));
          ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a; ctx.drawImage(layer, 0, 0); ctx.globalAlpha = 1;
        }
        return;
      }
      draw(p);
    }
    const modEnv = c2 => ({ ctx: c2, L: Lyt, base: () => draw(1), FONT, rrect });
    function draw(p) {
      const L = Lyt, { W, H, d, fs } = L;
      ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, W, H); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const reserved = [];
      if (L.cap) reserved.push({ x: L.cap.x - 50, y: L.cap.y - 50, w: L.cap.w + 100, h: L.cap.h + 100 });
      if (L.peek && L.peek.h > 0) reserved.push({ x: L.peek.x - 20, y: L.peek.y - 10, w: L.peek.w + 40, h: L.peek.h + 10 });
      const pipA = L.pipOff ? 0 : smooth(seg(p, 0.22, 0.25)) * (1 - smooth(seg(p, 0.60, 0.63)));
      if (pipA > 0.05) reserved.push({ x: L.pip.x - 6, y: L.pip.y - 6, w: L.pip.w + 12, h: L.pip.h + 12 });
      const label = labeller(ctx, L, reserved);

      const zNow = depthL(p), trk = ease(seg(p, 0.22, 0.25));
      const cam = camera(p, lerp(ZC, zNow, trk)), raw = cam.raw, s = cam.s;
      const wR = smooth(seg(p, 0.22, 0.25)), wL2 = smooth(seg(p, 0.40, 0.43)), mt = smooth(seg(p, 0.60, 0.65));
      const gone = smooth(seg(p, 0.595, 0.615)), chA = smooth(seg(p, 0.625, 0.66));
      const zoom = 1 + (L.zoomJ - 1) * ease(seg(p, 0.0, 0.10));
      let F = coverF(raw, L.boxJ, zoom, L.aimJ);
      if (s > 0) F = blendF(F, fitTo(raw, PTS_R, L.boxR), s);
      if (wR > 0) F = blendF(F, fitTo(camera(p, ZSTAR).raw, PTS_L1, L.boxL), wR);
      if (wL2 > 0) F = blendF(F, fitTo(raw, PTS_L2, L.boxL2), wL2);
      const Vp = P => { const q = raw(P); return [F.ox + F.foc * q[0], F.oy + F.foc * q[1], q[2]]; };
      const line = (A, B, col, lw) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); };

      const ch = L.chart, Z0 = 0.40, Z1 = 1.15, sPx = ch.h / (Z1 - Z0);
      const chartY = z => ch.y + ch.h - (z - Z0) * sPx;
      const XX = i => lerp(ch.x + 14, ch.x + ch.w, i / (NW - 1));
      const sideCx = L.side.x + L.side.w * 0.5, MAG0 = L.mode === 'desk' ? 1.6 : 1.3;
      const magAt = z => clamp((chartY(z) - L.safeTop - 6) / (sPx * UPX), 0.5, MAG0);
      const drift = 0.02 * Math.sin(Math.PI * 2 * seg(p, 0.90, 1.0)) + 0.01 * seg(p, 0.75, 0.78);
      const sideOf = (Pw) => { const MAG = magAt(Pw[2]); return P => { const dx = P[0] - Pw[0], dz = P[2] - Pw[2], ca = Math.cos(drift), sa = Math.sin(drift);
        const rx = dx * ca - dz * sa, rz = dx * sa + dz * ca; return [sideCx + MAG * sPx * rx, chartY(Pw[2]) - MAG * sPx * rz + 0.35 * MAG * sPx * (P[1] - Pw[1])]; }; };

      const photoA = 1 - smooth(seg(p, 0.22, 0.233));
      if (photoA > 0.002 && photo.naturalWidth) {
        const cs = CORN.map(P => Vp(P));
        photo.style.transform = homography(cs, photo.naturalWidth, photo.naturalHeight);
        photo.style.opacity = photoA.toFixed(3); photo.style.visibility = 'visible';
        const op = smooth(seg(s, 0, 0.35)), b = L.boxJ, r = lerp(18, 0, op);
        const ins = [b.y, W - b.x - b.w, H - b.y - b.h, b.x].map(v => Math.max(0, v * (1 - op)));
        photoBox.style.clipPath = op >= 1 ? 'none' : `inset(${ins.map(v => v.toFixed(1) + 'px').join(' ')} round ${r.toFixed(1)}px)`;
      } else { photo.style.visibility = 'hidden'; }
      const camA = clamp(seg(s, 0.15, 0.6)) * (1 - smooth(seg(p, 0.22, 0.24)));
      if (camA > 0) {
        const O = Vp([0, 0, 0]), cs = CORN.map(P => Vp(P));
        ctx.globalAlpha = camA * lerp(0.45, 0.35, wR);
        cs.forEach(c => line(O, c, C.white, 1));
        ctx.globalAlpha = camA * lerp(0.9, 0.35, wR);
        ctx.strokeStyle = C.white; ctx.lineWidth = 1.4; ctx.beginPath(); cs.forEach((c, i) => (i ? ctx.lineTo(c[0], c[1]) : ctx.moveTo(c[0], c[1]))); ctx.closePath(); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      const ORD = [0, 13, 14, 15, 16, 1, 2, 3, 17, 4, 5, 6, 18, 10, 11, 12, 19, 7, 8, 9, 20];
      const popOf = j => { const k = ORD.indexOf(j), u = seg(p, 0.01 + 0.06 * k / 21, 0.01 + 0.06 * k / 21 + 0.008); return u <= 0 ? 0 : u < 0.6 ? 1.15 * smooth(u / 0.6) : lerp(1.15, 1, smooth((u - 0.6) / 0.4)); };
      const j2A = 1 - wR;
      if (j2A > 0) {
        const P2 = D.read.map(uv => Vp(ray(uv, D.intr).map(x => x * IP)));
        const big = s < 0.5 ? 1 : 0.7;
        ctx.globalAlpha = j2A;
        BONES.forEach(([c, pp]) => { const a = Math.min(popOf(c), popOf(pp), 1); if (a > 0) { ctx.globalAlpha = j2A * a * 0.75; line(P2[c], P2[pp], C.white, 1.6 * big); } });
        P2.forEach((P, j) => { const k = popOf(j); if (k <= 0) return; ctx.globalAlpha = j2A; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(P[0], P[1], (j ? 4.6 : 5.6) * big * k, 0, 7); ctx.fill();
          ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(P[0], P[1], (j ? 3.2 : 4.2) * big * k, 0, 7); ctx.fill(); });
        ctx.globalAlpha = 1;
      }

      const grow = ease(seg(p, 0.10, 0.17));
      const IDX = 17;
      const one = seg(p, 0.15, 0.16) * (1 - seg(p, 0.185, 0.20));
      if (grow > 0 && mt < 1) {
        const O = Vp([0, 0, 0]);
        D.read.forEach((uv, j) => {
          const q = ray(uv, D.intr), B = Vp(q.map(x => x * lerp(IP, 1.2, grow)));
          const hi = j === IDX ? one : 0;
          ctx.globalAlpha = (1 - mt) * (1 - 0.55 * one * (j === IDX ? 0 : 1));
          line(O, B, amber(0.35 + 0.55 * hi), (j === 0 ? 1.4 : 1) + 1.2 * hi);
        });
        ctx.globalAlpha = 1;
        if (one > 0) {
          const q = ray(D.read[IDX], D.intr), bz = lerp(0.35, 1.05, seg(p, 0.15, 0.21)), B = Vp(q.map(x => x * bz));
          ctx.globalAlpha = one; ctx.fillStyle = amber(1); ctx.beginPath(); ctx.arc(B[0], B[1], 5, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
          const A = Vp(q.map(x => x * 0.95));
          label({ text: 'depth unknown along this ray', anchor: A, color: amber(1), alpha: one, size: fs, weight: 700, cands: [[0, -64], [60, -70], [-40, -70], [0, 64], [80, 50]] });
        }
      }
      if (camA > 0.3 && s > 0.6) { const O = Vp([0, 0, 0]); if (O[0] > 30 && O[0] < W - 30 && O[1] > L.safeTop && O[1] < H - 30) label({ text: 'Camera', anchor: O, color: C.white, alpha: camA, plate: true, leader: false, size: Math.max(13, fs - 2), cands: [[0, 26], [0, -26], [-50, 0], [50, 0]] }); }

      const rA = seg(p, 0.20, 0.22);
      const onRay = z => Vp(Q0.map(v => v * z));
      const nrm0 = (() => { const A = onRay(0.45), B = onRay(0.9); let n = [-(B[1] - A[1]), B[0] - A[0]]; const l = Math.hypot(...n) || 1; n = n.map(v => v / l); if (n[1] < 0) n = n.map(v => -v); return n; })();
      const pr = L.panelRuler;
      const placeL2 = z => (pr ? [lerp(pr.x0, pr.x1, (z - 0.45) / 0.45), pr.y] : (P => [P[0] + nrm0[0] * L.rulerOff, P[1] + nrm0[1] * L.rulerOff])(onRay(z)));
      const nrmL2 = pr ? [0, 1] : nrm0;
      const rulerPos = z => { let P = onRay(z); if (wL2 > 0) P = L2(P, placeL2(z), wL2); if (mt > 0) P = L2(P, [ch.x, chartY(z)], mt); return P; };
      let nrm = L2(nrm0, nrmL2, wL2); nrm = L2(nrm, [-1, 0], mt); { const l = Math.hypot(...nrm) || 1; nrm = nrm.map(v => v / l); }
      const lo = lerp(lerp(0.40, 0.45, wL2), Z0, mt), hi = lerp(lerp(1.10, 0.90, wL2), Z1, mt);
      if (rA > 0) {
        const solid = Math.max(wL2, mt);
        ctx.globalAlpha = rA * (0.35 + 0.65 * solid);
        ctx.strokeStyle = C.axis; ctx.lineWidth = 1.2; ctx.setLineDash(solid > 0.5 ? [] : [3, 5]); ctx.beginPath();
        for (let k = 0; k <= 40; k++) { const P = rulerPos(lerp(lo, hi, k / 40)); k ? ctx.lineTo(P[0], P[1]) : ctx.moveTo(P[0], P[1]); }
        ctx.stroke(); ctx.setLineDash([]);
        const step = solid > 0.5 ? 0.05 : 0.10;
        for (let z = Math.ceil(lo / step - 1e-6) * step; z <= hi + 1e-6; z += step) {
          const P = rulerPos(z), major = Math.round(z * 100) % (solid > 0.5 ? 10 : 20) === 0, tl = major ? 7 : 4;
          ctx.globalAlpha = rA * (major ? 0.9 : 0.5);
          line([P[0] - nrm[0] * 2, P[1] - nrm[1] * 2], [P[0] + nrm[0] * tl, P[1] + nrm[1] * tl], C.axis, 1.2);
          if (major && (mt < 0.5 || Math.round(z * 100) % 10 === 0)) {
            const off = lerp(lerp(18, -15, wL2), 10, mt);
            label.text(`${Math.round(z * 100)}`, P[0] + nrm[0] * off, P[1] + nrm[1] * off, { size: Math.max(13, fs - 3), align: mt > 0.5 ? 'right' : 'center', alpha: rA * 0.9 * (1 - 0.6 * gone * (1 - mt)) });
          }
          if (wL2 > 0 && !pr && major) { ctx.globalAlpha = rA * 0.18 * wL2 * (1 - mt); ctx.setLineDash([2, 4]); line(onRay(z), P, C.axis, 1); ctx.setLineDash([]); }
        }
        { const P = rulerPos(hi), Q = rulerPos(hi - 0.02); let dv = [P[0] - Q[0], P[1] - Q[1]]; const dl = Math.hypot(...dv) || 1; dv = dv.map(v => v / dl);
          label.text('cm', P[0] + dv[0] * 18, P[1] + dv[1] * 18, { size: Math.max(13, fs - 3), alpha: rA * (1 - mt) }); }
        ctx.globalAlpha = 1;
      }

      const drawHand = (pts, colOf, lw, alpha, glow) => {
        ctx.globalAlpha = alpha;
        const segs = BONES.map(([c, pp], b) => ({ A: pts[c], B: pts[pp], z: ((pts[c][2] || 0) + (pts[pp][2] || 0)) / 2, col: colOf(b) })).sort((x, y) => y.z - x.z);
        ctx.save(); if (glow) ctx.shadowBlur = 10;
        segs.forEach(({ A, B, col }) => { if (glow) ctx.shadowColor = col; line(A, B, 'rgba(0,0,0,0.55)', lw + 2.4); line(A, B, col, lw); });
        ctx.restore(); ctx.globalAlpha = alpha;
        pts.forEach((P, j) => { ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(P[0], P[1], j ? 2.2 + lw * 0.15 : 3 + lw * 0.3, 0, 7); ctx.fill(); });
        ctx.globalAlpha = 1;
      };
      const handA = smooth(seg(p, 0.22, 0.25));
      const ph = playhead(p), kF = Math.round(ph), m = ease(seg(p, 0.80, 0.88));
      if (handA > 0 && p < 0.65) {
        const J = handZ(zNow), ratios = BONES.map(([c, pp], b) => len(J[c], J[pp]) / Lm[b]);
        const neutral = wL2, gr = smooth(seg(p, 0.50, 0.54));
        const colOf = b => (gr > 0 ? mix('#f5f5f7', C.green, gr) : neutral > 0 ? (neutral >= 1 ? 'rgba(245,245,247,0.85)' : ratioCol(lerp(ratios[b], 1, neutral))) : ratioCol(ratios[b]));
        const Pp = J.map(Vp);
        let pts = Pp;
        if (mt > 0) { const so = sideOf(J[0]); pts = J.map((P, j) => { const q = so(P); return [lerp(Pp[j][0], q[0], mt), lerp(Pp[j][1], q[1], mt), Pp[j][2]]; }); }
        const gA = smooth(seg(p, 0.245, 0.27)) * (1 - smooth(seg(p, 0.385, 0.41)));
        if (gA > 0) {
          const G = manoAt(zNow).map(Vp);
          ctx.globalAlpha = 0.55 * gA; ctx.setLineDash([5, 5]); BONES.forEach(([c, pp]) => line(G[c], G[pp], C.white, 1.6)); ctx.setLineDash([]); ctx.globalAlpha = 1;
          const tip = [9, 12, 6, 3, 16].map(j => G[j]).sort((a, b) => a[1] - b[1])[0];
          label({ text: 'MANO hand, metric size', anchor: tip, color: C.white, alpha: gA * 0.9, size: Math.max(13, fs - 1), weight: 600,
            cands: [[-120, -30], [120, -30], [-150, 10], [150, 10], [0, -46]] });
        }
        drawHand(pts, colOf, lerp(L.lw, L.lw * 0.8, mt), handA * (1 - smooth(seg(p, 0.636, 0.648))), true);
        const bA = seg(p, 0.366, 0.38) * (1 - seg(p, 0.40, 0.42));
        if (bA > 0) {
          ctx.globalAlpha = bA * 0.22; ctx.strokeStyle = C.white; ctx.lineWidth = 12; ctx.lineCap = 'butt'; ctx.beginPath();
          for (let k = 0; k <= 8; k++) { const P = rulerPos(lerp(BAND[0], BAND[1], k / 8)); k ? ctx.lineTo(P[0], P[1]) : ctx.moveTo(P[0], P[1]); }
          ctx.stroke(); ctx.lineCap = 'round'; ctx.globalAlpha = 1;
        }
        const bandLabel = () => { if (bA <= 0) return; const P = rulerPos(BAND[1]);
          label({ text: 'lengths match here', anchor: P, color: C.white, alpha: bA, size: fs,
            cands: [[nrm[0] * 60 + 40, nrm[1] * 60], [nrm[0] * 90, nrm[1] * 90], [80, -40], [90, 0], [-nrm[0] * 50, -nrm[1] * 50], [0, 0.1 * L.H], [0, 0.16 * L.H], [100, 0.06 * L.H]] });
        }
        const rd = seg(p, 0.25, 0.27) * (1 - seg(p, 0.385, 0.40));
        if (rd > 0) {
          const med = medR(zNow), st = med < 0.96 ? 'too near' : med > 1.04 ? 'too far' : 'fits';
          const cur = rulerPos(zNow);
          ctx.globalAlpha = rd; ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(cur[0], cur[1], 4.5, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
          label({ text: `hand ${med.toFixed(2)}× · ${st}`, anchor: cur, color: ratioCol(med), alpha: rd, size: fs + 1, weight: 700,
            cands: pr ? [[0, 0.1 * L.H], [0, 0.16 * L.H], [70, 0.1 * L.H]] : [[nrm[0] * 46, nrm[1] * 46], [nrm[0] * 46 + 60, nrm[1] * 46], [nrm[0] * 46 + 120, nrm[1] * 46], [nrm[0] * 80, nrm[1] * 80], [130, 0], [0, -50]] });
        }
        bandLabel();
      }

      const VA = 1 - gone;
      const r0 = L.dot[0], r1 = L.dot[1];
      const stacks = {}; let maxStack = 0;
      const MAXSTACK = (() => { const st = {}; let mx = 0; VALID.forEach(b => { const v = VOTES[b], key = v < 0.45 ? 'lo' : v > 0.90 ? 'hi' : String(Math.round(v * 100)), r = lerp(r0, r1, rad01(b)), pv = st[key] || { off: 4, r: 0 }, off = pv.off + pv.r + r + (pv.r ? 1.5 : 0); st[key] = { off, r }; mx = Math.max(mx, off + r); }); return mx; })();
      const voteLand = [];
      if (p >= 0.42 && p < 0.625) {
        const Jn = handZ(zNow).map(Vp);
        const loR = 0.45, hiR = 0.90;
        VALID.forEach((b, k) => {
          const u = seg(p, 0.42 + 0.0042 * k, 0.42 + 0.0042 * k + 0.016); if (u <= 0) return;
          const v = VOTES[b], key = v < loR ? 'lo' : v > hiR ? 'hi' : String(Math.round(v * 100));
          const r = lerp(r0, r1, rad01(b));
          const prev = stacks[key] || { off: 4, r: 0 };
          const off = prev.off + prev.r + r + (prev.r ? 1.5 : 0); stacks[key] = { off, r }; maxStack = Math.max(maxStack, off + r);
          const land = (P => [P[0] + nrm[0] * off, P[1] + nrm[1] * off])(rulerPos(clamp(v, lo, hi)));
          const [c, pp] = BONES[b], S0 = [(Jn[c][0] + Jn[pp][0]) / 2, (Jn[c][1] + Jn[pp][1]) / 2];
          const t = smooth(u), ctl = [(S0[0] + land[0]) / 2, Math.min(S0[1], land[1]) - 30];
          const P = u >= 1 ? land : [(1 - t) ** 2 * S0[0] + 2 * (1 - t) * t * ctl[0] + t * t * land[0], (1 - t) ** 2 * S0[1] + 2 * (1 - t) * t * ctl[1] + t * t * land[1]];
          voteLand.push({ b, P, r });
        });
        const fit = smooth(seg(p, 0.50, 0.52));
        voteLand.forEach(({ b, P, r }) => {
          const w = WGT(b), hollow = w < 0.5;
          const fillA = lerp(1, hollow ? 0 : w, fit);
          ctx.globalAlpha = VA * fillA; ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(P[0], P[1], r, 0, 7); ctx.fill();
          if (hollow && fit > 0) { ctx.globalAlpha = VA * 0.4 * fit; ctx.strokeStyle = C.white; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(P[0], P[1], r, 0, 7); ctx.stroke(); }
        });
        ctx.globalAlpha = 1;
        const loV = VALID.filter(b => VOTES[b] < loR), hiV = VALID.filter(b => VOTES[b] > hiR);
        const tagA = k => (stacks[k] ? 1 : 0) * VA;
        const endTag = (z, sgn, text, key) => { const E = rulerPos(z), Q = rulerPos(z - sgn * 0.02); let dv = [E[0] - Q[0], E[1] - Q[1]]; const dl = Math.hypot(...dv) || 1; dv = dv.map(v => v / dl);
          const st = stacks[key] ? stacks[key].off + stacks[key].r : 0, al = dv[0] > 0.4 ? 'left' : dv[0] < -0.4 ? 'right' : 'center';
          label({ text, anchor: E, color: C.mute, alpha: tagA(key) * (1 - gone), size: Math.max(13, fs - 2), leader: false, align: al, plate: false,
            cands: [[dv[0] * 26, dv[1] * 26], [dv[0] * 26 + nrm[0] * 16, dv[1] * 26 + nrm[1] * 16], [nrm[0] * (st + 18), nrm[1] * (st + 18)], [-nrm[0] * 30 + dv[0] * 8, -nrm[1] * 30 + dv[1] * 8]] }); };
        if (loV.length) endTag(lo, -1, `◂ ${loV.map(b => Math.round(VOTES[b] * 100)).join(', ')} cm`, 'lo');
        if (hiV.length) endTag(hi, 1, `${hiV.map(b => Math.round(VOTES[b] * 100)).join(', ')} cm ▸`, 'hi');
        const nA = seg(p, 0.44, 0.47) * VA;
        const Pn = rulerPos(hi);
        label({ text: `${VALID.length} of ${BONES.length} bones give a depth`, anchor: pr ? [pr.x1 + 8, pr.y + maxStack + 26] : [Pn[0] + nrm[0] * 30 + 14, Pn[1] + nrm[1] * 30], color: C.mute, alpha: nA, size: Math.max(13, fs - 2), align: pr ? 'right' : 'left', leader: false, plate: false,
          cands: [[0, 0], [0, 24], [-60, 40]] });
        const cl = smooth(seg(p, 0.50, 0.53));
        if (cl > 0) {
          const P = rulerPos(ZF), ext = (MAXSTACK + 10) * cl;
          ctx.globalAlpha = 1 - smooth(seg(p, 0.60, 0.625)); line([P[0] - nrm[0] * 12, P[1] - nrm[1] * 12], [P[0] + nrm[0] * ext, P[1] + nrm[1] * ext], C.green, 2.5);
          ctx.globalAlpha = 1;
        }
      }
      const P150 = Math.round(K0), pReach = 0.665 + 0.105 * P150 / (NW - 1);
      const c62 = smooth(seg(p, 0.50, 0.53)) * (1 - smooth(seg(p, pReach, pReach + 0.012)));
      const c62col = mt > 0 ? relaxCol(1 - smooth(seg(p, 0.645, 0.665))) : C.green;
      if (c62 > 0) {
        const P = rulerPos(ZF), A0 = [P[0] + nrm[0] * (MAXSTACK + 30), P[1] + nrm[1] * (MAXSTACK + 30)], dot = L2(P, [XX(K0), chartY(ZF)], mt);
        if (mt > 0) { ctx.globalAlpha = c62; ctx.fillStyle = c62col; ctx.beginPath(); ctx.arc(dot[0], dot[1], 5.5, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
        label({ text: `${(ZF * 100).toFixed(0)} cm`, anchor: L2(A0, [dot[0], dot[1] - 30], mt), color: c62col, alpha: c62, size: L.mode === 'desk' ? 28 : 22, weight: 700, leader: false, plate: mt > 0.2,
          cands: mt > 0 ? [[0, 0], [0, 60]] : [[0, 0], [0, 12], [-60, 4], [60, 4]] });
      }

      if (pipA > 0.01 && photo.naturalWidth) {
        const R = L.pip;
        ctx.globalAlpha = pipA; ctx.save(); rrect(ctx, R.x, R.y, R.w, R.h, 12); ctx.clip(); ctx.drawImage(photo, R.x, R.y, R.w, R.h);
        const sx = R.w / D.W, sy = R.h / D.H, P2 = D.read.map(uv => [R.x + uv[0] * sx, R.y + uv[1] * sy]);
        BONES.forEach(([c, pp]) => line(P2[c], P2[pp], 'rgba(245,245,247,0.8)', 1));
        P2.forEach(P => { ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(P[0], P[1], 1.8, 0, 7); ctx.fill(); });
        ctx.restore(); ctx.globalAlpha = pipA; ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; rrect(ctx, R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1, 12); ctx.stroke(); ctx.globalAlpha = 1;
      }

      if (mt > 0) {
        const A = chA;
        ctx.globalAlpha = A;
        ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
        for (let z = 0.5; z <= Z1 + 1e-6; z += 0.1) { const y = chartY(z); ctx.beginPath(); ctx.moveTo(ch.x + 4, y); ctx.lineTo(ch.x + ch.w, y); ctx.stroke(); }
        line([ch.x, ch.y + ch.h], [ch.x + ch.w, ch.y + ch.h], C.axis, 1);
        ctx.globalAlpha = 1;
        const axs = Math.max(13, fs - 3), axY = ch.y + ch.h + 0.6 * axs + 6, phOn = p >= 0.645, phX = XX(playhead(p));
        let phR = null;
        if (phOn) phR = label.text(`${D.win.start + Math.round(playhead(p))}`, clamp(phX, ch.x + 20, ch.x + ch.w - 14), axY, { size: axs, weight: 700, color: C.white, alpha: A });
        ctx.font = `500 ${axs}px ${FONT}`;
        [0, 20, 40, NW - 1].forEach(i => {
          const t = i === 0 && ch.w > 360 ? `frame ${D.win.start + i}` : `${D.win.start + i}`, al = i === 0 ? 'left' : i === NW - 1 ? 'right' : 'center';
          const x = i === 0 ? XX(0) - 4 : i === NW - 1 ? XX(i) + 4 : XX(i), w = ctx.measureText(t).width, x0 = al === 'left' ? x : al === 'right' ? x - w : x - w / 2;
          if (phR && x0 < phR.x + phR.w + 8 && phR.x < x0 + w + 8) return;
          label.text(t, x, axY, { size: axs, align: al, alpha: A });
        });
        const titleY = Math.max(L.safeTop + fs * 0.65, ch.y - 1.25 * fs);
        label.text('Wrist depth (cm)', ch.x + 14, titleY, { size: fs, weight: 600, color: '#d2d2d7', align: 'left', alpha: A });
        const upto = p < 0.665 ? -1 : p < 0.77 ? ph : NW - 1;
        const cm = relaxCol(m);
        if (m > 0) { ctx.globalAlpha = A * 0.25; ctx.strokeStyle = C.red; ctx.lineWidth = 1.5; ctx.beginPath(); let st = false;
          for (let i = 0; i <= upto; i++) { if (!okW(i)) { st = false; continue; } const y = chartY(zfA[i]); st ? ctx.lineTo(XX(i), y) : ctx.moveTo(XX(i), y); st = true; } ctx.stroke(); }
        ctx.globalAlpha = A; ctx.strokeStyle = cm; ctx.lineWidth = 2.2; ctx.beginPath(); { let st = false;
          const last = Math.floor(upto);
          for (let i = 0; i <= last; i++) { if (!okW(i)) { st = false; continue; } const y = chartY(zAt(i, m)); st ? ctx.lineTo(XX(i), y) : ctx.moveTo(XX(i), y); st = true; }
          if (upto > last && last + 1 < NW && okW(last + 1) && st) { const f = upto - last; ctx.lineTo(lerp(XX(last), XX(last + 1), f), chartY(lerp(zAt(last, m), zAt(last + 1, m), f))); } }
        ctx.stroke(); ctx.globalAlpha = 1;
        const i0 = Math.floor(ph), i1 = Math.min(NW - 1, i0 + 1), fr = ph - i0;
        const zph = p < 0.65 ? ZF : lerp(zAt(i0, m), zAt(i1, m), fr);
        const PX = [XX(ph), chartY(zph)];
        if (p >= 0.635) {
          ctx.globalAlpha = A * seg(p, 0.635, 0.65); line([PX[0], ch.y], [PX[0], ch.y + ch.h], 'rgba(255,255,255,0.3)', 1);
          ctx.fillStyle = cm; ctx.beginPath(); ctx.arc(PX[0], PX[1], 5, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        }
        const sp = L.strip, bwid = Math.max(1.5, (XX(1) - XX(0)) * 0.55);
        const stA = A * (L.swap ? 1 - smooth(seg(p, 0.78, 0.795)) : 1);
        ctx.globalAlpha = stA; line([sp.x, sp.y + sp.h], [sp.x + sp.w, sp.y + sp.h], 'rgba(142,142,147,0.5)', 1);
        ctx.fillStyle = cm; let sum = 0, n = 0;
        for (let i = 2; i <= Math.floor(upto); i++) { const v = d2(i, m); if (!Number.isFinite(v)) continue; sum += v; n++; const hgt = Math.max(1, sp.h * v / D2MAX); ctx.fillRect(XX(i) - bwid / 2, sp.y + sp.h - hgt, bwid, hgt); }
        ctx.globalAlpha = 1;
        if (p >= 0.65) {
          const mean = n ? 1000 * sum / n : 0;
          ctx.globalAlpha = stA; ctx.font = `600 ${Math.max(13, fs - 2)}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillStyle = C.mute;
          const mtx = `mean ${mean.toFixed(mean < 10 ? 1 : 0)} mm/frame²`;
          if (sp.w < 420) { ctx.fillText('Jitter |Δ²z|', L.strip.lx, sp.y - 6); const w0 = ctx.measureText('Jitter |Δ²z|  ').width; ctx.fillStyle = cm; ctx.font = `700 ${Math.max(13, fs - 2)}px ${FONT}`; ctx.fillText(mtx, L.strip.lx + w0, sp.y - 6); }
          else { ctx.fillText('Jitter |Δ²z| per frame', sp.x + 14, sp.y - 6);
            ctx.textAlign = 'right'; ctx.fillStyle = cm; ctx.font = `700 ${Math.max(13, fs - 2)}px ${FONT}`; ctx.fillText(mtx, sp.x + sp.w, sp.y - 6); }
          ctx.globalAlpha = 1;
        }
        const spA = (p >= 0.65 && ph >= SPIKE - 0.01 ? 1 : 0) * (1 - seg(m, 0.3, 0.6)) * A;
        if (spA > 0) {
          const x = XX(SPIKE), ya = chartY(zfA[SPIKE - 1]), yb = chartY(zfA[SPIKE]);
          ctx.globalAlpha = spA; ctx.setLineDash([2, 3]); line([XX(SPIKE - 1), ya], [x + 7, ya], C.red, 1.2); ctx.setLineDash([]);
          line([x + 7, ya], [x + 7, yb], C.red, 2); line([x + 3, ya], [x + 11, ya], C.red, 2); line([x + 3, yb], [x + 11, yb], C.red, 2); ctx.globalAlpha = 1;
          const jump = `${Math.round(JUMP * 100)} cm`;
          const compact = ch.w < 360;
          label({ text: compact ? `${jump} jump` : `jumps ${jump} in one frame`, anchor: [x + 9, (ya + yb) / 2], color: C.red, alpha: spA, size: Math.max(13, fs - 1), weight: 700,
            cands: compact ? [[-64, -48], [-64, 48], [0, -60]] : [[-130, 0], [-120, -34], [-120, 34], [110, 0], [0, -50], [0, 50]] });
        }
        if (p >= 0.635) {
          const hA = smooth(seg(p, 0.642, 0.655));
          const k = clamp(kF, 0, NW - 1), zr = zfA[k], zc = zph;
          const Xr = onRays(k, zc), so = sideOf(Xr[0]), pts = Xr.map(so);
          Xr.forEach((P, j) => { const A2 = so(P), endz = Math.max(0.12, Z0 - 0.02), Bp = so(P.map(v => v * endz / P[2]));
            const g = ctx.createLinearGradient(A2[0], A2[1], Bp[0], Bp[1]); g.addColorStop(0, amber(0.3 * hA)); g.addColorStop(1, amber(0));
            ctx.strokeStyle = g; ctx.lineWidth = j ? 0.8 : 1.3; ctx.beginPath(); ctx.moveTo(A2[0], A2[1]); ctx.lineTo(Bp[0], Bp[1]); ctx.stroke(); });
          if (m > 0 && Math.abs(ph - SPIKE) < 0.5 && p < 0.882) {
            const Xg = onRays(k, zr), sg = sideOf(Xg[0]); drawHand(Xg.map(sg), () => C.red, L.lw * 0.8, 0.25 * hA, false);
          }
          drawHand(pts, () => relaxCol(m), L.lw * 0.8, hA, true);
          ctx.globalAlpha = hA * 0.75; ctx.setLineDash([2, 4]); line(pts[0], PX, cm, 1.2); ctx.setLineDash([]); ctx.globalAlpha = 1;
        }
        const eA = (L.swap ? smooth(seg(p, 0.80, 0.815)) : seg(p, 0.78, 0.80)) * A;
        if (eA > 0) {
          const E = L.energy, T = termsAt(m), rh = E.row, hdr = Math.max(13, fs - 1);
          ctx.globalAlpha = eA; ctx.fillStyle = '#d2d2d7'; ctx.font = `600 ${hdr}px ${FONT}`; ctx.textAlign = 'left';
          const done = m >= 0.999;
          ctx.fillStyle = done ? C.green : '#d2d2d7';
          ctx.fillText(done ? 'Every term decreases' : 'Clip energy: frame by frame → one fit', E.x, E.y + hdr);
          const rows = [['Bones', T.bone, T0.bone, '%'], ['Reprojection', T.rep, T0.rep, ' px'], ['Temporal', T.tmp, T0.tmp, ' mm/f²']];
          const fsr = Math.max(13, fs - 2);
          rows.forEach(([nm, v, v0, unit], r) => {
            const g8 = rh < 22 ? 4 : 8, y = E.y + hdr + g8 + 4 + r * (rh + g8) + fsr;
            ctx.font = `600 ${fsr}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillStyle = C.mute; ctx.fillText(nm, E.x, y);
            const now = `${v.toFixed(v < 10 ? 1 : 0)}${unit}`, bef = `${v0.toFixed(v0 < 10 ? 1 : 0)} → `;
            ctx.textAlign = 'right'; ctx.font = `700 ${fsr}px ${FONT}`; ctx.fillStyle = cm; ctx.fillText(now, E.x + E.w, y); const nw = ctx.measureText(now).width;
            ctx.font = `500 ${fsr}px ${FONT}`; ctx.fillStyle = C.red; ctx.fillText(bef, E.x + E.w - nw, y);
            const by = y + 6, bh = Math.max(3, rh - fsr - 6);
            ctx.fillStyle = '#2c2c2e'; rrect(ctx, E.x, by, E.w, bh, bh / 2); ctx.fill();
            ctx.fillStyle = cm; rrect(ctx, E.x, by, Math.max(bh, E.w * clamp(v / v0)), bh, bh / 2); ctx.fill();
          });
          ctx.globalAlpha = 1;
        }
      }
      label.flush();
      if (L.cap) {
        const c = L.cap; ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,0.33)';
        for (let k = 0; k < 7; k++) { const e = (6 - k) * 8; rrect(ctx, c.x - e, c.y - e, c.w + 2 * e, c.h + 2 * e, 18 + e); ctx.fill(); }
        const b = L.peek; if (b && b.h > 0) for (let k = 0; k < 7; k++) { const e = (6 - k) * 8; rrect(ctx, c.x - e, c.y + c.h, c.w + 2 * e, L.H - c.y - c.h + 60, 18 + e); ctx.fill(); }
        ctx.restore();
      }
    }
    const ctl = stepper(pin, stage, N, { resize: () => { const px = resize(); [FU, AR].forEach(md => { if (md && md.resize) md.resize(modEnv(ctx)); }); return px; }, render });
    window.VDH_INSIGHT_REDRAW = () => ctl.redraw();
  })();

})();
