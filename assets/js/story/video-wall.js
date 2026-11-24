'use strict';
(() => {
  const { $, clamp, lerp, seg, reduce, near, makeVideo, LOAD, startLoad, updaters } = window.VDHStory;
  const sec = $('#st-wall'); if (!sec) return;
  const holder = $('#wall-holder'), shade = $('.wall-shade', sec), copy = $('.wall-copy', sec), box = $('.sticky', sec);
  const v = makeVideo('assets/video/wall/grid-20x20.mp4', 'assets/video/wall/grid-20x20.jpg');
  v.className = 'wall-vid'; holder.appendChild(v);
  LOAD.add(31, () => { startLoad(v); return LOAD.mediaReady(v); });
  new IntersectionObserver((entries, observer) => {
    if (!entries.some(e => e.isIntersecting)) return;
    observer.disconnect();
    startLoad(v);
  }, { rootMargin: '200% 0px' }).observe(sec);
  let inView = false;
  function visibility() {
    if (inView && !document.hidden) { startLoad(v); v.play().catch(() => {}); }
    else v.pause();
  }
  new IntersectionObserver(entries => {
    inView = entries[entries.length - 1].isIntersecting;
    visibility();
  }).observe(sec);
  document.addEventListener('visibilitychange', visibility);
  function update() {
    const H = box.offsetHeight, r = sec.getBoundingClientRect(), t0 = H > innerHeight ? (innerHeight - H) / 2 : 0;
    const p = reduce ? 1 : clamp((t0 - r.top) / Math.max(1, r.height - H));
    const c = seg(p, 0.50, 0.80);
    shade.style.opacity = 0.62 * c; copy.style.opacity = c; copy.style.transform = `translateY(${(1 - c) * 40}px) scale(${lerp(0.96, 1, c)})`;
  }
  updaters.push(() => { if (near(sec)) update(); });
  update();
})();
