(() => {
  document.documentElement.classList.add('js');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function mc(name) {
    const c = ((window.VIDIHAND_QUAL || {}).colors || {})[name];
    return c ? `--mc-l:${c[0]};--mc-d:${c[1]}` : '';
  }

  window.VDHPage = { $, $$, esc, mc };
  const reveal = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); reveal.unobserve(e.target); } }),
      { rootMargin: '0px 0px -6% 0px', threshold: 0.06 })
    : null;
  $$('.reveal').forEach(el => (reveal ? reveal.observe(el) : el.classList.add('in')));

  const copy = $('#copy-bib');
  if (copy) copy.addEventListener('click', async () => {
    const text = $('#bib-text').textContent;
    try { await navigator.clipboard.writeText(text); }
    catch {
      const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch { }
      t.remove();
    }
    copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy'; }, 1600);
  });

  const launch = $('.demo-launch');
  launch.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const video = document.createElement('video');
    video.className = 'demo-video';
    video.controls = true;
    video.playsInline = true;
    video.poster = launch.querySelector('img').src;
    video.setAttribute('aria-label', 'ViDiHand2 paper video');
    launch.replaceWith(video);
    video.src = launch.href;
    video.focus({ preventScroll: true });
    video.play().catch(() => {});
  });
})();
