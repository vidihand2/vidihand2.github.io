'use strict';
(() => {
  const { $, $$, clamp, lerp, smooth, reduce, makeVideo, fitCanvas, LOAD } = window.VDHStory;
  const sec = $('#highlights'); if (!sec) return;
  const view = $('#hl-scroller'), track = $('.hl-track', sec), cards = $$('.hl-card', sec), dotsEl = $('#hl-dots'), play = $('#hl-play');
  const CAP = 5, N = cards.length;
  let cur = 0, inView = false, seen = false, settled = true, slideT = 0;
  const tileOf = v => v.split(',').map(Number);
  const items = cards.map((card, i) => {
    const L = tileOf(card.dataset.l), R = tileOf(card.dataset.r);
    const v = makeVideo(card.dataset.src); v.loop = false;
    v.defaultMuted = true; v.className = 'hl-source'; v.setAttribute('aria-hidden', 'true'); card.prepend(v);
    const c = $('canvas', card), handle = $('.hl-handle', card);
    const it = { card, v, c, x: 0.5, user: false, sweep: 0, want: false, ended: false, ready: false, live: false, seq: 0 };
    const poster = new Image(); it.poster = poster; poster.onload = () => it.paint();
    const bx = Math.min(L[0], R[0]), by = Math.min(L[1], R[1]);
    const bw = Math.max(L[0] + L[2], R[0] + R[2]) - bx, bh = Math.max(L[1] + L[3], R[1] + R[3]) - by;
    let fc = null, fkey = null;
    const grab = () => {
      const pOK = poster.complete && poster.naturalWidth > 0, vOK = v.readyState >= 2;
      const src = vOK && (it.live || !pOK) ? v : pOK ? poster : null;
      if (!src) return false;
      const key = src === v ? `v${v.currentTime}` : 'p';
      if (key !== fkey) {
        if (!fc) { fc = document.createElement('canvas'); fc.width = bw; fc.height = bh; }
        fc.getContext('2d').drawImage(src, bx, by, bw, bh, 0, 0, bw, bh); fkey = key;
      }
      return true;
    };
    it.paint = () => {
      if (!grab()) return;
      const [w, h] = fitCanvas(c), ctx = c.getContext('2d'), cut = Math.round(it.x * w);
      const a = w / h; let [sx, sy, sw, sh] = L;
      if (sw / sh > a) { const nw = sh * a; sx += (sw - nw) / 2; sw = nw; } else { const nh = sw / a; sy += (sh - nh) / 2; sh = nh; }
      sx -= bx; sy -= by;
      const dx = R[0] - L[0], dy = R[1] - L[1];
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, cut, h); ctx.clip(); ctx.drawImage(fc, sx, sy, sw, sh, 0, 0, w, h); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(cut, 0, w - cut, h); ctx.clip(); ctx.drawImage(fc, sx + dx, sy + dy, sw, sh, 0, 0, w, h); ctx.restore();
    };
    it.setX = x => { it.x = clamp(x, 0.02, 0.98); handle.style.transform = `translate3d(${(it.x * card.clientWidth).toFixed(1)}px,0,0)`; it.paint(); };
    v.addEventListener('loadeddata', () => { it.paint(); if (i === cur) setButton(); });
    v.addEventListener('playing', () => { if (i === cur) setButton(); });
    v.addEventListener('seeked', it.paint);
    const finish = () => { if (i !== cur || it.ended || !it.ready) return; it.ended = true; it.want = false; v.pause(); it.paint(); sync(); };
    v.addEventListener('ended', finish);
    v.addEventListener('timeupdate', () => { if (i === cur && !v.paused && it.ready && v.currentTime > 0) { it.live = true; it.paint(); if (v.currentTime >= CAP) finish(); } });
    const loop = (now, frame) => {
      if (cur === i && !v.paused && it.ready) { if (frame || v.currentTime > 0) it.live = it.fed = true; it.paint(); if (v.currentTime >= CAP) finish(); }
      v.requestVideoFrameCallback ? v.requestVideoFrameCallback(loop) : requestAnimationFrame(loop);
    };
    v.requestVideoFrameCallback ? v.requestVideoFrameCallback(loop) : requestAnimationFrame(loop);
    it.setX(0.5);
    return it;
  });
  items.forEach((it, i) => LOAD.add(20 + i, () => {
    posterFor(it);
    return Promise.all([LOAD.warm(it.v), LOAD.imgReady(it.poster)]);
  }));
  dotsEl.innerHTML = cards.map((_, i) => `<button type="button" role="tab" aria-label="Highlight ${i + 1}" aria-selected="${i === 0}"><i></i></button>`).join('');
  const dots = $$('button', dotsEl), fills = dots.map(d => $('i', d));
  function posterFor(it) {
    if (!it.poster.src) it.poster.src = vq(it.card.dataset.src.split('?')[0].replace('.mp4', '.jpg'));
  }

  const setButton = () => {
    const it = items[cur], s = it.ended ? 'Replay' : it.want ? 'Pause' : 'Play';
    play.setAttribute('aria-busy', String(inView && it.want && !it.ended && (it.starting || it.v.readyState < 2)));
    play.classList.toggle('paused', s === 'Play'); play.classList.toggle('replay', s === 'Replay');
    if (play.getAttribute('aria-label') !== s) play.setAttribute('aria-label', s);
  };
  function sync() {
    const it = items[cur], v = it.v;
    if (inView && settled && it.ready && it.want && !it.ended) {
      if (v.paused && !it.starting) {
        const seq = it.seq;
        it.starting = true;
        const start = () => {
          if (seq !== it.seq || it !== items[cur] || !inView || !settled || !it.want) return;
          const playback = v.play();
          kick(it);
          return playback;
        };
        const playback = v.getAttribute('src') ? start() : LOAD.present(v).then(start);
        Promise.resolve(playback).catch(error => {
          if (error.name === 'NotAllowedError' && seq === it.seq && it === items[cur]) {
            it.blocked = true;
            it.want = false;
          }
        }).finally(() => { if (seq === it.seq) { it.starting = false; setButton(); } });
      }
    } else if (!v.paused) v.pause();
    setButton(); fill();
  }
  function kick(it) {
    const v = it.v, id = it.seq; it.fed = false;
    (function k() {
      if (id !== it.seq || it.fed || it !== items[cur] || v.paused) return;
      if (v.currentTime > 0) { it.live = true; it.paint(); }
      requestAnimationFrame(k);
    })();
  }
  function prime(it) {
    const v = it.v, id = ++it.seq; it.starting = false; it.ready = false; it.live = false; it.ended = false; v.pause();
    const seek0 = () => { try { if (v.readyState >= 1 && !v.seeking && v.currentTime !== 0) v.currentTime = 0; } catch { } };
    seek0(); it.paint();
    const evs = ['seeked', 'loadeddata', 'canplay'];
    (function wait() {
      evs.forEach(n => v.removeEventListener(n, wait));
      if (id !== it.seq) return;
      if (!v.seeking && v.currentTime === 0) { it.ready = true; it.paint(); if (it === items[cur]) sync(); return; }
      seek0(); evs.forEach(n => v.addEventListener(n, wait));
    })();
  }
  function sweep(it) {
    if (reduce) return;
    const s0 = performance.now(), id = ++it.sweep;
    (function st(now) {
      if (it.user || id !== it.sweep) return;
      const t = (now - s0) / 2600; if (t > 1) { it.setX(0.5); return; }
      it.setX(0.5 + 0.36 * Math.sin(t * Math.PI * 2) * (1 - t * 0.3)); requestAnimationFrame(st);
    })(s0);
  }
  function centre(it) {
    const id = ++it.sweep, x0 = it.x, s0 = performance.now(); if (it.user || Math.abs(x0 - 0.5) < 1e-3) return;
    (function st(now) {
      if (it.user || id !== it.sweep) return;
      const t = clamp((now - s0) / 260); it.setX(lerp(x0, 0.5, smooth(t))); if (t < 1) requestAnimationFrame(st);
    })(s0);
  }

  const offsetOf = i => items[i].card.offsetLeft - items[0].card.offsetLeft;
  const band = d => clamp(d, offsetOf(cur) - offsetOf(N - 1), offsetOf(cur));
  function place(dx = 0, animate = true) {
    track.classList.toggle('dragging', !animate);
    track.style.transform = `translate3d(${-offsetOf(cur) + dx}px,0,0)`;
  }
  const settle = () => { clearTimeout(slideT); if (!settled) { settled = true; sync(); } };
  track.addEventListener('transitionend', e => { if (e.target === track && e.propertyName === 'transform') settle(); });
  function slide() {
    clearTimeout(slideT);
    const from = new DOMMatrixReadOnly(getComputedStyle(track).transform).m41;
    place();
    const dur = parseFloat(getComputedStyle(track).transitionDuration) || 0;
    if (Math.abs(from + offsetOf(cur)) < 1 || !dur) { settled = true; return; }
    settled = false; slideT = setTimeout(settle, dur * 1000 + 150);
  }
  function show(i) {
    const prev = cur; cur = i;
    items.forEach((it, k) => it.card.classList.toggle('on', k === cur));
    dots.forEach((d, k) => { d.setAttribute('aria-selected', String(k === cur)); fills[k].style.width = '0%'; });
    if (prev !== cur) { const o = items[prev]; o.want = false; o.sweep++; o.user = false; prime(o); o.setX(0.5); }
    const it = items[cur]; if (inView) posterFor(it);
    it.blocked = false; it.want = true; it.user = false; it.setX(0.5);
    slide(); prime(it);
    if (inView) sweep(it);
    sync();
  }
  const goTo = i => { i = clamp(i, 0, N - 1); if (i === cur) place(); else show(i); };

  play.addEventListener('click', () => {
    const it = items[cur];
    it.blocked = false;
    if (it.ended) { it.want = true; prime(it); }
    else { it.want = !it.want; if (!it.want) centre(it); }
    sync();
  });
  dotsEl.addEventListener('click', e => { const b = e.target.closest('button'); if (b) goTo(dots.indexOf(b)); });
  view.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); goTo(cur + (e.key === 'ArrowRight' ? 1 : -1)); }
  });
  let wAcc = 0, wTimer = 0;
  view.addEventListener('wheel', e => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    const w = band(wAcc - e.deltaX);
    if (w === wAcc && !wTimer) return;
    wAcc = w; place(wAcc, false);
    clearTimeout(wTimer);
    wTimer = setTimeout(() => {
      const step = cards[cur].offsetWidth + 20, n = -wAcc / step;
      const target = clamp(cur + (Math.abs(n) < 0.18 ? 0 : Math.sign(n) * Math.max(1, Math.round(Math.abs(n)))), 0, N - 1);
      wAcc = 0; wTimer = 0; goTo(target);
    }, 120);
  }, { passive: false });
  cards.forEach((card, i) => {
    const it = items[i];
    const xr = e => { const r = it.c.getBoundingClientRect(); return (e.clientX - r.left) / r.width; };
    let mode = null, x0 = 0, dx = 0;
    card.addEventListener('pointerdown', e => {
      if (i !== cur) return;
      const r = it.c.getBoundingClientRect(), nearLine = Math.abs(e.clientX - (r.left + it.x * r.width)) < 44;
      mode = e.pointerType === 'mouse' || nearLine ? 'divider' : 'swipe'; x0 = e.clientX; dx = 0;
      try { card.setPointerCapture(e.pointerId); } catch { }
      if (mode === 'divider') { it.user = true; it.setX(xr(e)); }
    });
    card.addEventListener('pointermove', e => {
      if (i !== cur) return;
      if (mode === 'divider') { it.user = true; it.setX(xr(e)); }
      else if (mode === 'swipe') { dx = band(e.clientX - x0); place(dx, false); }
      else if (e.pointerType === 'mouse') { const r = it.c.getBoundingClientRect(); card.classList.toggle('near-line', Math.abs(e.clientX - (r.left + it.x * r.width)) < 30); }
    });
    const up = () => {
      if (mode === 'swipe') goTo(cur + (dx < -50 ? 1 : dx > 50 ? -1 : 0));
      mode = null;
    };
    card.addEventListener('pointerup', up); card.addEventListener('pointercancel', up);
    card.addEventListener('click', () => { if (i !== cur) goTo(i); });
  });
  let visible = false;
  function visibility() {
    const entering = !inView && visible && !document.hidden;
    inView = visible && !document.hidden;
    const it = items[cur];
    if (entering) {
      items.forEach(posterFor);
      if (it.blocked) { it.blocked = false; it.want = true; }
      if (it.ended) { it.want = true; prime(it); }
      if (!seen) { seen = true; sweep(it); }
    }
    sync();
  }
  new IntersectionObserver(entries => {
    const e = entries[entries.length - 1];
    visible = e.isIntersecting && e.intersectionRatio >= 0.5;
    visibility();
  }, { threshold: [0, 0.5] }).observe(view);
  document.addEventListener('visibilitychange', visibility);
  function fill() {
    const it = items[cur], v = it.v;
    const w = `${((it.ended ? 1 : it.ready && v.duration ? clamp(v.currentTime / Math.min(v.duration, CAP)) : 0) * 100).toFixed(1)}%`;
    if (fills[cur].style.width !== w) fills[cur].style.width = w;
  }
  (function tick() { fill(); requestAnimationFrame(tick); })();
  addEventListener('resize', () => { place(0, false); items.forEach(it => it.paint()); requestAnimationFrame(() => track.classList.remove('dragging')); });
  show(0);
})();
