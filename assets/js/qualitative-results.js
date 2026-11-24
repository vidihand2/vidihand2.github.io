'use strict';
(() => {
  const { $, $$, esc, mc } = window.VDHPage;

  const Q = window.VIDIHAND_QUAL;
  const stage = $('#qual-stage');
  if (!Q || !stage) return;
  const N = Q.names, FAMILIES = Q.families;
  const setsEl = $('#qual-sets'), railEl = $('#qual-rail'), noteEl = $('#qual-note');
  const stripEl = $('#qual-strip'), player = $('#qual-player');
  const playBtn = $('#qp-play'), range = $('#qp-range'), timeEl = $('#qp-time'), speedBtn = $('#qp-speed'), viewEl = $('#qp-view');
  const mu = u => vq(u && Q.rev ? `${u}${u.includes('?') ? '&' : '?'}r=${Q.rev}` : u);
  Q.cases.forEach(c => { c.m = { id: c.id, url: c.video, c }; c.d = c.video3d ? { id: `${c.id}_3d`, url: c.video3d, c, three: true } : null; });

  const mkVideo = () => {
    const v = document.createElement('video');
    v.muted = true; v.loop = false; v.playsInline = true; v.preload = 'none';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');
    v.className = 'vsrc'; v.setAttribute('aria-hidden', 'true'); stage.parentNode.appendChild(v);
    return v;
  };
  const video = mkVideo();
  const video3 = mkVideo();
  video.addEventListener('ended', () => { if (video.loop) return; video.currentTime = 0; tryPlay(); });
  const poster = new Image(), poster3 = new Image();
  let noVideo = !video.canPlayType('video/mp4; codecs="hvc1.1.6.L150.B0"');
  const msg = document.createElement('p');
  msg.className = 'qual-nohevc'; msg.hidden = true; msg.setAttribute('role', 'status');
  stage.after(msg);
  function showNoVideo() {
    noVideo = true; stage.classList.remove('is-loading');
    msg.textContent = "This browser can't play these clips (HEVC). Try Safari, or Chrome or Edge on macOS or Windows."; msg.hidden = false;
    [playBtn, range, speedBtn].forEach(b => { b.disabled = true; });
    Object.values(clips).forEach(e => { if (e.ctrl) e.ctrl.abort(); });
    clear3(); setPoster();
  }
  function showLoadError() {
    stage.classList.remove('is-loading');
    msg.innerHTML = 'This clip didn\'t load. <button type="button" class="qual-retry">Try again</button>'; msg.hidden = false;
  }
  msg.addEventListener('click', e => { if (!e.target.closest('.qual-retry')) return; msg.hidden = true; netTries = 0; reload(); });

  const LOAD = window.VDH_LOAD;
  const clips = {};
  const clipOf = c => clips[c.id] || (clips[c.id] = { st: 'idle', got: 0, total: 0, rate: 0, tries: 0 });
  let queueOn = false, fetching = null, streaming = 0, active = false, artOn = false, netTries = 0, gotBytes = false;
  const tabOrder = () => Q.sets.flatMap(s => Q.cases.filter(c => c.set === s.id));
  const filesOf = c => (c.d ? [c.m, c.d] : [c.m]);
  function wanted() {
    const rest = tabOrder().filter(c => c !== cur);
    return [cur, ...rest.filter(c => clipOf(c).st !== 'stream'), ...rest.filter(c => clipOf(c).st === 'stream')].flatMap(filesOf);
  }
  const eta = e => (e.total && e.rate ? (e.total - e.got) / e.rate : Infinity);
  function railMark(c) {
    const b = railEl.querySelector(`[data-case="${c.id}"] .thumb`); if (!b) return;
    const d = c.d && clipOf(c.d).st === 'fetch' ? clipOf(c.d) : null, e = d || clipOf(c);
    const on = e.st === 'fetch' || (e.st === 'stream' && c === cur && e.total && e.got < e.total);
    b.classList.toggle('is-fetching', !!on); b.style.setProperty('--lp', e.total ? Math.min(1, e.got / e.total).toFixed(3) : '0');
  }
  async function fetchClip(it) {
    const c = it.c, e = clipOf(it); e.st = 'fetch'; e.got = 0; e.total = 0; e.rate = 0; e.aborted = false; e.ctrl = new AbortController(); fetching = it;
    const t0 = performance.now(); railMark(c);
    try {
      const r = await fetch(mu(it.url), { signal: e.ctrl.signal, cache: 'force-cache' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      if (/text|html|json|xml/i.test(r.headers.get('content-type') || '')) throw new Error('not a video');
      e.total = Number(r.headers.get('content-length')) || 0;
      let blob;
      if (r.body && r.body.getReader) {
        const rd = r.body.getReader(), parts = [];
        for (;;) {
          const { done, value } = await rd.read(); if (done) break;
          if (!parts.length && value.byteLength >= 8 && String.fromCharCode(...value.subarray(4, 8)) !== 'ftyp') throw new Error('not an MP4');
          parts.push(value); e.got += value.byteLength; e.rate = e.got / Math.max(0.05, (performance.now() - t0) / 1000);
          if (parts.length % 16 === 0) railMark(c);
        }
        blob = new Blob(parts, { type: 'video/mp4' });
      } else blob = await r.blob();
      e.url = URL.createObjectURL(blob); e.st = 'blob'; e.total = e.got = blob.size;
    } catch {
      if (!e.aborted) try { e.ctrl.abort(); } catch { }
      if (e.st === 'fetch') e.st = e.aborted ? 'idle' : (++e.tries >= 2 ? 'fail' : 'idle');
    }
    if (fetching === it) fetching = null;
    railMark(c);
    if (e.st === 'blob') {
      if (it.three) { }
      else if (c === cur && !video.getAttribute('src')) attach(c);
      else if (c === cur && video.getAttribute('src') === mu(c.video)) {
        const t = video.currentTime;
        setSrc(e.url, null);
        if (t > 0) video.addEventListener('loadedmetadata', () => { try { video.currentTime = t; } catch { } }, { once: true });
        tryPlay();
      }
    }
    want3();
    if (rescueLater) { const r = rescueLater; rescueLater = null; if (r === cur) rescue(r); }
    pump();
  }
  let finishPreload;
  function pump() {
    if (!queueOn || fetching || streaming) return;
    if (noVideo) { finishPreload?.(); return; }
    const it = wanted().find(x => { const s = clipOf(x).st; return s === 'idle' || (s === 'stream' && x.c !== cur); });
    if (it) fetchClip(it); else finishPreload?.();
  }
  function attach(c) {
    const e = clipOf(c);
    if (noVideo) return;
    if (e.st === 'blob') { setSrc(e.url, null); return; }
    if (!active) { clearSrc(); return; }
    if (e.st === 'fetch') {
      if (eta(e) < 8 || (e.total && e.got >= e.total / 2)) { clearSrc(); stage.classList.add('is-loading'); return; }
      e.aborted = true; e.ctrl.abort();
    }
    if (fetching && fetching !== c.m && eta(clipOf(fetching)) > 4) { const f = clipOf(fetching); f.aborted = true; f.ctrl.abort(); }
    e.st = 'stream'; setSrc(mu(c.video), c);
  }
  function clearSrc() { if (video.getAttribute('src')) { video.removeAttribute('src'); video.load(); } }
  function setSrc(url, streamOf) {
    gotBytes = /^blob:/.test(url);
    if (video.getAttribute('src') === url) return;
    video.preload = 'auto'; video.loop = !gotBytes; video.src = url; video.playbackRate = state.speed;
    if (!streamOf) return;
    const id = ++streaming, c = streamOf, e = clipOf(c);
    const prog = () => { try { const b = video.buffered; if (video.duration && b.length) { e.total = 1; e.got = Math.min(1, b.end(b.length - 1) / video.duration); railMark(c); } } catch { } };
    video.addEventListener('progress', prog);
    const p = LOAD.mediaReady(video, true);
    LOAD.hold(p);
    p.then(() => { video.removeEventListener('progress', prog); e.got = e.total; railMark(c); if (streaming === id) { streaming = 0; want3(); pump(); } });
  }
  function set3(url) { if (video3.getAttribute('src') !== url) { video3.preload = 'auto'; video3.src = url; video3.playbackRate = state.speed; } }
  function clear3() { if (video3.getAttribute('src')) { video3.removeAttribute('src'); video3.load(); } }
  function want3() {
    const c = cur;
    if (!c || !c.d || noVideo) { clear3(); return; }
    const e = clipOf(c.d);
    if (e.bad) { clear3(); return; }
    if (e.st === 'blob') { set3(e.url); return; }
    if (e.st === 'fail') { if (active) set3(mu(c.d.url)); else clear3(); return; }
    clear3();
    if (!active || e.st === 'fetch' || streaming || clipOf(c).st === 'fetch') return;
    if (fetching) { if (eta(clipOf(fetching)) <= 4) return; const f = clipOf(fetching); f.aborted = true; f.ctrl.abort(); }
    LOAD.hold(fetchClip(c.d));
  }
  video3.addEventListener('error', () => { if (cur && cur.d && video3.getAttribute('src')) { clipOf(cur.d).bad = true; clear3(); setPoster(); paint3(); } });
  const transfers = {};
  let rescueLater = null;
  function rescue(c) {
    const e = clipOf(c);
    if (e.st !== 'stream' || noVideo) return;
    if (fetching === c.d && c.d) { rescueLater = c; return; }
    if (fetching && fetching !== c.m) { const f = clipOf(fetching); f.aborted = true; f.ctrl.abort(); }
    LOAD.hold(fetchClip(c.m));
  }
  if (window.PerformanceObserver) try {
    new PerformanceObserver(list => list.getEntries().forEach(x => {
      if (x.initiatorType !== 'video' || !cur || clipOf(cur).st !== 'stream') return;
      const u = new URL(mu(cur.video), location.href).href;
      if (x.name === u && (transfers[u] = (transfers[u] || 0) + 1) >= 2) rescue(cur);
    })).observe({ type: 'resource', buffered: true });
  } catch { }
  function reload() {
    const t = video.currentTime, src = video.getAttribute('src');
    if (!src) { attach(cur); want3(); return; }
    stage.classList.add('is-loading');
    video.load();
    if (t > 0) video.addEventListener('loadedmetadata', () => { try { video.currentTime = t; } catch { } }, { once: true });
  }
  video.addEventListener('loadedmetadata', () => { gotBytes = true; netTries = 0; msg.hidden = true; });
  video.addEventListener('progress', () => { try { if (video.buffered.length) gotBytes = true; } catch { } });
  video.addEventListener('error', async () => {
    const err = video.error, src = video.getAttribute('src');
    if (!err || !src || noVideo) return;
    let codec = false;
    if (err.code >= 3) {
      codec = gotBytes;
      if (!codec) {
        try {
          const r = await fetch(src, { headers: { Range: 'bytes=0-11' }, cache: 'no-store' });
          const h = r.ok ? new Uint8Array(await r.arrayBuffer()).subarray(4, 8) : [];
          codec = String.fromCharCode(...h) === 'ftyp';
        }
        catch { codec = false; }
      }
    }
    if (src !== video.getAttribute('src')) return;
    if (codec) { showNoVideo(); clearSrc(); repaint(); return; }
    if (netTries < 2) { netTries += 1; setTimeout(() => { if (src === video.getAttribute('src')) reload(); }, 1500 * netTries); }
    else showLoadError();
  });

  const state = { set: Q.sets[0].id, left: null, view: 'mano', inView: false, userPaused: false, speed: 1 };
  const lastCase = {};
  let cur = null, panels = [], thumbs = [], seeking = false;
  if (noVideo) showNoVideo();
  const INSET0 = { x: 0.02, y: 0.03, w: 0.34 };
  let inset = { ...INSET0 };
  try { const saved = JSON.parse(localStorage.getItem('vidihand.inset') || 'null'); if (saved && saved.w > 0) inset = saved; } catch { }
  const applyInset = () => { stage.style.setProperty('--ix', inset.x); stage.style.setProperty('--iy', inset.y); stage.style.setProperty('--iw', inset.w); if (G.on) { G.layout = true; glSoon(); } };

  const has3d = () => !!(cur && cur.tiles.ours_3d);
  const slots = () => ['input', state.left, 'ours', ...(cur.tiles.gt ? ['gt'] : [])];
  const fmt = t => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = t - 60 * m; return `${m}:${s.toFixed(1).padStart(4, '0')}`; };
  const tileOf = (key, big) => {
    if (key === 'input' || !has3d()) return big ? key : null;
    const three = state.view === '3d';
    return big === three ? `${key}_3d` : key;
  };
  const is3 = key => key.endsWith('_3d');

  const mkCopy = () => ({ cv: null, ctx: null, tex: null, sw: 0, sh: 0, key: null, id: null, live: false });
  const F = mkCopy(), F3 = mkCopy();
  let thumbsSeen = true, thumbAt = 0, thumbCost = 0;
  const THUMB_MS = 200, THUMB_SHARE = 5;
  const c2d = cv => cv.c2d || (cv.c2d = cv.getContext('2d'));

  const G = { on: false, ctxLost: false, cv: null, gl: null, lost: 0, layout: true, boxes: [], n: 0, at: 0, dpr: 0, max: 0, soon: 0, fw: 0, fh: 0, ms: [] };
  const SHEET = { cols: 6, w: 264, h: 148 };
  const VS = `attribute vec2 aP; uniform vec4 uDst, uMap; uniform vec3 uView; varying vec2 vT, vP;
    void main() { vP = uDst.xy + aP * uDst.zw; vT = (vP - uMap.xy) / uMap.zw; gl_Position = vec4((vP * uView.xy - 1.0) * vec2(1.0, uView.z), 0.0, 1.0); }`;
  const FS = `precision highp float; uniform sampler2D uTex; uniform vec2 uInv, uTap; uniform vec4 uA, uAc, uB, uBc, uM, uMc, uCa, uCb, uFill; uniform float uMix, uRa, uRb;
    varying vec2 vT, vP;
    vec3 tile(vec2 t) {
      vec3 a = texture2D(uTex, clamp(uA.xy + t * uA.zw, uAc.xy, uAc.zw) * uInv).rgb;
      if (uMix < 0.5) return a;
      vec3 b = texture2D(uTex, clamp(uB.xy + t * uB.zw, uBc.xy, uBc.zw) * uInv).rgb;
      vec3 m = texture2D(uTex, clamp(uM.xy + t * uM.zw, uMc.xy, uMc.zw) * uInv).rgb;
      return mix(a, b, m);
    }
    float cov(vec4 b, float r) { vec2 q = abs(vP - b.xy) - b.zw + r; return clamp(0.5 - (min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r), 0.0, 1.0); }
    void main() {
      vec3 c = uFill.a > 0.5 ? uFill.rgb : uTap.x > 0.0
        ? 0.25 * (tile(vT + uTap * vec2(-1.0, -1.0)) + tile(vT + uTap * vec2(1.0, -1.0)) + tile(vT + uTap * vec2(-1.0, 1.0)) + tile(vT + uTap)) : tile(vT);
      float k = cov(uCa, uRa) * cov(uCb, uRb);
      gl_FragColor = vec4(c * k, k);
    }`;
  function glSetup() {
    const gl = G.gl;
    try {
      if (gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision < 23) return false;
      const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o) || 'shader'); return o; };
      const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.bindAttribLocation(pr, 0, 'aP'); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr) || 'link');
      gl.useProgram(pr);
      G.u = {}; ['uDst', 'uMap', 'uView', 'uTex', 'uInv', 'uTap', 'uA', 'uAc', 'uB', 'uBc', 'uM', 'uMc', 'uCa', 'uCb', 'uFill', 'uMix', 'uRa', 'uRb'].forEach(n => { G.u[n] = gl.getUniformLocation(pr, n); });
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1i(G.u.uTex, 0); gl.activeTexture(gl.TEXTURE0);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.disable(gl.DEPTH_TEST); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0, 0, 0, 0);
      const vd = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
      G.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE); G.max = Math.min(G.maxTex, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), vd[0], vd[1]);
      G.fbo = gl.createFramebuffer(); G.ftex = null; G.fw = G.fh = 0; G.pbo = null; G.pboSize = 0; G.pend = null; G.take = 0;
      F.tex = F3.tex = null;
      const e = gl.getError(); if (e) throw new Error(`GL error 0x${e.toString(16)}`);
      return true;
    } catch { return false; }
  }
  function glStart() {
    const cv = document.createElement('canvas'); cv.className = 'qgl'; cv.setAttribute('aria-hidden', 'true');
    const opt = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, failIfMajorPerformanceCaveat: true };
    let gl = null;
    try { gl = cv.getContext('webgl2', opt) || cv.getContext('webgl', opt) || cv.getContext('experimental-webgl', opt); } catch { }
    if (!gl) return;
    G.cv = cv; G.gl = gl; G.gl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    const css = document.createElement('style');
    css.textContent = '.stage.is-gl{position:relative}'
      + '.stage>canvas.qgl{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;color:var(--d-surface)}'
      + '.stage.is-gl .media{background:none;box-shadow:0 0 0 2px var(--black)}.stage.is-gl .inset-clip{background:none}';
    document.head.appendChild(css);
    cv.addEventListener('webglcontextlost', e => { e.preventDefault(); if (!G.on) return; G.lost += 1; glOff(true); repaint(); });
    cv.addEventListener('webglcontextrestored', () => { if (G.lost <= 2 && !G.on && G.ctxLost && glSetup()) { glOn(); repaint(); } });
    if (glSetup()) glOn();
  }
  function glOn() {
    G.on = true; G.ctxLost = false; G.layout = true;
    [F, F3].forEach(f => { if (f.cv) f.cv.width = f.cv.height = 0; f.cv = f.ctx = null; f.key = f.id = null; });
    panels.forEach(p => [p.main, p.inset].forEach(c => { if (c && c.c2d) c.c2d.clearRect(0, 0, c.width, c.height); }));
    stage.classList.add('is-gl'); if (stage.firstChild) stage.insertBefore(G.cv, stage.firstChild);
  }
  function glOff(ctxLost = false) {
    const gl = G.gl;
    G.on = false; G.ctxLost = ctxLost; G.pend = null;
    [F, F3].forEach(f => { if (f.tex && gl && !gl.isContextLost()) gl.deleteTexture(f.tex); f.tex = null; f.key = f.id = null; });
    stage.classList.remove('is-gl'); if (G.cv) G.cv.remove();
    setTimeout(() => { if (!G.on) { F.key = F3.key = null; repaint(); } }, 0);
  }
  function glDrop() { const gl = G.gl; [F, F3].forEach(f => { if (f.tex && gl) gl.deleteTexture(f.tex); f.tex = null; f.key = f.id = null; }); }
  function glUpload(f, src) {
    const gl = G.gl, w = src.videoWidth || src.naturalWidth, h = src.videoHeight || src.naturalHeight;
    if (Math.max(w, h) > G.maxTex) { glOff(); return false; }
    const fresh = !f.tex;
    try {
      if (fresh) {
        f.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, f.tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      } else gl.bindTexture(gl.TEXTURE_2D, f.tex);
      const t0 = performance.now();
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      if (src.videoWidth && !fresh) G.ms.push(performance.now() - t0);
    } catch { glOff(); return false; }
    f.sw = w; f.sh = h;
    if (G.ms.length >= 24) {
      const m = G.ms.sort((a, b) => a - b)[12]; G.ms = [];
      if (m > 16) { glOff(); return false; }
    }
    if (fresh || (G.n += 1) % 150 === 0) {
      const e = gl.getError();
      if (e && !gl.isContextLost()) { glOff(); return false; }
    }
    return !gl.isContextLost();
  }
  function glMeasure() {
    const cv = G.cv, dpr = window.devicePixelRatio || 1, ox = window.scrollX, oy = window.scrollY;
    let z = dpr;
    const m0 = panels[0] && panels[0].media, w0 = m0 && m0.dpw ? m0.dpw / (m0.getBoundingClientRect().width || 1) : 0;
    if (w0 && Math.abs(w0 - 1) < Math.abs(w0 - dpr)) z = 1;
    const sn = v => Math.round(v * z) * dpr / z;
    const dev = r => { const x = sn(r.left + ox), y = sn(r.top + oy); return [x, y, sn(r.right + ox) - x, sn(r.bottom + oy) - y]; };
    const S = dev(cv.getBoundingClientRect());
    const k = Math.min(1, G.max / Math.max(S[2], S[3], 1));
    const W = Math.max(1, Math.round(S[2] * k)), H = Math.max(1, Math.round(S[3] * k));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const rel = b => [(b[0] - S[0]) * k, (b[1] - S[1]) * k, b[2] * k, b[3] * k];
    const rgb = c => { const m = /rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(c || ''); return m ? [m[1] / 255, m[2] / 255, m[3] / 255] : [0.11, 0.11, 0.12]; };
    const bg = rgb(getComputedStyle(cv).color);
    G.boxes = panels.map(p => {
      const cs = getComputedStyle(p.media), r = p.media.getBoundingClientRect(), box = rel(dev(r));
      const o = { box, rad: (parseFloat(cs.borderTopLeftRadius) || 0) * dpr * k, pic: box, bg };
      if (getComputedStyle(p.main).objectFit === 'contain') {
        const a = cur.tile_w / cur.tile_h; let w = r.width, h = r.height;
        if (w / h > a) w = h * a; else h = w / a;
        const x = r.left + (r.width - w) / 2, y = r.top + (r.height - h) / 2;
        o.pic = rel(dev({ left: x, top: y, right: x + w, bottom: y + h }));
      }
      if (p.clip) { o.ins = rel(dev(p.clip.getBoundingClientRect())); o.irad = (parseFloat(getComputedStyle(p.clip).borderTopLeftRadius) || 0) * dpr * k; }
      return o;
    });
    G.dpr = dpr; G.layout = false; G.at = performance.now();
  }
  const cbox = (b, grow) => [b[0] + b[2] / 2, b[1] + b[3] / 2, b[2] / 2 + (grow || 0), b[3] / 2 + (grow || 0)];
  const ALL = [0, 0, 1e6, 1e6];
  function glTile(key, cover, pic, q, ca, ra, cb, rb, fill) {
    const gl = G.gl, u = G.u, t = key && cur.tiles[key];
    if (!t && !fill) return false;
    const three = !!t && is3(key), f = three ? F3 : F, has = !!t && f.id === cur.id && !!f.tex;
    if (!has && !fill) return false;
    const x0 = Math.floor(q[0]), y0 = Math.floor(q[1]);
    gl.uniform4f(u.uDst, x0, y0, Math.ceil(q[0] + q[2]) - x0, Math.ceil(q[1] + q[3]) - y0); gl.uniform4f(u.uMap, pic[0], pic[1], pic[2], pic[3]);
    gl.uniform4f(u.uCa, ca[0], ca[1], ca[2], ca[3]); gl.uniform1f(u.uRa, ra); gl.uniform4f(u.uCb, cb[0], cb[1], cb[2], cb[3]); gl.uniform1f(u.uRb, rb);
    if (!has) { gl.uniform4f(u.uFill, fill[0], fill[1], fill[2], 1); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); return true; }
    const tw = three ? cur.tile3d_w : cur.tile_w, th = three ? cur.tile3d_h : cur.tile_h;
    let cx = 0, cy = 0, cw = tw, ch = th;
    if (cover) { const a = pic[2] / pic[3]; if (cw / ch < a) { ch = cw / a; cy = (th - ch) / 2; } else { cw = ch * a; cx = (tw - cw) / 2; } }
    const mix = !three && key !== 'input' && f.live;
    gl.bindTexture(gl.TEXTURE_2D, f.tex);
    gl.uniform4f(u.uFill, 0, 0, 0, 0); gl.uniform2f(u.uInv, 1 / f.sw, 1 / f.sh); gl.uniform1f(u.uMix, mix ? 1 : 0);
    if (pic[2] / cw < 0.5) gl.uniform2f(u.uTap, 0.25 / pic[2], 0.25 / pic[3]); else gl.uniform2f(u.uTap, 0, 0);
    gl.uniform4f(u.uA, t.x + cx, t.y + cy, cw, ch); gl.uniform4f(u.uAc, t.x + 0.5, t.y + 0.5, t.x + tw - 0.5, t.y + th - 0.5);
    if (mix) {
      const i = cur.tiles.input, kx = cur.mask_w / cur.tile_w, ky = cur.mask_h / cur.tile_h;
      gl.uniform4f(u.uB, i.x + cx, i.y + cy, cw, ch); gl.uniform4f(u.uBc, i.x + 0.5, i.y + 0.5, i.x + tw - 0.5, i.y + th - 0.5);
      gl.uniform4f(u.uM, t.mx + cx * kx, t.my + cy * ky, cw * kx, ch * ky); gl.uniform4f(u.uMc, t.mx + 0.5, t.my + 0.5, t.mx + cur.mask_w - 0.5, t.my + cur.mask_h - 0.5);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return true;
  }
  function glDraw() {
    if (!G.on || !cur || !G.cv.isConnected) return;
    const gl = G.gl, u = G.u, cv = G.cv, now = performance.now();
    if (G.soon) { cancelAnimationFrame(G.soon); G.soon = 0; }
    if (G.layout || G.dpr !== (window.devicePixelRatio || 1) || now - G.at > 250) glMeasure();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cv.width, cv.height); gl.uniform3f(u.uView, 2 / cv.width, 2 / cv.height, -1);
    gl.enable(gl.BLEND); gl.clear(gl.COLOR_BUFFER_BIT);
    const grow = b => [b[0] - 1, b[1] - 1, b[2] + 2, b[3] + 2];
    panels.forEach((p, n) => {
      const b = G.boxes[n], a = tileOf(p.key, true), s = tileOf(p.key, false);
      if (!b) return;
      const box = cbox(b.box, 1), out = grow(b.box);
      glTile(null, false, b.box, out, box, b.rad + 1, ALL, 0, b.bg);
      if (a) {
        const e = b.pic, l = e[0] - b.box[0] < 0.01 ? 1 : 0, t = e[1] - b.box[1] < 0.01 ? 1 : 0;
        const r = b.box[0] + b.box[2] - e[0] - e[2] < 0.01 ? 1 : 0, d = b.box[1] + b.box[3] - e[1] - e[3] < 0.01 ? 1 : 0;
        const q = [e[0] - l, e[1] - t, e[2] + l + r, e[3] + t + d];
        glTile(a, false, e, q, box, b.rad + 1, cbox(q), 0, null);
      }
      if (s && p.inset && b.ins) glTile(s, false, b.ins, grow(b.ins), cbox(b.ins, 1), b.irad + 1, box, b.rad + 1, b.bg);
    });
  }
  function glSoon() { if (G.on && !G.soon) G.soon = requestAnimationFrame(() => { G.soon = 0; glDraw(); }); }
  const glRO = 'ResizeObserver' in window ? new ResizeObserver(es => {
    es.forEach(e => { const d = e.devicePixelContentBoxSize; if (d && d[0]) e.target.dpw = d[0].inlineSize; });
    G.layout = true; glDraw();
  }) : null;
  const glWatch = el => { try { glRO.observe(el, { box: 'device-pixel-content-box' }); } catch { glRO.observe(el); } };
  if (!glRO) addEventListener('resize', () => { G.layout = true; glSoon(); });
  function glTarget(w, h) {
    const gl = G.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, G.fbo);
    if (G.fw !== w || G.fh !== h) {
      if (G.ftex) gl.deleteTexture(G.ftex);
      G.ftex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, G.ftex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, G.ftex, 0);
      G.fw = w; G.fh = h; G.img = new ImageData(w, h); G.pix = new Uint8Array(G.img.data.buffer);
    }
    gl.viewport(0, 0, w, h); gl.uniform3f(G.u.uView, 2 / w, 2 / h, 1); gl.disable(gl.BLEND);
  }
  function glThumbs(three) {
    const gl = G.gl, W = SHEET.cols * SHEET.w, rows = Math.ceil(thumbs.length / SHEET.cols);
    if (!rows) return;
    if (G.pend) { G.pend.again = true; return; }
    glTarget(W, 3 * SHEET.h);
    const at = n => [(n % SHEET.cols) * SHEET.w, Math.floor(n / SHEET.cols) * SHEET.h, SHEET.w, SHEET.h];
    const done = thumbs.map((th, n) => glTile(three ? `${th.key}_3d` : th.key, true, at(n), at(n), ALL, 0, ALL, 0, null));
    if (done.some(Boolean)) {
      const H = rows * SHEET.h;
      if (G.gl2) {
        if (!G.pbo || G.pboSize !== W * H * 4) {
          G.pbo = G.pbo || gl.createBuffer(); G.pboSize = W * H * 4;
          gl.bindBuffer(gl.PIXEL_PACK_BUFFER, G.pbo); gl.bufferData(gl.PIXEL_PACK_BUFFER, G.pboSize, gl.STREAM_READ);
          G.simg = new ImageData(W, H); G.spix = new Uint8Array(G.simg.data.buffer);
        }
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, G.pbo);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, 0);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        G.pend = { sync: gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0), done, at, id: cur.id, three, n: thumbs.length, again: false, t: performance.now() };
        gl.flush();
        requestAnimationFrame(glThumbsTake);
      } else {
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, G.pix);
        thumbs.forEach((th, n) => { if (done[n]) { const b = at(n); th.ctx.putImageData(G.img, -b[0], -b[1], b[0], b[1], b[2], b[3]); } });
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  function glThumbsTake() {
    const p = G.pend, gl = G.gl;
    if (!p) return;
    if (!G.on || gl.isContextLost()) { G.pend = null; return; }
    const t0 = performance.now(), st = gl.clientWaitSync(p.sync, 0, 0);
    if (st === gl.TIMEOUT_EXPIRED && t0 - p.t < 500) { requestAnimationFrame(glThumbsTake); return; }
    G.pend = null; gl.deleteSync(p.sync);
    if (st !== gl.WAIT_FAILED && cur && cur.id === p.id && thumbs.length === p.n && p.three === (state.view === '3d' && has3d())) {
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, G.pbo); gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, G.spix); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      thumbs.forEach((th, n) => { if (p.done[n]) { const b = p.at(n); th.ctx.putImageData(G.simg, -b[0], -b[1], b[0], b[1], b[2], b[3]); } });
    }
    const d = performance.now() - t0; G.take = G.take ? 0.7 * G.take + 0.3 * d : d;
    if (p.again && cur) paintThumbs();
  }
  let checked = null, blackN = 0;
  function glCheck() {
    if (!G.on || !F.live || F.id !== cur.id || checked === cur.id) return;
    const gl = G.gl, x = Math.round(cur.tile_w / 2) - 8, y = Math.round(cur.tile_h / 2) - 8, i = cur.tiles.input;
    glTarget(16, 16); gl.clear(gl.COLOR_BUFFER_BIT);
    let sum = 0;
    if (glTile('input', false, [-x, -y, cur.tile_w, cur.tile_h], [0, 0, 16, 16], ALL, 0, ALL, 0, null)) {
      gl.readPixels(0, 0, 16, 16, gl.RGBA, gl.UNSIGNED_BYTE, G.pix);
      for (let n = 0; n < G.pix.length; n += 4) sum += G.pix[n] + G.pix[n + 1] + G.pix[n + 2];
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (sum) { checked = cur.id; blackN = 0; return; }
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const cx = c.getContext('2d'); cx.drawImage(video, i.x + x, i.y + y, 16, 16, 0, 0, 16, 16);
    const b = cx.getImageData(0, 0, 16, 16).data;
    let ref = 0; for (let n = 0; n < b.length; n += 4) ref += b[n] + b[n + 1] + b[n + 2];
    if (ref) {
      if ((blackN += 1) >= 5) { blackN = 0; glOff(); repaint(); }
      else { F.key = null; setTimeout(() => { if (G.on && cur) repaint(); }, 150); }
      return;
    }
    blackN = 0; checked = cur.id;
  }
  applyInset();
  glStart();
  function grab(f, src, key, w, h) {
    key += `#${cur.id}`;
    if (key === f.key) return 1;
    if (!(src.videoWidth || src.naturalWidth)) return 0;
    const live = src === video || src === video3;
    if (!G.on || !glUpload(f, src)) {
      if (!f.cv) { f.cv = document.createElement('canvas'); f.ctx = f.cv.getContext('2d'); }
      if (f.cv.width !== w || f.cv.height !== h) { f.cv.width = w; f.cv.height = h; }
      f.ctx.drawImage(src, 0, 0);
    }
    f.key = key; f.id = cur.id; f.live = live;
    if (f === F && live) glCheck();
    return 2;
  }
  function grabNow() {
    if (video.readyState >= 2 && video.videoWidth) return grab(F, video, `v${video.getAttribute('src')}@${video.currentTime}`, cur.width, cur.height);
    if (poster.complete && poster.naturalWidth && poster.dataset.case === cur.id) return grab(F, poster, `p${poster.src}`, cur.width, cur.height);
    return 0;
  }
  function grab3() {
    if (!cur.d) return 0;
    if (video3.readyState >= 2 && video3.videoWidth) return grab(F3, video3, `v${video3.getAttribute('src')}@${video3.currentTime}`, cur.width3d, cur.height3d);
    if (poster3.complete && poster3.naturalWidth && poster3.dataset.case === cur.id) return grab(F3, poster3, `p${poster3.src}`, cur.width3d, cur.height3d);
    return 0;
  }
  const scratch = {};
  function drawOverlay(ctx, t, cx, cy, cw, ch) {
    const w = ctx.canvas.width, h = ctx.canvas.height, i = cur.tiles.input, kx = cur.mask_w / cur.tile_w, ky = cur.mask_h / cur.tile_h;
    const id = `${w}x${h}`;
    let s = scratch[id];
    if (!s) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; s = scratch[id] = cv.getContext('2d'); }
    const mx = t.mx + cx * kx, my = t.my + cy * ky, mw = cw * kx, mh = ch * ky;
    s.globalCompositeOperation = 'copy'; s.drawImage(F.cv, mx, my, mw, mh, 0, 0, w, h);
    s.globalCompositeOperation = 'difference'; s.fillStyle = '#fff'; s.fillRect(0, 0, w, h);
    s.globalCompositeOperation = 'multiply'; s.drawImage(F.cv, t.x + cx, t.y + cy, cw, ch, 0, 0, w, h);
    ctx.globalCompositeOperation = 'copy'; ctx.drawImage(F.cv, i.x + cx, i.y + cy, cw, ch, 0, 0, w, h);
    ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(F.cv, mx, my, mw, mh, 0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(s.canvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }
  function draw(ctx, key, cover) {
    const t = key && cur.tiles[key];
    if (!t) return;
    const three = is3(key), f = three ? F3 : F;
    if (f.id !== cur.id) return;
    const w = ctx.canvas.width, h = ctx.canvas.height, tw = three ? cur.tile3d_w : cur.tile_w, th = three ? cur.tile3d_h : cur.tile_h;
    let cx = 0, cy = 0, cw = tw, ch = th;
    if (cover) {
      const a = w / h;
      if (cw / ch < a) { ch = cw / a; cy = (th - ch) / 2; } else { cw = ch * a; cx = (tw - cw) / 2; }
    }
    if (three || key === 'input' || !f.live) ctx.drawImage(f.cv, t.x + cx, t.y + cy, cw, ch, 0, 0, w, h);
    else drawOverlay(ctx, t, cx, cy, cw, ch);
  }
  function paintPanels(m, d, inFrame) {
    if (G.on) { if (inFrame) glDraw(); else glSoon(); return; }
    panels.forEach(p => {
      if (!p.seen) return;
      const a = tileOf(p.key, true), b = tileOf(p.key, false);
      if (a && (is3(a) ? d : m)) draw(c2d(p.main), a);
      if (b && p.inset && (is3(b) ? d : m)) draw(c2d(p.inset), b);
    });
  }
  const panelIO = 'IntersectionObserver' in window ? new IntersectionObserver(es => {
    let back = false;
    es.forEach(e => { const p = panels.find(q => q.el === e.target); if (!p) return; if (e.isIntersecting && !p.seen) back = true; p.seen = e.isIntersecting; });
    if (back) repaint();
  }, { rootMargin: '160px 0px' }) : null;
  const need3 = () => !!cur && !!cur.d && ((state.view === '3d' && thumbsSeen) || panels.some(p => {
    if (!p.seen) return false;
    const a = tileOf(p.key, true), b = tileOf(p.key, false);
    return (!!a && is3(a)) || (!!b && is3(b) && !!p.inset);
  }));
  function paintThumbs() {
    const t0 = thumbAt = performance.now();
    const three = state.view === '3d' && has3d();
    if (G.on) glThumbs(three);
    else thumbs.forEach(th => draw(th.ctx, three ? `${th.key}_3d` : th.key, true));
    const cost = performance.now() - t0 + (G.on && G.gl2 ? G.take || 0 : 0);
    thumbCost = thumbCost ? 0.7 * thumbCost + 0.3 * cost : cost;
  }
  function repaint() { if (!cur) return; const a = grabNow(), b = grab3(); if (a || b || G.on) paintPanels(!!a, !!b); if (a || b) paintThumbs(); }
  if ('IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(e => { thumbsSeen = e.isIntersecting; if (thumbsSeen && cur && (F.id === cur.id || F3.id === cur.id)) paintThumbs(); })).observe(stripEl);

  let hold3 = null, lead3 = 0.2, late3 = 0.04, seekAt3 = -1e9, fixAt3 = -1e9, started3 = false, frameAt = 0;
  const fixes3 = [], shownM = { mt: 0, at: -1e9 }, shown3 = { mt: 0, at: -1e9 }, offs = [];
  const show = (o, now, meta) => { if (meta) { o.mt = meta.mediaTime; o.at = meta.expectedDisplayTime || now; } };
  function offset3() {
    const now = performance.now();
    if (now - shownM.at < 200 && now - shown3.at < 200) return (shown3.mt - shownM.mt) - ((shown3.at - shownM.at) / 1000) * video.playbackRate;
    return video3.currentTime - (video.currentTime || 0);
  }
  function sync3() {
    if (!cur || !cur.d || !video3.getAttribute('src') || video3.readyState < 1) return;
    const f = 1 / cur.fps, tol = 1.25 * f, t = video.currentTime || 0, end = (video3.duration || cur.frames * f) - f / 2, now = performance.now();
    const seek3 = x => { offs.length = 0; seekAt3 = now; try { video3.currentTime = Math.max(0, Math.min(x, end)); } catch { } };
    const ahead = () => Math.min(t + Math.max(0.15, lead3 * 1.5 + 0.1) * video.playbackRate, end);
    const play3 = () => { hold3 = null; offs.length = 0; started3 = true; const p = video3.play(); if (p && p.catch) p.catch(() => { }); };
    if (Math.abs(video3.playbackRate - video.playbackRate) > 1e-3) video3.playbackRate = video.playbackRate;
    if (video.paused || video.ended || video.seeking) {
      const run = !video.paused && !video.ended, x = run ? ahead() : t;
      if (!video3.paused) video3.pause();
      if (!video3.seeking && Math.abs(video3.currentTime - x) > (run ? 0.1 : f / 4)) seek3(x);
      hold3 = run ? x : null; offs.length = 0;
      return;
    }
    if (video3.seeking) return;
    const s = video3.currentTime;
    const align = () => { if (!video3.paused) video3.pause(); hold3 = ahead(); fixAt3 = now; seek3(hold3); };
    const far = Math.max(0.15, lead3 * 1.5 + 0.1) * video.playbackRate + 1;
    if (hold3 !== null) {
      if (t > s + tol) { lead3 = Math.min(0.8, lead3 * 1.5 + 0.1); align(); }
      else if (s - t > far) align();
      else if (t >= s - late3 - f / 2) play3();
      return;
    }
    if (video3.paused || video3.ended) {
      const d = s - t;
      if (video3.ended && d > -1 && d <= far) return;
      if (d >= -tol && d <= f / 2) play3();
      else if (d > 0 && d < 0.6) hold3 = s;
      else align();
      return;
    }
    offs.push(offset3()); if (offs.length > 5) offs.shift();
    if (offs.length < 5 || now - fixAt3 < 1500) return;
    const d = [...offs].sort((x, y) => x - y)[2];
    if (started3) { started3 = false; if (Math.abs(d) < 0.12) late3 = Math.max(0, Math.min(0.1, late3 - d)); }
    if (d >= -tol && d <= 0.6 * f) return;
    while (fixes3.length && now - fixes3[0] > 10000) fixes3.shift();
    if (fixes3.length >= 3) return;
    fixes3.push(now); fixAt3 = now;
    if (d > 0 && d < 0.6) { video3.pause(); hold3 = video3.currentTime; offs.length = 0; }
    else align();
  }
  ['play', 'playing', 'pause', 'waiting', 'seeking', 'seeked', 'ratechange', 'ended', 'emptied'].forEach(n => video.addEventListener(n, sync3));
  video3.addEventListener('seeked', () => {
    if (hold3 !== null) lead3 = 0.6 * lead3 + 0.4 * Math.min(0.8, (performance.now() - seekAt3) / 1000);
    paint3(); sync3();
  });
  video3.addEventListener('loadeddata', () => { sync3(); paint3(); arm3(); });
  video3.addEventListener('ended', sync3);
  video3.addEventListener('play', () => arm3());
  function paint3() { if (cur && need3() && grab3()) { paintPanels(false, true); if (state.view === '3d') paintThumbs(); } }

  const rvfc = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
  let rvfcId = null, rafId = null, rvfc3Id = null;
  function onVideoFrame(now) {
    frameAt = now;
    if (cur && video.readyState >= 2) {
      const a = grabNow();
      const b = (!rvfc || F3.id !== cur.id) && need3() ? grab3() : 0;
      if (a === 2 || b === 2) paintPanels(a === 2, b === 2, true);
      if (a && thumbsSeen && now - thumbAt >= Math.min(THUMB_MS, thumbCost * THUMB_SHARE) - 4) paintThumbs();
    }
    sync3();
    syncTime();
  }
  function onFrame(now, meta) { rvfcId = null; show(shownM, now, meta); onVideoFrame(now); arm(); }
  function arm() {
    if (rvfc) { if (rvfcId === null) rvfcId = video.requestVideoFrameCallback(onFrame); return; }
    if (rafId === null && !video.paused) rafId = requestAnimationFrame(now => { rafId = null; onVideoFrame(now); arm(); });
  }
  function arm3() {
    if (rvfc && rvfc3Id === null) rvfc3Id = video3.requestVideoFrameCallback((now, meta) => {
      rvfc3Id = null; show(shown3, now, meta);
      if (cur && need3() && grab3() === 2) paintPanels(false, true, true);
      if (!video3.paused && !video.paused && now - frameAt > 400) video3.pause();
      arm3();
    });
  }
  function syncTime() {
    const d = video.duration || cur.frames / cur.fps;
    const t = video.currentTime || 0;
    if (!seeking) { range.value = String(Math.round((t / d) * 1000)); range.style.setProperty('--p', `${(t / d) * 100}%`); }
    timeEl.textContent = `${fmt(t)} / ${fmt(d)}`;
  }
  function setPlayIcon() {
    playBtn.dataset.state = video.paused ? 'paused' : 'playing';
    playBtn.setAttribute('aria-label', video.paused ? 'Play' : 'Pause');
  }
  function tryPlay() {
    if (noVideo || state.userPaused || !state.inView) return;
    const p = video.play(); if (p && p.catch) p.catch(() => setPlayIcon());
  }

  function renderSets() {
    setsEl.innerHTML = Q.sets.map(s => `<button type="button" role="tab" aria-selected="${s.id === state.set}" data-set="${esc(s.id)}">${esc(s.name)}</button>`).join('');
    noteEl.textContent = Q.sets.find(s => s.id === state.set).note;
  }
  const thumbStyle = c => (artOn ? `background-image:url('${mu(`assets/video/qual/${c.id}_thumb.jpg`)}');background-size:cover;background-position:center` : '');
  function renderRail() {
    const list = Q.cases.filter(c => c.set === state.set);
    railEl.innerHTML = list.map((c, i) => `<button type="button" role="tab" aria-selected="${c === cur}" data-case="${esc(c.id)}">
      <span class="thumb" style="${thumbStyle(c)}"></span>
      <span class="rl"><i>${String(i + 1).padStart(2, '0')}</i>${esc(c.title)}</span></button>`).join('');
    list.forEach(railMark);
  }
  function buildPanels() {
    const keys = slots();
    stage.style.setProperty('--cols', String(keys.length));
    stage.dataset.n = String(keys.length);
    stage.innerHTML = keys.map((k, i) => {
      const role = i === 1 ? 'baseline' : k;
      const inset = k !== 'input' && has3d()
        ? `<button type="button" class="inset" aria-label="Swap the large and the small view" title="Click to swap · drag to move · drag an edge or a corner to resize"><span class="inset-clip"><canvas width="${cur.tile_w}" height="${cur.tile_h}"></canvas><span class="inset-tag"></span></span></button>` : '';
      return `<figure class="panel${k === 'ours' ? ' is-ours' : ''}" data-role="${role}"><figcaption class="pname"></figcaption>`
        + `<div class="media"><canvas class="main" width="${cur.tile_w}" height="${cur.tile_h}"></canvas>${inset}</div></figure>`;
    }).join('');
    if (panelIO) panelIO.disconnect();
    if (glRO) glRO.disconnect();
    panels = $$('.panel', stage).map((el, i) => {
      const main = $('canvas.main', el), inset = $('.inset canvas', el);
      if (panelIO) panelIO.observe(el);
      return { el, key: keys[i], name: $('.pname', el), main, inset, media: $('.media', el), clip: $('.inset-clip', el),
        insetBtn: $('.inset', el), tag: $('.inset-tag', el), seen: true };
    });
    if (G.on) { stage.insertBefore(G.cv, stage.firstChild); G.layout = true; }
    if (glRO) { glRO.observe(stage); panels.forEach(p => { glWatch(p.media); if (p.insetBtn) glRO.observe(p.insetBtn); }); }
  }
  function renderStrip() {
    const tw = 264, th = 148;
    stripEl.innerHTML = FAMILIES.map(f => `<div class="sgroup"><p class="sgroup-name">${esc(f.name)}</p><div class="sthumbs">`
      + f.methods.filter(k => cur.tiles[k]).map(k => `<button type="button" data-key="${k}" aria-pressed="${k === state.left}"><canvas width="${tw}" height="${th}"></canvas><span style="${mc(N[k])}">${esc(N[k])}</span></button>`).join('')
      + '</div></div>').join('');
    thumbs = $$('button', stripEl).map(b => ({ key: b.dataset.key, btn: b, ctx: $('canvas', b).getContext('2d') }));
  }
  function renderPanels() {
    G.layout = true;
    panels.forEach(p => {
      if (p.el.dataset.role === 'baseline') p.key = state.left;
      p.name.innerHTML = esc(N[p.key]) + (p.key === 'ours' ? ' <small>Ours</small>' : '');
      p.name.style.cssText = mc(N[p.key]);
      if (p.insetBtn) p.tag.textContent = state.view === '3d' ? 'MANO' : '3D';
    });
    thumbs.forEach(t => t.btn.setAttribute('aria-pressed', String(t.key === state.left)));
    $$('button', viewEl).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    repaint();
  }
  function renderViewControl() {
    const opts = [['mano', 'MANO'], ['3d', '3D']];
    viewEl.hidden = !has3d();
    viewEl.innerHTML = opts.map(([v, l]) => `<button type="button" data-view="${v}" aria-pressed="${v === state.view}">${l}</button>`).join('');
  }

  function selectCase(c) {
    cur = c;
    lastCase[c.set] = c.id;
    state.left = c.focus;
    if (!has3d()) state.view = 'mano';
    state.userPaused = false;
    if (!noVideo) stage.classList.add('is-loading');
    stage.style.setProperty('--ar', `${c.tile_w / c.tile_h}`);
    stage.style.setProperty('--armax', `${Math.max(...Q.cases.map(x => x.tile_w / x.tile_h))}`);
    stage.style.setProperty('--hcols', `${Math.max(...Q.cases.map(x => (x.tiles.gt ? 4 : 3)))}`);
    video.pause();
    if (G.on) glDrop();
    netTries = 0; if (!noVideo) msg.hidden = true;
    if (c.d && clipOf(c.d).st === 'fail') { const e = clipOf(c.d); e.st = 'idle'; e.tries = 0; }
    setPoster();
    renderRail();
    buildPanels();
    renderStrip();
    renderViewControl();
    renderPanels();
    timeEl.textContent = `${fmt(0)} / ${fmt(c.frames / c.fps)}`;
    range.value = '0'; range.style.setProperty('--p', '0%');
    setPlayIcon();
    attach(c);
    want3();
    pump();
  }
  poster.onload = () => { if (video.readyState < 2) repaint(); };
  poster3.onload = () => { if (video3.readyState < 2) repaint(); };
  let posterT = 0;
  function setPoster(late) {
    if (!artOn || !cur) return;
    const c = cur, want = (e, v) => noVideo || e.bad || e.st !== 'blob' || (late === true && v.readyState < 2);
    if (poster.dataset.case !== c.id && want(clipOf(c), video)) { poster.dataset.case = c.id; poster.src = mu(c.poster); }
    if (c.d && poster3.dataset.case !== c.id && want(clipOf(c.d), video3)) { poster3.dataset.case = c.id; poster3.src = mu(c.poster3d); }
    clearTimeout(posterT);
    if (late !== true) posterT = setTimeout(() => { if (cur === c) setPoster(true); }, 400);
  }
  function art() { if (artOn) return; artOn = true; setPoster(); renderRail(); }
  function activate() { if (active) return; active = true; art(); if (cur) { attach(cur); want3(); } }
  function setView(v) {
    if (v === state.view) return;
    state.view = v;
    renderPanels();
    tryPlay();
  }

  video.addEventListener('loadeddata', () => { stage.classList.remove('is-loading'); repaint(); arm(); tryPlay(); });
  video.addEventListener('play', () => { setPlayIcon(); arm(); });
  video.addEventListener('pause', () => { if (!video.ended) setPlayIcon(); });
  video.addEventListener('seeked', () => { repaint(); syncTime(); });
  video.addEventListener('timeupdate', () => { if (!rvfc && video.paused) syncTime(); });

  playBtn.addEventListener('click', () => {
    if (video.paused) { state.userPaused = false; state.inView = true; tryPlay(); }
    else { state.userPaused = true; video.pause(); }
  });
  range.addEventListener('input', () => {
    seeking = true;
    const d = video.duration || cur.frames / cur.fps;
    const t = (Number(range.value) / 1000) * d;
    range.style.setProperty('--p', `${(t / d) * 100}%`);
    if (video.readyState >= 1) video.currentTime = Math.min(t, d - 0.001);
    timeEl.textContent = `${fmt(t)} / ${fmt(d)}`;
  });
  range.addEventListener('change', () => { seeking = false; });
  speedBtn.addEventListener('click', () => {
    const order = [1, 0.5, 0.25];
    state.speed = order[(order.indexOf(state.speed) + 1) % order.length];
    video.playbackRate = state.speed;
    speedBtn.textContent = `${state.speed}×`;
  });
  viewEl.addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view); });
  let dragged = false;
  stage.addEventListener('click', e => {
    if (!e.target.closest('.inset')) return;
    if (dragged) { dragged = false; return; }
    setView(state.view === '3d' ? 'mano' : '3d');
  });

  const zoneOf = (r, x, y, touch) => {
    const e = touch ? 18 : 12;
    const h = x - r.left < e ? -1 : r.right - x < e ? 1 : 0;
    const v = y - r.top < e ? -1 : r.bottom - y < e ? 1 : 0;
    return { h, v };
  };
  const cursorOf = z => (z.h && z.v ? (z.h === z.v ? 'nwse-resize' : 'nesw-resize') : z.h ? 'ew-resize' : z.v ? 'ns-resize' : 'grab');
  let drag = null;
  stage.addEventListener('pointermove', e => {
    const el = e.target.closest('.inset');
    if (!drag) { if (el) el.style.cursor = cursorOf(zoneOf(el.getBoundingClientRect(), e.clientX, e.clientY, e.pointerType === 'touch')); return; }
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (!drag.moved) return;
    const R = drag.R, ar = R.width / R.height;
    if (!drag.zone.h && !drag.zone.v) {
      inset.x = Math.min(Math.max(drag.s.x + dx / R.width, 0), 1 - inset.w);
      inset.y = Math.min(Math.max(drag.s.y + dy / R.height, 0), 1 - inset.w);
    } else {
      const { h, v } = drag.zone;
      const byX = h * dx, byY = v * dy * ar;
      const grow = h && v ? (Math.abs(byX) > Math.abs(byY) ? byX : byY) : h ? byX : byY;
      const right = drag.s.x + drag.s.w, bottom = drag.s.y + drag.s.w;
      let w = Math.min(Math.max(drag.s.w + grow / R.width, 0.14), 0.9);
      let x = h < 0 ? right - w : drag.s.x, y = v < 0 ? bottom - w : drag.s.y;
      if (x < 0) { w += x; x = 0; }
      if (y < 0) { w += y; y = 0; }
      w = Math.min(w, 1 - x, 1 - y);
      if (h < 0) x = right - w;
      if (v < 0) y = bottom - w;
      inset = { x, y, w };
    }
    applyInset();
  });
  stage.addEventListener('pointerdown', e => {
    const el = e.target.closest('.inset'); if (!el || e.button > 0) return;
    const media = el.closest('.media');
    drag = { x0: e.clientX, y0: e.clientY, s: { ...inset }, R: media.getBoundingClientRect(), zone: zoneOf(el.getBoundingClientRect(), e.clientX, e.clientY, e.pointerType === 'touch'), moved: false, el };
    try { el.setPointerCapture(e.pointerId); } catch { }
    el.style.cursor = drag.zone.h || drag.zone.v ? cursorOf(drag.zone) : 'grabbing';
    e.preventDefault();
  });
  const endDrag = () => {
    if (!drag) return;
    dragged = drag.moved;
    drag.el.style.cursor = '';
    drag = null;
    try { localStorage.setItem('vidihand.inset', JSON.stringify(inset)); } catch { }
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('dblclick', e => {
    if (!e.target.closest('.inset')) return;
    inset = { ...INSET0 }; applyInset();
    try { localStorage.removeItem('vidihand.inset'); } catch { }
  });
  setsEl.addEventListener('click', e => {
    const b = e.target.closest('[data-set]'); if (!b || b.dataset.set === state.set) return;
    state.set = b.dataset.set;
    renderSets();
    const list = Q.cases.filter(c => c.set === state.set);
    selectCase(list.find(c => c.id === lastCase[state.set]) || list[0]);
  });
  railEl.addEventListener('click', e => {
    const b = e.target.closest('[data-case]'); if (!b || b.dataset.case === cur.id) return;
    selectCase(Q.cases.find(c => c.id === b.dataset.case));
  });
  stripEl.addEventListener('click', e => {
    const b = e.target.closest('[data-key]'); if (!b) return;
    state.left = b.dataset.key;
    renderPanels();
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es, io) => es.forEach(e => { if (e.isIntersecting) { io.disconnect(); activate(); } }), { rootMargin: '100% 0px' }).observe(stage);
    new IntersectionObserver(es => es.forEach(e => {
      state.inView = e.isIntersecting;
      if (state.inView) tryPlay(); else video.pause();
    }), { threshold: 0.2 }).observe(stage);
  } else { state.inView = true; activate(); }
  [setsEl, railEl, stripEl, player].forEach(el => el.addEventListener('pointerdown', activate, { passive: true }));
  LOAD.add(35, () => new Promise(resolve => {
    finishPreload = resolve;
    art(); queueOn = true; pump();
  }));
  document.addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); else tryPlay(); });

  const q = new URLSearchParams(location.search);
  const linked = Q.cases.find(c => c.id === q.get('case'));
  if (linked) state.set = linked.set;
  renderSets();
  selectCase(linked || Q.cases.find(c => c.set === state.set));
  if (linked && q.get('view') === '3d') setView('3d');

})();
