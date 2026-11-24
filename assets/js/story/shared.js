'use strict';
(() => {
  const { $, $$ } = window.VDHPage;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const smooth = t => t * t * (3 - 2 * t);
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const DPR = () => Math.min(2, window.devicePixelRatio || 1);
  const demoVisibility = { rootMargin: '0px 0px -15% 0px', threshold: 0 };
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FONT = '-apple-system, BlinkMacSystemFont, Inter, "Segoe UI", sans-serif';
  const PAL = name => ((((window.VIDIHAND_QUAL || {}).colors || {})[name]) || [])[1] || '#8e8e93';

  const near = el => { const r = el.getBoundingClientRect(); return r.bottom > -innerHeight && r.top < 2 * innerHeight; };
  function windowed(els, ranges, p, f = 0.05, dy = 26) {
    els.forEach((el, i) => {
      const [a, b] = ranges[i];
      const fin = a <= 0 ? 1 : seg(p, a, a + f), fout = b >= 1 ? 1 : 1 - seg(p, b - f, b);
      const o = smooth(Math.min(fin, fout));
      const y = p < (a + b) / 2 ? (1 - o) * dy : -(1 - o) * dy;
      el.style.opacity = o.toFixed(3); el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
      el.style.visibility = o < 0.002 ? 'hidden' : 'visible';
    });
  }
  function makeVideo(src, poster) {
    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    v.dataset.src = vq(src); if (poster) v.dataset.poster = vq(poster);
    return v;
  }
  function fitCanvas(c) {
    const r = c.getBoundingClientRect(), d = DPR();
    const w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return [w, h];
  }
  const LOAD = window.VDH_LOAD;
  const startLoad = v => {
    if (v.dataset.poster && !v.poster) v.poster = v.dataset.poster;
    if (!v.hasAttribute('src')) {
      v.preload = 'auto';
      v.src = v.dataset.src;
    }
  };

  const updaters = [];
  let ticking = false;
  function tick() { ticking = false; updaters.forEach(u => u()); }
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(tick); } };
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', request);

  window.VDHStory = { $, $$, clamp, lerp, smooth, seg, ease, DPR, demoVisibility, reduce, FONT, PAL, near, windowed, makeVideo, fitCanvas, LOAD, startLoad, updaters };
  request();
})();
