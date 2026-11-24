'use strict';
(() => {
  const D = window.VIDIHAND_AR; if (!D || !D.depth || !D.chunk_starts) return;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const smooth = t => t * t * (3 - 2 * t);
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const LOAD = window.VDH_LOAD;
  const sprite = new Image();
  sprite.onload = () => window.VDH_INSIGHT_REDRAW && window.VDH_INSIGHT_REDRAW();
  LOAD.image(45, document.querySelector('#st-idea'), sprite, 'assets/img/method/ar_strip.jpg');
  const GREEN = '#39ab38', RED = '#ff6b5e', WHITE = '#f5f5f7', MUTE = '#a1a1a6', DIM = '#86868b', BLOCK = '#2c2c2e';
  const F0 = D.f0, F1 = D.f1, ST = D.step, CS = D.chunk_starts, NSEG = CS.length, FPS = D.fps;
  const segA = i => Math.max(CS[i], F0), segB = i => Math.min(i + 1 < NSEG ? CS[i + 1] : CS[i] + D.chunk, F1 + 1);
  const ZO = D.depth.ours.L;
  const allz = ZO.filter(v => v != null), ZLO = Math.floor(Math.min(...allz) / 100) * 10, ZHI = Math.ceil(Math.max(...allz) / 100) * 10;
  const KZ = 14, ZA = CS[KZ], ZB = CS[KZ + 3];
  const NUM = D.numbers;
  const zAt = (arr, f) => { const fi = clamp((f - F0) / ST, 0, arr.length - 1), i = Math.floor(fi), a = arr[i], b = arr[Math.min(arr.length - 1, i + 1)]; return a == null || b == null ? null : lerp(a, b, fi - i); };
  const E = q => smooth(seg(q, 0, 0.08));
  const M = q => [smooth(seg(q, 0.38, 0.46)), smooth(seg(q, 0.72, 0.80))];
  const PROC = [[0.48, 0.54], [0.58, 0.64], [0.68, 0.72]], PASS = [[0.54, 0.58], [0.64, 0.68]];
  const mmss = f => { const s = Math.round((f - F0) / FPS); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  let G = null;

  function resize(env) {
    const L = env.L, { W, H, fs, mode } = L, c = L.chart;
    const g = { fs, fsS: Math.max(13, fs - 2), narrow: mode !== 'desk' };
    if (mode === 'desk') { g.x0 = L.side.x + 40; g.x1 = c.x + c.w; g.y0 = c.y; g.y1 = 0.94 * H; }
    else { g.x0 = 38; g.x1 = W - 12; g.y0 = L.safeTop + 3.4 * fs; g.y1 = H - 6; }
    g.from = { x: c.x, y: c.y, w: c.w, h: c.h };
    G = g;
  }

  function render(q, env) {
    const { ctx, L, FONT, rrect } = env, { W, H, d } = L, g = G;
    const e = E(q), [m1, m3] = M(q);
    if (e < 1) { env.base(); ctx.setTransform(d, 0, 0, d, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = `rgba(0,0,0,${e.toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const text = (t, x, y, { size = g.fsS, weight = 500, color = MUTE, align = 'left', alpha = 1 } = {}) => {
      if (alpha <= 0.01) return 0; ctx.font = `${weight} ${size}px ${FONT}`; const w = ctx.measureText(t).width;
      ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y); ctx.globalAlpha = 1;
      return w;
    };
    const line = (x0, y0, x1, y1, col, lw, a = 1, dash) => { if (a <= 0.01) return; ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = lw; if (dash) ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); if (dash) ctx.setLineDash([]); ctx.globalAlpha = 1; };
    const fs = g.fs, fsS = g.fsS, Rh = g.y1 - g.y0, A = e * (1 - m3);

    if (A > 0.005) {
      const hC = lerp(g.narrow ? 0.46 : 0.52, g.narrow ? 0.3 : 0.36, m1) * Rh, T = { x: g.x0, y: g.y0, w: g.x1 - g.x0, h: hC }, fr = g.from;
      const B = e < 1 ? { x: lerp(fr.x, T.x, e), y: lerp(fr.y, T.y, e), w: lerp(fr.w, T.w, e), h: lerp(fr.h, T.h, e) } : T;
      const pad = 0.04 * (ZB - ZA), fa = lerp(F0, ZA - pad, m1), fb = lerp(F1, ZB + pad, m1);
      const X = f => B.x + (f - fa) / (fb - fa) * B.w, Y = mm => B.y + B.h - (mm / 10 - ZLO) / (ZHI - ZLO) * B.h;
      const head = lerp(F0, F1, seg(q, 0.07, 0.36)), headOn = q >= 0.06 ? 1 - m1 : 0;
      ctx.globalAlpha = A; ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
      for (let z = ZLO; z <= ZHI + 1e-6; z += 10) { const y = Y(z * 10); ctx.beginPath(); ctx.moveTo(B.x, y); ctx.lineTo(B.x + B.w, y); ctx.stroke(); }
      ctx.globalAlpha = 1;
      line(B.x, B.y, B.x, B.y + B.h, '#8e8e93', 1, A); line(B.x, B.y + B.h, B.x + B.w, B.y + B.h, '#8e8e93', 1, A);
      for (let z = ZLO; z <= ZHI + 1e-6; z += 10) text(`${z}`, B.x - 8, Y(z * 10) + 0.36 * fsS, { align: 'right', color: '#8e8e93', alpha: A * (z === ZLO && B.h < 90 ? 0 : 1) });
      text('cm', B.x - 8, B.y - 0.5 * fsS, { align: 'right', color: '#8e8e93', alpha: A });
      const tA = A * smooth(seg(e, 0.5, 1)), ty = B.y - (g.narrow ? 2.05 : 1.0) * fs;
      text('Wrist depth over a 60 s video', B.x + (g.narrow ? 0 : 14), ty, { size: fs, weight: 600, color: '#d2d2d7', alpha: tA });
      {
        const ky = g.narrow ? B.y - 0.62 * fs : ty; ctx.font = `600 ${fsS}px ${FONT}`; const w = ctx.measureText('ViDiHand2').width + 22, x = g.narrow ? B.x : B.x + B.w - w;
        line(x, ky - 0.32 * fsS, x + 16, ky - 0.32 * fsS, GREEN, 2.4, tA); text('ViDiHand2', x + 22, ky, { weight: 600, color: GREEN, alpha: tA });
      }
      const yT = B.y + B.h + 8, segW1 = B.w / NSEG, hT = lerp(clamp(segW1 / 1.2, 20, 60), Math.min(0.2 * Rh, (B.w / 3.2) / 1.25), m1);
      const yLab = yT + hT + 1.25 * fsS;
      const yb0 = yT + hT + 14, hB = clamp(g.y1 - yb0 - 2, 44, 0.3 * Rh), yb1 = yb0 + hB;
      const bA = smooth(seg(q, 0.44, 0.49));
      const done = q < PROC[0][0] ? ZA : q >= PROC[2][1] ? ZB : PROC.reduce((f, [a, b], s) => (q >= a ? lerp(CS[KZ + s], CS[KZ + s + 1], seg(q, a, b)) : f), ZA);
      ctx.save(); ctx.beginPath(); ctx.rect(B.x - 1, 0, B.w + 2, H); ctx.clip();
      for (let i = 1; i < NSEG; i++) {
        const f = CS[i], x = X(f); if (x < B.x - 2 || x > B.x + B.w + 2) continue;
        line(x, B.y, x, lerp(yT + hT, yb1, bA), '#8e8e93', 1, smooth(seg(head, f - 8, f + 8)) * A * 0.6, [3, 4]);
      }
      const curve = (to, col, lw, a) => {
        ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); let st = false;
        const i0 = Math.max(0, Math.floor((fa - F0) / ST) - 1), i1 = Math.min(ZO.length - 1, Math.ceil((Math.min(fb, to) - F0) / ST));
        for (let i = i0; i <= i1; i++) { const f = F0 + i * ST; if (ZO[i] == null || f > to) { st = false; continue; } const x = X(f), y = Y(ZO[i]); st ? ctx.lineTo(x, y) : ctx.moveTo(x, y); st = true; }
        const zh = zAt(ZO, to); if (st && zh != null) ctx.lineTo(X(to), Y(zh));
        ctx.stroke(); ctx.globalAlpha = 1;
      };
      const dimC = smooth(seg(q, 0.45, 0.49));
      curve(head, GREEN, 2.2, A * lerp(1, 0.3, dimC));
      if (dimC > 0 && done > ZA) curve(done, GREEN, 3, A * dimC);
      for (let i = 0; i < NSEG; i++) {
        const xa = X(segA(i)), xb = X(segB(i)); if (xb < B.x - 2 || xa > B.x + B.w + 2) continue;
        const t0 = 0.004 + 0.055 * i / NSEG, a = smooth(seg(q, t0, t0 + 0.018)) * A * lerp(0.3, 1, smooth(seg(head, segA(i) - 10, segA(i) + 24)));
        if (a <= 0.01) continue;
        const w = xb - xa - 2, tw = Math.min(w, hT * 160 / 133), tx = (xa + xb) / 2 - tw / 2, r = clamp(hT / 9, 2, 8);
        ctx.globalAlpha = a; ctx.fillStyle = '#1c1c1e'; rrect(ctx, xa + 1, yT, w, hT, r); ctx.fill();
        if (sprite.complete && sprite.naturalWidth) {
          const [sw, sh] = D.thumbs.tile, sx = (i % D.thumbs.cols) * sw, sy = Math.floor(i / D.thumbs.cols) * sh, cw = Math.min(sw, sh * tw / hT), chh = Math.min(sh, sw * hT / tw);
          ctx.save(); rrect(ctx, tx, yT, tw, hT, r); ctx.clip(); ctx.drawImage(sprite, sx + (sw - cw) / 2, sy + (sh - chh) / 2, cw, chh, tx, yT, tw, hT); ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      if (headOn > 0.01) {
        const x = X(head), zh = zAt(ZO, head), a = A * headOn;
        line(x, B.y, x, yT + hT, 'rgba(255,255,255,0.45)', 1, a);
        if (zh != null) { ctx.globalAlpha = a; ctx.fillStyle = GREEN; ctx.beginPath(); ctx.arc(x, Y(zh), 4.5, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
        let ci = 0; for (let i = 0; i < NSEG; i++) if (CS[i] <= head) ci = i;
        const xa = X(segA(ci)), xb = X(segB(ci)), yb = B.y + 9;
        line(xa + 1, yb, xb - 1, yb, WHITE, 2, a); line(xa + 1, yb - 4, xa + 1, yb + 4, WHITE, 2, a); line(xb - 1, yb - 4, xb - 1, yb + 4, WHITE, 2, a);
        const lab = `${D.chunk / D.latent} latent frames · ${D.chunk} video frames`;
        ctx.font = `600 ${fsS}px ${FONT}`; const lw = ctx.measureText(lab).width + 16, lx = clamp((xa + xb) / 2 - lw / 2, B.x + 4, B.x + B.w - lw - 2);
        ctx.globalAlpha = a; ctx.fillStyle = 'rgba(0,0,0,0.7)'; rrect(ctx, lx, yb + 8, lw, fsS * 1.3 + 6, 7); ctx.fill(); ctx.globalAlpha = 1;
        text(lab, lx + 8, yb + 8 + fsS * 1.05 + 2, { weight: 600, color: WHITE, alpha: a });
      }
      [0, 15, 30, 45, 60].forEach(s => text(`0:${String(s).padStart(2, '0')}`.replace('0:60', '1:00'), clamp(X(F0 + s * FPS), B.x, B.x + B.w), yLab, { align: s === 0 ? 'left' : s === 60 ? 'right' : 'center', color: '#8e8e93', alpha: A * (1 - m1) * (headOn > 0.5 && Math.abs(X(F0 + s * FPS) - X(head)) < 44 ? 0 : 1) }));
      if (headOn > 0.01) text(mmss(head), clamp(X(head), B.x + 14, B.x + B.w - 14), yLab, { align: 'center', weight: 700, color: WHITE, alpha: A * headOn });

      if (bA > 0.005) {
        const cx = s => (X(CS[KZ + s]) + X(CS[KZ + s + 1])) / 2, segW = X(CS[KZ + 1]) - X(CS[KZ]), bw = 0.66 * segW, gapW = segW - bw, rr = clamp(hB / 6, 8, 18), yc = (yb0 + yb1) / 2;
        const names = bw >= 110 ? ['chunk t − 1', 'chunk t', 'chunk t + 1'] : ['t − 1', 't', 't + 1'], fn = clamp(hB / 4.2, 13, 20);
        for (let s = 0; s < 3; s++) {
          const x = cx(s) - bw / 2, a = A * smooth(seg(bA, s * 0.15, 0.7 + s * 0.15)), f = seg(q, PROC[s][0], PROC[s][1]), rise = (1 - smooth(seg(bA, s * 0.15, 0.7 + s * 0.15))) * 14;
          ctx.globalAlpha = a; ctx.fillStyle = BLOCK; rrect(ctx, x, yb0 + rise, bw, hB, rr); ctx.fill();
          if (f > 0) { ctx.save(); rrect(ctx, x, yb0 + rise, bw, hB, rr); ctx.clip(); ctx.fillStyle = GREEN; ctx.fillRect(x, yb0, bw * f, hB); ctx.restore(); }
          ctx.globalAlpha = 1;
          text(names[s], cx(s), yc + rise + 0.36 * fn, { size: fn, weight: 700, color: f > 0.55 ? '#000' : WHITE, align: 'center', alpha: a });
        }
        for (let s = 0; s < 2; s++) {
          const f = ease(seg(q, PASS[s][0], PASS[s][1])); if (f <= 0) continue;
          const xa = cx(s) + bw / 2, xb = cx(s + 1) - bw / 2, wide = gapW >= 84, tw = wide ? 62 : clamp(gapW * 0.4, 10, 22), th = wide ? 28 : tw;
          const tx = lerp(xa + 3, xb - tw - 3, f), tyy = yc - th / 2 - Math.sin(Math.PI * f) * 0.35 * th, vis = smooth(seg(f, 0, 0.15)) * (1 - smooth(seg(f, 0.9, 1)));
          line(xa + 2, yc, lerp(xa + 2, xb - 3, f), yc, GREEN, 2.4, A);
          if (f >= 0.999) { ctx.globalAlpha = A; ctx.fillStyle = GREEN; ctx.beginPath(); ctx.moveTo(xb, yc); ctx.lineTo(xb - 9, yc - 6); ctx.lineTo(xb - 9, yc + 6); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
          ctx.globalAlpha = A * vis; ctx.fillStyle = WHITE; rrect(ctx, tx, tyy, tw, th, th / 2); ctx.fill(); ctx.globalAlpha = 1;
          if (wide) text('cache', tx + tw / 2, tyy + th / 2 + 0.36 * 13, { size: 13, weight: 700, color: '#000', align: 'center', alpha: A * vis });
        }
        for (let s = 1; s < 3; s++) {
          const f = CS[KZ + s], z = zAt(ZO, f), a = A * smooth(seg(done, f, f + 12)); if (z == null || a <= 0.01) continue;
          const pulse = Math.sin(Math.PI * seg(done, f, f + 40));
          ctx.globalAlpha = a; ctx.strokeStyle = WHITE; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(f), Y(z), 6 + 3 * pulse, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
        }
      }
    }

    if (m3 > 0.005) {
      const x0 = g.narrow ? 14 : g.x0, x1 = g.x1, w = x1 - x0, a = m3;
      const rows = [['In-domain', NUM.bj.in, NUM.mpjpe_abs_p.in], ['In the wild', NUM.bj.itw, NUM.mpjpe_abs_p.itw]], names = ['Independent chunks', 'Autoregressive'], cols = [RED, GREEN];
      const words = 'Boundary jitter: acceleration of wrist-relative joints over 3-frame windows that span two chunks. From the paper’s ablation.'.split(' ');
      ctx.font = `500 ${fsS}px ${FONT}`; const lines = []; let cur = '';
      words.forEach(wd => { const t = cur ? cur + ' ' + wd : wd; if (ctx.measureText(t).width > w && cur) { lines.push(cur); cur = wd; } else cur = t; }); lines.push(cur);
      if (lines.length > 1 && !lines[lines.length - 1].includes(' ')) { const pv = lines[lines.length - 2].split(' '), mv = pv.pop(); lines[lines.length - 2] = pv.join(' '); lines[lines.length - 1] = mv + ' ' + lines[lines.length - 1]; }
      const yTop = g.narrow ? L.safeTop + 6 : g.y0, RhR = g.y1 - yTop, head = 1.6 * fs + 0.9 * fsS, note = lines.length * 1.4 * fsS + 8;
      let bh = clamp(RhR * 0.085, 22, 54), fsG, fsV, gapb, grpH, gapG, tot;
      for (let k = 0; k < 12; k++) {
        fsG = clamp(bh * 0.5, fs + 2, 24); fsV = clamp(bh * 0.74, 17, 38); gapb = clamp(bh * 0.22, 5, 12); grpH = 1.5 * fsG + 2 * bh + gapb + 1.9 * fsS; gapG = clamp(RhR * 0.06, 10, 44);
        tot = head + 2 * grpH + gapG + note; if (tot <= RhR || bh <= 16) break; bh -= 2;
      }
      const y0 = yTop + Math.max(0, (RhR - tot) / 2);
      text('Boundary jitter', x0, y0 + fs, { size: fs + 1, weight: 600, color: '#d2d2d7', alpha: a });
      { ctx.font = `600 ${fs + 1}px ${FONT}`; const tw = ctx.measureText('Boundary jitter  ').width; text('mm/frame², lower is better', x0 + tw, y0 + fs, { color: DIM, alpha: a }); }
      ctx.font = `700 ${fsV}px ${FONT}`; const valW = ctx.measureText('0.00').width + 14, track = w - valW, grow = ease(seg(q, 0.78, 0.90)), accA = smooth(seg(q, 0.88, 0.95)) * a;
      rows.forEach(([nm, bj, acc], r) => {
        const gy = y0 + head + r * (grpH + gapG);
        text(nm, x0, gy + fsG, { size: fsG, weight: 700, color: WHITE, alpha: a });
        bj.forEach((v, k) => {
          const y = gy + 1.5 * fsG + k * (bh + gapb), len = Math.max(bh, track * v / 1.5 * grow);
          ctx.globalAlpha = a; ctx.fillStyle = '#1c1c1e'; rrect(ctx, x0, y, track, bh, bh / 2); ctx.fill(); ctx.fillStyle = cols[k]; rrect(ctx, x0, y, len, bh, bh / 2); ctx.fill(); ctx.globalAlpha = 1;
          { const fn = clamp(bh * 0.4, 13, 17); ctx.font = `600 ${fn}px ${FONT}`; if (ctx.measureText(names[k]).width + 2 * fn < len) text(names[k], x0 + fn, y + bh / 2 + 0.36 * fn, { size: fn, weight: 600, color: '#000', alpha: a * smooth(seg(grow, 0.3, 0.6)) }); }
          text((v * grow).toFixed(2), x0 + len + 10, y + bh / 2 + 0.36 * fsV, { size: fsV, weight: 700, color: cols[k], alpha: a });
        });
        const yA = gy + 1.5 * fsG + 2 * bh + gapb + 1.35 * fsS;
        const tw = text('MPJPE-abs-p  ', x0, yA, { color: DIM, alpha: accA }), t2 = text(`${acc[0].toFixed(2)} mm`, x0 + tw, yA, { weight: 600, color: MUTE, alpha: accA });
        const t3 = text('  →  ', x0 + tw + t2, yA, { color: DIM, alpha: accA }); text(`${acc[1].toFixed(2)} mm`, x0 + tw + t2 + t3, yA, { weight: 600, color: GREEN, alpha: accA });
      });
      const na = smooth(seg(q, 0.92, 0.995)) * a;
      lines.forEach((ln, i) => text(ln, x0, y0 + head + 2 * grpH + gapG + (i + 1) * 1.4 * fsS, { color: DIM, alpha: na }));
    }
  }

  window.VDH_INSIGHT_AR = { render, resize, holds: [0.36, 0.70, 1] };
})();
