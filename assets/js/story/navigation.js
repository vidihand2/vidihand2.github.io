'use strict';
(() => {
  const { $, $$ } = window.VDHStory;
  const links = $$('.nav-links a[href^="#"]').filter(a => a.getAttribute('href').length > 1 && $(a.getAttribute('href')));
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) { const a = links.find(x => x.getAttribute('href') === `#${e.target.id}`); if (a) { a.classList.remove('is-here'); a.removeAttribute('aria-current'); } return; }
    links.forEach(a => { const on = a.getAttribute('href') === `#${e.target.id}`; a.classList.toggle('is-here', on); if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  }), { rootMargin: '-45% 0px -50% 0px' });
  links.forEach(a => io.observe($(a.getAttribute('href'))));
})();
