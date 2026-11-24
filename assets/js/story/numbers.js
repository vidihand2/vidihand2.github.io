'use strict';
(() => {
  const { $$, clamp, reduce } = window.VDHStory;
  const els = $$('[data-count]'); if (!els.length) return;
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; io.unobserve(e.target);
    const el = e.target, to = parseFloat(el.dataset.count), dec = parseInt(el.dataset.dec || '0', 10);
    if (reduce) { el.textContent = to.toFixed(dec); return; }
    const t0 = performance.now(), dur = 700;
    (function step(now) {
      const t = clamp((now - t0) / dur), v = to * (1 - Math.pow(1 - t, 3));
      el.textContent = v.toFixed(dec); if (t < 1) requestAnimationFrame(step);
    })(t0);
  }), { threshold: 0.2 });
  els.forEach(el => io.observe(el));
})();
