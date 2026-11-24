'use strict';
(() => {
  const { $, $$, esc, mc } = window.VDHPage;

  const M = window.VIDIHAND_METRICS;
  const head = $('#mtable-head');
  if (!M || !head) return;
  const body = $('#mtable-body'), sw = $('#ds-switch'), sel = $('#sort-select'), order = $('#sort-order'), note = $('#ds-note');
  const cols = [...M.metrics, M.speed];
  const DEFAULT = { dataset: 'in_domain', sort: 'MPJPE-abs-p', dir: 'min' };
  const state = { ...DEFAULT };
  const expanded = new Set();
  const params = new URLSearchParams(location.search);
  if (M.datasets.some(d => d.id === params.get('dataset'))) state.dataset = params.get('dataset');
  const qs = cols.find(c => c.key === params.get('sort'));
  if (qs) { state.sort = qs.key; state.dir = ['min', 'max'].includes(params.get('order')) ? params.get('order') : qs.direction; }

  const FAMILY_SHORT = {
    'Detect-then-reconstruct, single frame': 'Single frame',
    'Detect-then-reconstruct with a motion prior': 'Motion prior',
    'Video diffusion with depth regression': 'Video diffusion',
    'Video diffusion with hand geometry': 'Video diffusion + geometry',
  };
  const value = (m, version, key) => (key === 'FPS' ? m.fps : m.versions[version]?.[state.dataset]?.[key]);
  const fmt = v => (Number.isFinite(v) ? v.toFixed(2) : '—');
  const arrow = c => (c.direction === 'max' ? '↑' : '↓');
  const groupStart = key => ['FAcc', 'MPJPE-abs-p', 'MPJPE-p', 'Jitter', 'FPS'].includes(key);

  sw.innerHTML = M.datasets.map(d => (d.setting === 'in-the-wild' ? '<span class="seg-sep" aria-hidden="true"></span>' : '')
    + `<button type="button" data-ds="${esc(d.id)}" aria-pressed="${d.id === state.dataset}" title="${esc(d.mean ? 'Mean of the six in-domain test sets' : d.name)}">`
    + `${esc(d.mean ? 'In-domain' : d.name)}${d.mean ? '<small>AVG</small>' : ''}${d.setting === 'in-the-wild' ? '<small>IN THE WILD</small>' : ''}</button>`).join('');
  sel.innerHTML = cols.map(c => `<option value="${esc(c.key)}">${esc(c.label)}</option>`).join('');

  function dsNote() {
    const d = M.datasets.find(x => x.id === state.dataset);
    if (d.mean) return 'Mean of the six in-domain test sets: ARCTIC, H2O, HOT3D, OakInk2, EgoDemo Pro and EgoDemo Standard.';
    const base = `${d.clips} test clips · ${d.test_hours} h · ${d.resolution}`;
    return d.setting === 'in-the-wild' ? `Gen-HumanEgo · in the wild, no training split · ${base}` : `${d.name} · in-domain · ${base}`;
  }
  function compare(key, dir) {
    return (a, b) => {
      const x = a.vals[key], y = b.vals[key];
      if (!Number.isFinite(x)) return Number.isFinite(y) ? 1 : a.m.name.localeCompare(b.m.name);
      if (!Number.isFinite(y)) return -1;
      return (x - y) * (dir === 'max' ? -1 : 1) || a.m.name.localeCompare(b.m.name);
    };
  }
  function render() {
    const rows = M.methods.map(m => ({ m, vals: Object.fromEntries(cols.map(c => [c.key, value(m, m.default, c.key)])) }));
    rows.sort(compare(state.sort, state.dir));
    let rank = 0, last = null;
    rows.forEach((r, i) => { const v = r.vals[state.sort]; if (last === null || v !== last) rank = i + 1; last = v; r.rank = Number.isFinite(v) ? rank : null; });
    const best = Object.fromEntries(cols.map(c => {
      const vs = rows.map(r => r.vals[c.key]).filter(Number.isFinite);
      return [c.key, vs.length ? (c.direction === 'max' ? Math.max : Math.min)(...vs) : null];
    }));
    const groups = [];
    cols.forEach(c => { const g = groups.at(-1); if (g && g.name === c.group) g.n += 1; else groups.push({ name: c.group, n: 1 }); });
    head.innerHTML = `<tr class="groups"><th colspan="2"></th>${groups.map(g => `<th colspan="${g.n}" class="g-start">${esc(g.name)}</th>`).join('')}</tr>`
      + '<tr class="cols"><th scope="col" class="rank">#</th><th scope="col" class="method">Method</th>'
      + cols.map(c => {
        const active = c.key === state.sort;
        const next = active ? (state.dir === 'max' ? 'min' : 'max') : c.direction;
        return `<th scope="col" class="${groupStart(c.key) ? 'g-start ' : ''}${active ? 'is-sorted' : ''}"${active ? ` aria-sort="${state.dir === 'max' ? 'descending' : 'ascending'}"` : ''}>`
          + `<button type="button" class="colbtn" data-sort="${esc(c.key)}" title="${esc(c.description)} ${c.direction === 'max' ? 'Higher' : 'Lower'} is better." aria-label="Sort by ${esc(c.label)}, ${next === c.direction ? 'best' : 'worst'} first">`
          + `<span class="cl">${esc(c.label)}<i>${arrow(c)}</i></span><span class="cu">${esc(c.unit)}</span></button></th>`;
      }).join('') + '</tr>';
    const cells = (vals, highlight) => cols.map(c => {
      const v = vals[c.key];
      const isBest = highlight && Number.isFinite(v) && fmt(v) === fmt(best[c.key]);
      return `<td class="num${groupStart(c.key) ? ' g-start' : ''}${isBest ? ' best' : ''}${c.key === state.sort ? ' is-sorted' : ''}">${fmt(v)}</td>`;
    }).join('');
    body.innerHTML = rows.map(r => {
      const m = r.m, two = Object.keys(m.versions).length > 1, open = expanded.has(m.id);
      const fam = FAMILY_SHORT[m.family] || '';
      const venue = m.url ? `<a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.venue)}</a>` : esc(m.venue);
      const toggle = two
        ? `<button type="button" class="toggle" data-expand="${esc(m.id)}" aria-expanded="${open}" aria-label="${open ? 'Hide' : 'Show'} the versions of ${esc(m.name)}"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 L6 7.5 L9 4.5"/></svg></button>`
        : '<span class="toggle-space"></span>';
      const name = `<b class="${two ? 'clickable' : ''}" style="${mc(m.name)}" ${two ? `data-expand="${esc(m.id)}"` : ''}>${esc(m.name)}${m.ours ? '<span class="ours-tag">Ours</span>' : ''}</b>`;
      const sub = `<small>${venue}${fam ? ` · ${esc(fam)}` : ''}</small>`;
      const parent = `<tr class="row${m.ours ? ' is-ours' : ''}"><td class="rank">${r.rank ?? '—'}</td>`
        + `<th scope="row" class="method"><div class="mcell">${toggle}<div class="mname">${name}${sub}</div></div></th>${cells(r.vals, true)}</tr>`;
      if (!two) return parent;
      const versions = ['retrained', 'official'].filter(v => m.versions[v]).map(v => {
        const vals = Object.fromEntries(cols.map(c => [c.key, value(m, v, c.key)]));
        const label = v === 'retrained' ? 'Re-trained on the six datasets' : 'Official weights';
        return `<tr class="version${v === m.default ? ' is-default' : ''}"${open ? '' : ' hidden'}><td class="rank"></td><th scope="row" class="method"><div class="vl"><b>${label}</b></div></th>${cells(vals, false)}</tr>`;
      }).join('');
      return parent + versions;
    }).join('');
    $$('button', sw).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ds === state.dataset)));
    sel.value = state.sort;
    const sortMetric = cols.find(c => c.key === state.sort);
    const reversed = state.dir !== sortMetric.direction;
    order.innerHTML = '<span aria-hidden="true">⇅</span> Reverse order';
    order.setAttribute('aria-pressed', String(reversed));
    order.setAttribute('aria-label', `Reverse order, now ${reversed ? 'worst' : 'best'} first`);
    note.textContent = dsNote();
    $('#mtable-caption').textContent = `${M.datasets.find(d => d.id === state.dataset).name}: methods sorted by ${sortMetric.label}, ${reversed ? 'worst' : 'best'} first.`;
    syncUrl();
  }
  function syncUrl() {
    try {
      const u = new URL(location.href);
      ['dataset', 'sort', 'order'].forEach(k => u.searchParams.delete(k));
      if (state.dataset !== DEFAULT.dataset) u.searchParams.set('dataset', state.dataset);
      if (state.sort !== DEFAULT.sort || state.dir !== DEFAULT.dir) { u.searchParams.set('sort', state.sort); u.searchParams.set('order', state.dir); }
      history.replaceState(null, '', u);
    } catch { }
  }
  sw.addEventListener('click', e => { const b = e.target.closest('[data-ds]'); if (!b) return; state.dataset = b.dataset.ds; render(); });
  head.addEventListener('click', e => {
    const b = e.target.closest('[data-sort]'); if (!b) return;
    const c = cols.find(x => x.key === b.dataset.sort);
    state.dir = state.sort === c.key ? (state.dir === 'max' ? 'min' : 'max') : c.direction;
    state.sort = c.key;
    render();
    const again = head.querySelector(`[data-sort="${CSS.escape(c.key)}"]`); if (again) again.focus({ preventScroll: true });
  });
  sel.addEventListener('change', () => { const c = cols.find(x => x.key === sel.value); state.sort = c.key; state.dir = c.direction; render(); });
  order.addEventListener('click', () => { state.dir = state.dir === 'max' ? 'min' : 'max'; render(); });
  body.addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const b = e.target.closest('[data-expand]'); if (!b) return;
    const id = b.dataset.expand;
    if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
    render();
    const again = body.querySelector(`button[data-expand="${CSS.escape(id)}"]`); if (again) again.focus({ preventScroll: true });
  });
  render();

})();
