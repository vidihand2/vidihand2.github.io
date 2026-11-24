'use strict';
window.vq = url => {
  if (!url || !url.startsWith('assets/') || /[?&]v=/.test(url)) return url;
  const path = url.split('?')[0];
  const version = window.VDH_ASSET_VERSIONS?.[path] || document.querySelector('meta[name="build"]').content;
  return url + (url.includes('?') ? '&' : '?') + 'v=' + version;
};
window.VDH_LOAD = (() => {
  const tasks = [], holds = new Set();
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  let started = false, busy = false;
  function pump() {
    if (!started || busy || holds.size || saveData) return;
    const t = tasks.find(x => !x.done);
    if (!t) return;
    busy = true;
    const end = () => { t.done = true; busy = false; pump(); };
    let p; try { p = Promise.resolve(t.run()); } catch { p = Promise.resolve(); }
    p.then(end, end);
  }
  const add = (order, run) => { tasks.push({ order, run, done: false }); tasks.sort((a, b) => a.order - b.order); pump(); };
  const hold = p => { holds.add(p); const d = () => { holds.delete(p); pump(); }; Promise.resolve(p).then(d, d); };
  function mediaReady(v, keep) {
    return new Promise(res => {
      let done = false, suspended = false, end = -1, grew = performance.now(), fullSince = 0, kicked = false;
      const t0 = grew;
      const bufEnd = () => { try { const b = v.buffered; return b.length ? b.end(b.length - 1) : 0; } catch { return 0; } };
      const full = () => { try { const b = v.buffered; return v.duration > 0 && b.length > 0 && b.start(0) < 0.2 && b.end(b.length - 1) >= v.duration - 0.3; } catch { return false; } };
      const evs = ['loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough', 'progress', 'suspend', 'error'];
      const finish = () => { if (done) return; done = true; clearInterval(iv); evs.forEach(n => v.removeEventListener(n, check)); res(); };
      function check(e) {
        const now = performance.now(), b = bufEnd();
        if (e && e.type === 'progress') grew = now;
        if (b > end + 0.01) { end = b; grew = now; }
        if (e && e.type === 'suspend') suspended = true;
        const f = full(); fullSince = f ? fullSince || now : 0;
        if (v.error || (f && now - fullSince >= 450)) { finish(); return; }
        if (!keep && !kicked && v.paused && v.readyState >= 1 && b < 0.5 && now - grew > 3000) { kicked = true; grew = now; suspended = false; v.load(); return; }
        if ((suspended && now - grew > 4000) || now - grew > 15000 || now - t0 > 90000) finish();
      }
      const iv = setInterval(check, 150);
      evs.forEach(n => v.addEventListener(n, check)); check();
    });
  }
  const imgReady = im => new Promise(res => {
    if (!im || (im.complete && im.naturalWidth)) { res(); return; }
    const t = setTimeout(res, 20000), d = () => { clearTimeout(t); res(); };
    im.addEventListener('load', d, { once: true }); im.addEventListener('error', d, { once: true });
  });
  const start = () => { started = true; pump(); };
  if (document.readyState === 'complete') setTimeout(start, 0);
  else document.addEventListener('DOMContentLoaded', start, { once: true });

  const downloads = new WeakMap();
  const foreground = new Set();

  function stream(video) {
    if (!video.hasAttribute('src') && video.dataset.src) video.src = video.dataset.src;
    if (video.preload !== 'auto') {
      video.preload = 'auto';
      if (!video.readyState) video.load();
    }
  }

  function present(video) {
    const job = downloads.get(video);
    if (job?.cached) return Promise.resolve();
    const promise = warm(video, true);
    if (!foreground.has(promise)) {
      foreground.add(promise);
      hold(promise);
      promise.finally(() => foreground.delete(promise));
    }
    return promise;
  }

  async function download(job) {
    const {video} = job;
    const parts = [];
    let received = 0;
    const controller = new AbortController();
    let timer;
    const reset = () => { clearTimeout(timer); timer = setTimeout(() => controller.abort(), 20000); };
    try {
      reset();
      const response = await fetch(video.dataset.src || video.getAttribute('src'), {
        signal: controller.signal, cache: 'force-cache',
        priority: job.foreground ? 'high' : 'low'
      });
      if (response.status !== 200) throw new Error('HTTP ' + response.status);
      const expected = Number(response.headers.get('Content-Length')) || 0;
      if (response.body?.getReader) {
        const reader = response.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          parts.push(value); received += value.length; reset();
        }
      } else {
        const body = await response.blob();
        parts.push(body); received += body.size;
      }
      if (expected && received !== expected) throw new Error('Incomplete MP4');
      const blob = new Blob(parts, { type: 'video/mp4' });
      const signature = new Uint8Array(await blob.slice(4, 8).arrayBuffer());
      if (String.fromCharCode(...signature) !== 'ftyp') throw new Error('Invalid MP4');
      if (video.paused && !video.played.length) {
        video.src = URL.createObjectURL(blob);
        video.preload = 'metadata';
        job.cached = true;
      }
    } catch {
      downloads.delete(video);
      stream(video);
    } finally {
      clearTimeout(timer);
    }
  }

  function warm(video, requested = false) {
    const existing = downloads.get(video);
    if (existing) return existing.promise;
    if (!video.paused || video.played.length || video.preload === 'auto') {
      return requested ? Promise.resolve() : mediaReady(video, true);
    }
    const job = { video, foreground: requested };
    downloads.set(video, job);
    job.promise = download(job);
    return job.promise;
  }
  function image(order, section, target, path) {
    const load = () => {
      if (!target.getAttribute('src')) target.src = vq(path);
      return imgReady(target);
    };
    add(order, load);
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); }
    }, { rootMargin: '75% 0px' });
    observer.observe(section);
  }
  return { add, hold, warm, present, image, mediaReady, imgReady };
})();
