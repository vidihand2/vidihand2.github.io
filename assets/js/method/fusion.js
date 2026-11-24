'use strict';
(() => {
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const smooth = t => t * t * (3 - 2 * t);
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const LOAD = window.VDH_LOAD;
  const redraw = () => window.VDH_INSIGHT_REDRAW && window.VDH_INSIGHT_REDRAW();
  const END = 0.93;
  const NAMES = ['joints', 'mano', 'ours'], COLS = ['Joints only', 'MANO only', 'ViDiHand2'], ERR = [6.7, 5.7, 4.9];
  const GREEN = '#39ab38', RED = '#ff453a', WHITE = '#f5f5f7', MUTE = '#a1a1a6';
  const imgs = NAMES.map(name => {
    const image = new Image();
    image.onload = redraw;
    LOAD.image(50, document.querySelector('#st-idea'), image, `assets/img/method/fusion_${name}_dark.png`);
    return image;
  });
  const PW = 512, PH = 489, BORDER = 304, CROP = 46, A = PW / PH;
  const SPOTS = [
    { c: [0.9370256991366998 * PW, 0.23175449087727534 * PH], name: 'Fingertip', where: 'in the image', ok: [true, false, true], t: [0.19, 0.31, 0.72] },
    { c: [0.17904385755252192 * PW, 0.8322828910017994 * PH], name: 'Wrist', where: 'beyond the border', ok: [false, true, true], t: [0.46, 0.58, 0.76] }];
  const FLY = 0.08, RING = 0.04;
  const cropOf = (sp, hs) => { const x0 = clamp(sp.c[0] - hs, 0, PW - 2 * hs), y0 = clamp(sp.c[1] - hs, 0, PH - 2 * hs); return { x0, y0, s: 2 * hs, gx: (sp.c[0] - x0) / (2 * hs), gy: (sp.c[1] - y0) / (2 * hs) }; };
  const KEYS = [[0, 2], [0.18, 0], [0.30, 1], [0.45, 0], [0.57, 1], [0.71, 2]], XF = 0.012;
  const MORPH = p => [ease(seg(p, 0.18, 0.27)), ease(seg(p, 0.44, 0.53)), ease(seg(p, 0.70, 0.79))];
  let G = null;

  function resize(env) {
    const L = env.L, { mode, W, H, d } = L, cap = L.capBox;
    const g = { mode, W, d };
    let R;
    if (mode === 'desk') {
      const tall = H >= 700;
      R = { x0: cap.x + cap.w + (W >= 1200 ? 56 : 32), x1: W - Math.max(W >= 1200 ? 40 : 22, (W - 1320) / 2), y0: L.safeTop + (tall ? 10 : 2), y1: H - (tall ? 28 : 12) };
      Object.assign(g, { gap: 14, head: 30, rowHead: 28, gapR: tall ? 12 : 6, gapS: tall ? 22 : 14, foot: 32, leg: 26, big: 40, kS: 1.05 });
    } else if (mode === 'port') {
      const pad = W >= 700;
      R = { x0: pad ? 40 : 8, x1: W - (pad ? 40 : 8), y0: 4, y1: H - 4 };
      Object.assign(g, { gap: pad ? 14 : 8, head: pad ? 30 : 24, rowHead: pad ? 28 : 22, gapR: pad ? 10 : 4, gapS: pad ? 20 : 10, foot: pad ? 32 : 24, leg: pad ? 26 : 20, big: 16, kS: 1.0 });
    } else {
      R = { x0: 8, x1: W - 8, y0: 6, y1: H - 6 };
      Object.assign(g, { gap: 8, head: 24, rowHead: 22, gapR: 4, gapS: 12, foot: 24, leg: 20, big: 16, kS: 1.0 });
    }
    const Rw = R.x1 - R.x0, Rh = R.y1 - R.y0;
    const fixed = g.head + 2 * g.rowHead + g.gapR + g.foot + g.leg;
    const cStack = Math.min((Rw - 2 * g.gap) / 3, (Rh - fixed - g.gapS) / (2 + g.kS));
    const cSide = Math.min((Rh - fixed) / 2, (Rw - g.big - 2 * g.gap - A * (fixed - g.foot - g.leg)) / (3 + 2 * A));
    g.arr = cSide > cStack * 1.08 ? 'side' : 'stack';
    g.c = Math.floor(g.arr === 'side' ? cSide : cStack);
    g.R = R; g.cx = (R.x0 + R.x1) / 2; g.cy = (R.y0 + R.y1) / 2;
    if (mode === 'desk') {
      const sH = Math.min(cap.y - 44 - R.y0, cap.w / A);
      if (sH >= 150) { g.arr = 'col'; g.c = Math.floor(Math.min((Rw - 2 * g.gap) / 3, (Rh - fixed) / 2)); g.Sf = { x: cap.x, y: cap.y - 44 - sH, w: sH * A, h: sH }; g.h0 = Math.min(Rh * 0.94, Rw * 0.94 / A); }
    }
    g.gridH = fixed + 2 * g.c;
    if (g.arr === 'col') { }
    else if (g.arr === 'stack') {
      g.h2 = g.kS * g.c; g.h1 = g.h2 + g.rowHead + g.c + g.gapR;
      g.h0 = Math.max(g.h1, Math.min(Rh * 0.94, Rw * 0.94 / A));
      g.compH = g.h2 + g.gapS + g.gridH; g.top = R.y0 + (Rh - g.compH) / 2;
    } else {
      g.h2 = Math.min(Rh, g.gridH - g.foot - g.leg); g.w2 = g.h2 * A;
      g.h0 = Math.min(Rh * 0.94, Rw * 0.62 / A);
    }
    g.fsHead = clamp(g.c / 11, 13, 18); g.fsRow = g.c >= 240 ? 15 : g.c >= 150 ? 14 : 13;
    G = g;
  }
  function geom(U) {
    const g = G, gw = lerp(2 * g.c + g.gap, 3 * g.c + 2 * g.gap, U[2]);
    if (g.arr === 'col') {
      const w0 = g.h0 * A, S0 = { x: g.cx - w0 / 2, y: g.cy - g.h0 / 2, w: w0, h: g.h0 }, F = g.Sf, t = U[0];
      const lift = smooth(seg(t, 0, 0.55)), across = smooth(seg(t, 0.55, 1));
      const w = lerp(w0, F.w, lift);
      const S = { x: lerp(g.cx - w / 2, F.x, across), y: lerp(S0.y, F.y, lift), w, h: lerp(S0.h, F.h, lift) };
      return { S, gx: g.cx - gw / 2, gy: lerp(g.cy - (g.head + g.rowHead + g.c) / 2 - g.head / 2, g.cy - g.gridH / 2, U[1]) };
    }
    if (g.arr === 'stack') {
      const h = lerp(lerp(g.h0, g.h1, U[0]), g.h2, U[1]), y = lerp(g.R.y0 + (g.R.y1 - g.R.y0 - g.h0) / 2, g.top, U[0]);
      return { S: { x: g.cx - h * A / 2, y, w: h * A, h }, gx: g.cx - gw / 2, gy: y + h + g.gapS };
    }
    const left = g.cx - (g.w2 + g.big + gw) / 2, w0 = g.h0 * A;
    const S0 = { x: g.cx - w0 / 2, y: g.cy - g.h0 / 2, w: w0, h: g.h0 }, S2 = { x: left, y: g.cy - g.gridH / 2 + (g.gridH - g.foot - g.leg - g.h2) / 2, w: g.w2, h: g.h2 };
    const S = { x: lerp(S0.x, S2.x, U[0]), y: lerp(S0.y, S2.y, U[0]), w: lerp(S0.w, S2.w, U[0]), h: lerp(S0.h, S2.h, U[0]) };
    return { S, gx: left + g.w2 + g.big, gy: g.cy - g.gridH / 2 };
  }

  function render(f, env) {
    const p = clamp(f / END), { ctx, FONT, rrect } = env;
    const g = G, { W, d, c: cell, gap } = g, small = g.mode !== 'desk';
    ctx.setTransform(d, 0, 0, d, 0, 0); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const U = MORPH(p);
    const { S, gx, gy } = geom(U);
    const colX = k => gx + k * (cell + gap), rowY = r => gy + g.head + r * (g.rowHead + cell + g.gapR) + g.rowHead;
    const text = (t, x, y, { size = 13, weight = 600, color = WHITE, align = 'left', alpha = 1 } = {}) => {
      if (alpha <= 0.01) return 0; ctx.globalAlpha = alpha; ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = color; ctx.fillText(t, x, y);
      const w = ctx.measureText(t).width; ctx.globalAlpha = 1; return w;
    };
    const chip = (t, x, y, alpha, { align = 'left', color = WHITE, weight = 600 } = {}) => {
      if (alpha <= 0.01) return; ctx.font = `${weight} 13px ${FONT}`; const tw = ctx.measureText(t).width + 18, x0 = clamp(align === 'right' ? x - tw : align === 'center' ? x - tw / 2 : x, 4, W - 4 - tw);
      ctx.globalAlpha = alpha; ctx.fillStyle = 'rgba(0,0,0,0.74)'; rrect(ctx, x0, y - 13, tw, 26, 13); ctx.fill();
      ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(t, x0 + 9, y + 0.5); ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
    };

    const kz = 1 + 0.07 * p, kcx = PW / 2, kcy = BORDER;
    const toS = q => [S.x + (kcx + (q[0] - kcx) * kz) / PW * S.w, S.y + (kcy + (q[1] - kcy) * kz) / PH * S.h];
    let ki = 0; KEYS.forEach((k, i) => { if (p >= k[0]) ki = i; });
    const vNow = KEYS[ki][1], vPrev = ki ? KEYS[ki - 1][1] : vNow, xf = ki ? smooth(seg(p, KEYS[ki][0], KEYS[ki][0] + XF)) : 1;
    const rad = clamp(S.h / 28, 8, 18);
    ctx.save(); rrect(ctx, S.x, S.y, S.w, S.h, rad); ctx.clip();
    const o = toS([0, 0]);
    const drawV = (v, a) => { const im = imgs[v]; if (a > 0 && im.complete && im.naturalWidth) { ctx.globalAlpha = a; ctx.drawImage(im, o[0], o[1], S.w * kz, S.h * kz); } };
    if (xf < 1) drawV(vPrev, 1); drawV(vNow, xf < 1 ? xf : 1); ctx.globalAlpha = 1;
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1; rrect(ctx, S.x + 0.5, S.y + 0.5, S.w - 1, S.h - 1, rad); ctx.stroke();
    const by = S.y + BORDER / PH * S.h, sA = ease(seg(p, 0, 0.07)), intro = 1 - smooth(seg(U[0], 0, 0.5));
    ctx.strokeStyle = '#fff'; ctx.lineWidth = S.h > 300 ? 2 : 1.5; ctx.setLineDash([7, 5]);
    ctx.beginPath(); ctx.moveTo(S.x, by); ctx.lineTo(lerp(S.x, S.x + S.w, sA), by); ctx.stroke(); ctx.setLineDash([]);
    chip('Image border', S.x + 12, by - 20, sA * intro);
    chip('Beyond the image', S.x + S.w - 12, by + 22, smooth(seg(p, 0.03, 0.08)) * intro, { align: 'right' });
    if (S.w > 380) chip('Color: prediction · gray: ground truth', S.x + 12, S.y + S.h - 22, smooth(seg(p, 0.10, 0.15)) * intro, { color: '#d2d2d7', weight: 500 });
    if (S.w >= 200) { const y = S.y + 22, x = S.x + 12, nm = v => (v === 2 ? 'ViDiHand2' : COLS[v]);
      if (xf < 1) chip(nm(vPrev), x, y, 1 - xf, { color: vPrev === 2 ? GREEN : WHITE, weight: 700 });
      chip(nm(vNow), x, y, xf, { color: vNow === 2 ? GREEN : WHITE, weight: 700 }); }
    const markOf = sp => { const cr = cropOf(sp, CROP), a = toS([cr.x0, cr.y0]), b = toS([cr.x0 + cr.s, cr.y0 + cr.s]); return { x: a[0], y: a[1], s: b[0] - a[0] }; };
    const rowOn = [1 - 0.55 * smooth(seg(p, 0.44, 0.50)) + 0.55 * smooth(seg(p, 0.70, 0.76)), 1 - 0.55 * smooth(seg(p, 0.18, 0.24)) + 0.55 * smooth(seg(p, 0.44, 0.50))];
    SPOTS.forEach((sp, r) => {
      const t0 = 0.05 + r * 0.045, a = smooth(seg(p, t0, t0 + 0.035)); if (a <= 0) return;
      const m = markOf(sp), pop = lerp(1.5, 1, a), pulse = Math.sin(Math.PI * seg(p, t0 + 0.02, t0 + 0.09)), cxm = m.x + m.s / 2, cym = m.y + m.s / 2, hw = m.s / 2 * pop;
      ctx.save(); ctx.globalAlpha = a * rowOn[r]; ctx.shadowColor = '#fff'; ctx.shadowBlur = 16 * pulse; ctx.strokeStyle = '#fff'; ctx.lineWidth = (S.h > 300 ? 2.2 : 1.6) * (1 + 0.5 * pulse);
      rrect(ctx, cxm - hw, cym - hw, 2 * hw, 2 * hw, clamp(m.s / 8, 3, 8)); ctx.stroke(); ctx.restore();
      const ca = smooth(seg(p, t0 + 0.025, t0 + 0.06)) * intro, lab = `${sp.name} · ${sp.where}`;
      if (r === 0) chip(lab, m.x - 10, cym, ca, { align: 'right' }); else chip(lab, m.x + m.s + 10, cym, ca);
    });

    const fin = smooth(seg(p, 0.88, 0.93));
    COLS.forEach((n, k) => {
      const t0 = SPOTS[0].t[k], a = smooth(seg(p, t0, t0 + 0.05));
      text(n, colX(k) + cell / 2, gy + g.head - 10, { size: g.fsHead, weight: 700, color: k === 2 ? GREEN : WHITE, align: 'center', alpha: a });
    });
    SPOTS.forEach((sp, r) => {
      const ra = smooth(seg(p, sp.t[0], sp.t[0] + 0.05));
      const nw = text(sp.name, colX(0), rowY(r) - 9, { size: g.fsRow, weight: 700, alpha: ra });
      if (2 * cell + gap > 250) text(` · ${sp.where}`, colX(0) + nw, rowY(r) - 9, { size: g.fsRow, weight: 500, color: MUTE, alpha: ra });
      [0, 1, 2].forEach(k => {
        const t0 = sp.t[k], f = ease(seg(p, t0, t0 + FLY)); if (f <= 0) return;
        const ring = smooth(seg(p, t0 + FLY, t0 + FLY + RING)), m = markOf(sp);
        const x = lerp(m.x, colX(k), f), s2 = lerp(m.s, cell, f), y = lerp(m.y, rowY(r), f) - Math.sin(Math.PI * f) * 0.10 * cell, rr = clamp(s2 / 14, 3, 14);
        const dim = k === 2 ? 1 : 1 - 0.1 * fin;
        if (f < 1) {
          ctx.globalAlpha = 0.5 * (1 - f) * Math.min(1, f * 6); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
          ctx.beginPath(); ctx.moveTo(m.x + m.s / 2, m.y + m.s / 2); ctx.lineTo(x + s2 / 2, y + s2 / 2); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
        }
        const cr = cropOf(sp, lerp(CROP, 36, seg(p, t0 + FLY, 1)));
        ctx.save(); ctx.globalAlpha = dim; rrect(ctx, x, y, s2, s2, rr); ctx.clip();
        ctx.fillStyle = '#1c1c1e'; ctx.fillRect(x, y, s2, s2);
        if (imgs[k].complete && imgs[k].naturalWidth) ctx.drawImage(imgs[k], cr.x0, cr.y0, cr.s, cr.s, x, y, s2, s2);
        const gxx = x + s2 * cr.gx, gyy = y + s2 * cr.gy, kk = clamp(s2 / 22, 4, 10) * f;
        const cross = () => { ctx.beginPath(); ctx.moveTo(gxx - kk, gyy); ctx.lineTo(gxx + kk, gyy); ctx.moveTo(gxx, gyy - kk); ctx.lineTo(gxx, gyy + kk); ctx.stroke(); };
        ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = 3.2; cross(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; cross();
        ctx.restore();
        ctx.globalAlpha = dim; ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.2; rrect(ctx, x, y, s2, s2, rr); ctx.stroke();
        if (ring > 0) {
          const vc = sp.ok[k] ? GREEN : RED, per = 4 * s2;
          ctx.strokeStyle = vc; ctx.lineWidth = small ? 2.4 : 3; ctx.setLineDash([per * ring, per * 2]); rrect(ctx, x, y, s2, s2, rr); ctx.stroke(); ctx.setLineDash([]);
          const v = seg(ring, 0.55, 1);
          if (v > 0) {
            const R0 = clamp(cell / 13, 9, 15), Rb = R0 * (1 + 0.35 * Math.sin(Math.PI * v)) * Math.min(1, v * 1.6), bx = x + s2 - R0 - 7, byy = y + R0 + 7, q = Rb / 14;
            ctx.fillStyle = vc; ctx.beginPath(); ctx.arc(bx, byy, Rb, 0, 7); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.6 * q; ctx.beginPath();
            if (sp.ok[k]) { ctx.moveTo(bx - 6 * q, byy); ctx.lineTo(bx - 1.5 * q, byy + 5 * q); ctx.lineTo(bx + 6.5 * q, byy - 5 * q); }
            else { ctx.moveTo(bx - 5 * q, byy - 5 * q); ctx.lineTo(bx + 5 * q, byy + 5 * q); ctx.moveTo(bx + 5 * q, byy - 5 * q); ctx.lineTo(bx - 5 * q, byy + 5 * q); }
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      });
    });
    const gridBottom = rowY(1) + cell, bottomNow = lerp(rowY(0) + cell, gridBottom, U[1]);
    if (fin > 0) {
      const x = colX(2) - 7, y = gy + 2, ww = Math.min(cell + 14, W - 2 - x), hh = gridBottom - gy + 5;
      ctx.save(); ctx.globalAlpha = fin; ctx.shadowColor = GREEN; ctx.shadowBlur = 14 + 14 * fin; ctx.strokeStyle = GREEN; ctx.lineWidth = 2.5; rrect(ctx, x, y, ww, hh, 18); ctx.stroke(); ctx.restore();
    }
    const eA = smooth(seg(p, 0.90, 0.93)), eN = smooth(seg(p, 0.90, 0.97));
    if (eA > 0) {
      const y = gridBottom + g.foot - 9;
      const wide = cell >= 190, lab = 'Mean 2D error ', fsv = g.fsHead;
      ERR.forEach((v, k) => {
        const val = `${(v * eN).toFixed(1)} px`, col = k === 2 ? GREEN : WHITE, xc = colX(k) + cell / 2;
        if (!wide) { text(val, xc, y, { size: fsv, weight: 700, color: col, align: 'center', alpha: eA }); return; }
        ctx.font = `500 ${fsv - 2}px ${FONT}`; const lw = ctx.measureText(lab).width; ctx.font = `700 ${fsv}px ${FONT}`; const vw = ctx.measureText(`${v.toFixed(1)} px`).width, x0 = xc - (lw + vw) / 2;
        text(lab, x0, y, { size: fsv - 2, weight: 500, color: MUTE, alpha: eA }); text(val, x0 + lw, y, { size: fsv, weight: 700, color: col, alpha: eA });
      });
    }
    {
      const a = smooth(seg(p, SPOTS[0].t[0] + FLY, SPOTS[0].t[0] + FLY + 0.04)), y = bottomNow + g.foot * eA + g.leg - 6, xm = gx + lerp(2 * cell + gap, 3 * cell + 2 * gap, U[2]) / 2;
      const room = Math.min(g.R.x1 - g.R.x0, 2 * Math.min(xm - g.R.x0, g.R.x1 - xm));
      const opts = cell >= 190 ? ['Each crop is centered on the ground truth (+). Color: prediction, gray: ground truth.', 'Crops centered on the ground truth (+), shown in gray.', '+ ground truth, shown in gray']
        : [eA > 0.5 ? 'Mean 2D error. Crops centered on the ground truth (+), in gray.' : 'Crops centered on the ground truth (+), shown in gray.', eA > 0.5 ? 'Mean 2D error · + ground truth, in gray' : '+ ground truth, shown in gray', '+ ground truth'];
      ctx.font = `500 13px ${FONT}`; const t = opts.find(s => ctx.measureText(s).width <= room) || opts[2];
      text(t, xm, y, { weight: 500, color: '#86868b', align: 'center', alpha: a });
    }
  }
  window.VDH_INSIGHT_FUSION = { enter: f => smooth(seg(f, 0, 0.06)), exit: f => smooth(seg(f, END, 1)), render, resize,
    holds: [0.18, 0.44, 0.70, 1].map(x => x * END), end: END };
})();
