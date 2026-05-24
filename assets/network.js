// bioscope-web — interactive cross-disease network.
//
// D3 v7 force-directed graph. Each node = a gene/protein; each edge = a
// real biological relationship with citations. The SME judges the edges
// via the side panel — every judgement is fed back into BioscopeModel
// (recordEdgeRating) so the model the brief generator + ask page use
// gets corrected by the SME's network-level expertise.
//
// Imports D3 from CDN as an ES module so the page stays zero-build.

import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

import { BioscopeModel } from './model.js';
import { DISEASES, NODES, EDGES, EDGE_COLORS, EDGE_LEGEND } from './network-data.js';

const model = new BioscopeModel();

// ---------------------------------------------------------------------------
// Build lookup tables and inject any panel-gene that isn't already a node.
// (So if the SME's local model has extra genes, they appear, too.)
// ---------------------------------------------------------------------------
const nodeById = new Map(NODES.map((n) => [n.id, n]));
for (const g of model.panel) {
  if (!nodeById.has(g.symbol)) {
    const guessedDisease = guessDisease(g);
    const inserted = {
      id: g.symbol,
      protein: g.notes || g.symbol,
      disease: guessedDisease,
      prevalence: 0.4,
      role: g.notes || '',
      _fromPanel: true,
    };
    NODES.push(inserted);
    nodeById.set(g.symbol, inserted);
  }
}

function guessDisease(g) {
  const t = (g.notes + ' ' + (g.expectTokens || []).join(' ')).toLowerCase();
  if (/parkinson/.test(t)) return 'PD';
  if (/alzheim/.test(t)) return 'AD';
  if (/\bALS\b|\bFTD\b|amyotrophic|frontotemporal/.test(t)) return 'ALS';
  if (/huntington|polyq|ataxin|spinocerebellar/.test(t)) return 'HD';
  if (/prion|CJD|PrP/.test(t)) return 'PRION';
  if (/lysosom|gaucher|niemann|tay-sachs|pompe|krabbe/.test(t)) return 'LSD';
  if (/NBIA|iron/.test(t)) return 'NBIA';
  return 'SHARED';
}

// Compute per-node degree and disease counts for sizing/positioning
const degree = new Map(NODES.map((n) => [n.id, 0]));
for (const e of EDGES) {
  degree.set(e.from, (degree.get(e.from) || 0) + 1);
  degree.set(e.to, (degree.get(e.to) || 0) + 1);
}

// ---------------------------------------------------------------------------
// DOM bootstrap
// ---------------------------------------------------------------------------
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const el = (tag, attrs = {}, ...children) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v != null && v !== false) n.setAttribute(k, String(v));
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    n.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return n;
};

function toast(msg, kind = 'ok', ms = 2400) {
  const host = $('#toast-host');
  if (!host) return;
  const t = el('div', { class: `toast ${kind}` }, msg);
  host.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  selected: null, // { type: 'node'|'edge', data }
  activeFilter: 'ALL', // disease key or 'ALL'
  hovered: null,
  // edge rating local UI state — replaced per-edge
  rating: { validity: null, explanation: 0, citation: 0, feedback: '' },
};

const edgeId = (e) => `${e.from}→${e.to}|${e.kind}`;

// ---------------------------------------------------------------------------
// SVG + force simulation
// ---------------------------------------------------------------------------
const svgEl = $('#graph');
const W = () => svgEl.clientWidth;
const H = () => svgEl.clientHeight;

const svg = d3.select(svgEl);

// Definitions for arrowheads and glows
const defs = svg.append('defs');
for (const [kind, color] of Object.entries(EDGE_COLORS)) {
  defs.append('marker')
    .attr('id', `arrow-${kind.replace(/[^a-z]/gi, '')}`)
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 18)
    .attr('refY', 0)
    .attr('markerWidth', 5)
    .attr('markerHeight', 5)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', color);
}
// Soft glow for highlighted nodes
const filt = defs.append('filter').attr('id', 'glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
filt.append('feGaussianBlur').attr('stdDeviation', 3.5).attr('result', 'blur');
const merge = filt.append('feMerge');
merge.append('feMergeNode').attr('in', 'blur');
merge.append('feMergeNode').attr('in', 'SourceGraphic');

// Two top-level groups: edges below nodes
const gZoom = svg.append('g').attr('class', 'zoom-root');
const gEdges = gZoom.append('g').attr('class', 'edges-layer');
const gNodes = gZoom.append('g').attr('class', 'nodes-layer');

// Zoom & pan behaviour
const zoom = d3.zoom()
  .scaleExtent([0.3, 4])
  .on('zoom', (event) => {
    gZoom.attr('transform', event.transform);
  });
svg.call(zoom).on('dblclick.zoom', null);

function zoomBy(factor) {
  svg.transition().duration(220).call(zoom.scaleBy, factor);
}
function zoomReset() {
  svg.transition().duration(380).call(zoom.transform, d3.zoomIdentity);
}

// ---------------------------------------------------------------------------
// Force simulation
// ---------------------------------------------------------------------------
// Each NODE gets {x,y,vx,vy} from d3.forceSimulation. We seed initial x
// by disease so the first layout reads as columns before physics settles.
const diseaseOrder = ['NBIA', 'PD', 'SHARED', 'AD', 'ALS', 'HD', 'PRION', 'LSD'];
function seedX(n) {
  const i = diseaseOrder.indexOf(n.disease);
  if (i < 0) return W() / 2;
  return ((i + 0.5) / diseaseOrder.length) * Math.max(W(), 1200);
}
function seedY(n) {
  return H() * 0.5 + (Math.random() - 0.5) * H() * 0.7;
}
for (const n of NODES) { n.x = seedX(n); n.y = seedY(n); }

// Convert string from/to in EDGES into node references (d3 force expects)
const links = EDGES.map((e) => ({ ...e, source: e.from, target: e.to }));

const simulation = d3.forceSimulation(NODES)
  .force('link', d3.forceLink(links).id((d) => d.id).distance((d) => 120 - 50 * (d.strength || 0.5)).strength((d) => 0.18 + 0.4 * (d.strength || 0.5)))
  .force('charge', d3.forceManyBody().strength((d) => -240 - 220 * (d.prevalence || 0.4)))
  .force('collide', d3.forceCollide().radius((d) => nodeRadius(d) + 6))
  .force('x', d3.forceX((d) => seedX(d)).strength(0.06))
  .force('y', d3.forceY(H() * 0.5).strength(0.025))
  .alphaDecay(0.025);

function nodeRadius(n) {
  // Box "size" — actually we use rounded rects; expose as a single number for collision.
  return 18 + (n.prevalence || 0.4) * 22;
}

// ---------------------------------------------------------------------------
// Render: edges
// ---------------------------------------------------------------------------
const edgeSel = gEdges.selectAll('path')
  .data(links, edgeId)
  .enter()
  .append('path')
  .attr('class', 'edge')
  .attr('stroke', (d) => EDGE_COLORS[d.kind])
  .attr('stroke-width', (d) => 0.9 + 2.6 * (d.strength || 0.5))
  .attr('opacity', 0.65)
  .on('click', (event, d) => {
    event.stopPropagation();
    selectEdge(d);
  })
  .on('mouseover', (event, d) => {
    setHoverEdge(d);
  })
  .on('mouseout', () => setHoverEdge(null));

// ---------------------------------------------------------------------------
// Render: nodes (rect with text, sized by prevalence)
// ---------------------------------------------------------------------------
const nodeSel = gNodes.selectAll('g.node-group')
  .data(NODES, (d) => d.id)
  .enter()
  .append('g')
  .attr('class', 'node-group')
  .style('color', (d) => DISEASES[d.disease]?.color || '#888')
  .on('click', (event, d) => {
    event.stopPropagation();
    selectNode(d);
  })
  .on('mouseover', (event, d) => setHoverNode(d))
  .on('mouseout', () => setHoverNode(null))
  .call(d3.drag()
    .on('start', dragStarted)
    .on('drag', dragged)
    .on('end', dragEnded),
  );

function nodeWidth(d)  { return 56 + (d.prevalence || 0.4) * 50; }
function nodeHeight(d) { return 26 + (d.prevalence || 0.4) * 14; }

nodeSel.append('rect')
  .attr('class', 'node-bg')
  .attr('width',  (d) => nodeWidth(d))
  .attr('height', (d) => nodeHeight(d))
  .attr('x',      (d) => -nodeWidth(d) / 2)
  .attr('y',      (d) => -nodeHeight(d) / 2)
  .attr('rx', 6)
  .attr('fill', (d) => DISEASES[d.disease]?.soft || '#11161d')
  .attr('stroke', (d) => DISEASES[d.disease]?.color || '#888');

nodeSel.append('text')
  .attr('class', 'node-label')
  .attr('dy', (d) => -1 + ((d.prevalence || 0.4) > 0.7 ? -3 : 0))
  .attr('font-size', (d) => 11 + (d.prevalence || 0.4) * 4)
  .text((d) => d.id);

nodeSel.filter((d) => (d.prevalence || 0) > 0.7)
  .append('text')
  .attr('class', 'node-sub')
  .attr('dy', 11)
  .text((d) => truncate(d.protein, 18));

function truncate(s, n) { return (s || '').length <= n ? (s || '') : (s || '').slice(0, n - 1) + '…'; }

// ---------------------------------------------------------------------------
// Tick
// ---------------------------------------------------------------------------
simulation.on('tick', () => {
  edgeSel.attr('d', (d) => {
    const sx = d.source.x, sy = d.source.y;
    const tx = d.target.x, ty = d.target.y;
    const dx = tx - sx, dy = ty - sy;
    // Curve cross-disease edges more than intra-disease for legibility
    const sameDisease = d.source.disease === d.target.disease;
    const dr = sameDisease ? Math.hypot(dx, dy) * 2 : Math.hypot(dx, dy) * 1.1;
    return `M${sx},${sy}A${dr},${dr} 0 0,1 ${tx},${ty}`;
  });
  nodeSel.attr('transform', (d) => `translate(${d.x},${d.y})`);
});

// ---------------------------------------------------------------------------
// Drag handlers
// ---------------------------------------------------------------------------
function dragStarted(event, d) {
  if (!event.active) simulation.alphaTarget(0.25).restart();
  d.fx = d.x; d.fy = d.y;
}
function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
function dragEnded(event, d) {
  if (!event.active) simulation.alphaTarget(0);
  // Keep the node where the user dropped it (sticky), unless they double-click
  // back to free it later.
}
nodeSel.on('dblclick', (event, d) => {
  d.fx = null; d.fy = null;
  simulation.alphaTarget(0.18).restart();
  setTimeout(() => simulation.alphaTarget(0), 600);
});

// ---------------------------------------------------------------------------
// Hover highlighting
// ---------------------------------------------------------------------------
function setHoverNode(d) {
  if (state.selected) return; // selection takes precedence
  if (!d) { clearHighlight(); return; }
  const connectedIds = new Set([d.id]);
  for (const e of links) {
    if (e.source.id === d.id) connectedIds.add(e.target.id);
    if (e.target.id === d.id) connectedIds.add(e.source.id);
  }
  applyHighlight(connectedIds, (e) => e.source.id === d.id || e.target.id === d.id);
}
function setHoverEdge(d) {
  if (state.selected) return;
  if (!d) { clearHighlight(); return; }
  const ids = new Set([d.source.id, d.target.id]);
  applyHighlight(ids, (e) => e === d);
}
function applyHighlight(idSet, edgePred) {
  nodeSel.select('rect').classed('dim', (n) => !idSet.has(n.id)).classed('highlighted', (n) => idSet.has(n.id));
  nodeSel.select('.node-label').classed('dim', (n) => !idSet.has(n.id));
  nodeSel.selectAll('.node-sub').classed('dim', (n) => !idSet.has(n.id));
  edgeSel.classed('dim', (e) => !edgePred(e)).classed('highlighted', (e) => edgePred(e));
}
function clearHighlight() {
  nodeSel.select('rect').classed('dim', false).classed('highlighted', false);
  nodeSel.select('.node-label').classed('dim', false);
  nodeSel.selectAll('.node-sub').classed('dim', false);
  edgeSel.classed('dim', false).classed('highlighted', false);
}

// ---------------------------------------------------------------------------
// Selection / side panel
// ---------------------------------------------------------------------------
function selectNode(d) {
  state.selected = { type: 'node', data: d };
  renderPanelForNode(d);
  const ids = new Set([d.id]);
  for (const e of links) {
    if (e.source.id === d.id) ids.add(e.target.id);
    if (e.target.id === d.id) ids.add(e.source.id);
  }
  applyHighlight(ids, (e) => e.source.id === d.id || e.target.id === d.id);
  $('#panel').classList.add('open');
  fadeHelp();
}

function selectEdge(d) {
  state.selected = { type: 'edge', data: d };
  state.rating = { validity: null, explanation: 0, citation: 0, feedback: '' };
  renderPanelForEdge(d);
  applyHighlight(new Set([d.source.id, d.target.id]), (e) => e === d);
  $('#panel').classList.add('open');
  fadeHelp();
}

function clearSelection() {
  state.selected = null;
  $('#panel').classList.remove('open');
  clearHighlight();
}

svg.on('click', () => clearSelection());

// ---------------------------------------------------------------------------
// Side panel rendering
// ---------------------------------------------------------------------------
function renderPanelForNode(d) {
  const host = $('#panel');
  const closeBtn = el('button', { class: 'close', onClick: clearSelection, title: 'Close' }, '×');
  host.innerHTML = '';
  host.appendChild(closeBtn);

  host.appendChild(el('h2', {}, d.id));
  host.appendChild(el('p', { class: 'sub' }, d.protein || ''));

  // Disease pill
  host.appendChild(
    el('span', { class: 'edge-kind-pill', style: `background:${DISEASES[d.disease]?.soft};color:${DISEASES[d.disease]?.color}` },
      DISEASES[d.disease]?.name || d.disease),
  );

  if (d.secondary && d.secondary.length) {
    for (const s of d.secondary) {
      host.appendChild(
        el('span', { class: 'edge-kind-pill', style: `margin-left:6px;background:${DISEASES[s]?.soft};color:${DISEASES[s]?.color}` }, DISEASES[s]?.name || s),
      );
    }
  }

  // Role
  if (d.role) {
    const block = el('section', { class: 'block' });
    block.appendChild(el('h3', {}, 'Role'));
    block.appendChild(el('p', {}, d.role));
    host.appendChild(block);
  }

  // External links
  const links = el('section', { class: 'block' });
  links.appendChild(el('h3', {}, 'External resources'));
  const ul = el('ul');
  ul.appendChild(el('li', {}, el('a', { href: `https://www.genenames.org/tools/search/#!/?query=${encodeURIComponent(d.id)}`, target: '_blank', rel: 'noopener' }, 'HGNC')));
  ul.appendChild(el('li', {}, el('a', { href: `./ask.html?gene=${encodeURIComponent(d.id)}`, target: '_blank' }, 'Open in bioscope ask')));
  ul.appendChild(el('li', {}, el('a', { href: `./index.html?gene=${encodeURIComponent(d.id)}`, target: '_blank' }, 'Open brief in viewer')));
  links.appendChild(ul);
  host.appendChild(links);

  // Connections
  const myEdges = EDGES.filter((e) => e.from === d.id || e.to === d.id);
  if (myEdges.length) {
    const conn = el('section', { class: 'block' });
    conn.appendChild(el('h3', {}, `Connections (${myEdges.length})`));
    const list = el('div', { class: 'connection-list' });
    for (const e of myEdges) {
      const other = e.from === d.id ? e.to : e.from;
      const item = el('div', { class: 'conn', onClick: () => selectEdge(getLink(e)) },
        el('span', { class: 'gene' }, other),
        el('span', { class: 'arrow' }, '·'),
        el('span', { class: 'kind', style: `color:${EDGE_COLORS[e.kind]}` }, e.kind),
      );
      list.appendChild(item);
    }
    conn.appendChild(list);
    host.appendChild(conn);
  }
}

function getLink(e) {
  return links.find((l) => l.from === e.from && l.to === e.to && l.kind === e.kind);
}

function renderPanelForEdge(d) {
  const host = $('#panel');
  host.innerHTML = '';
  const closeBtn = el('button', { class: 'close', onClick: clearSelection, title: 'Close' }, '×');
  host.appendChild(closeBtn);

  host.appendChild(el('h2', {}, 'Connection'));
  host.appendChild(el('p', { class: 'sub' }, 'Click either gene name to focus that node.'));

  const pair = el('div', { class: 'edge-pair' },
    el('span', { class: 'gene', onClick: () => selectNode(d.source) }, d.source.id),
    el('span', { class: 'arrow' }, '→'),
    el('span', { class: 'gene', onClick: () => selectNode(d.target) }, d.target.id),
  );
  host.appendChild(pair);

  host.appendChild(
    el('span', { class: 'edge-kind-pill', style: `background:${EDGE_COLORS[d.kind]}22;color:${EDGE_COLORS[d.kind]}` }, d.kind),
  );

  // Explanation
  const note = el('section', { class: 'block' });
  note.appendChild(el('h3', {}, 'Interaction'));
  note.appendChild(el('p', {}, d.note || '(no description supplied)'));
  host.appendChild(note);

  // Citations
  const cit = el('section', { class: 'block' });
  cit.appendChild(el('h3', {}, `Citations (${(d.pmids || []).length})`));
  if (d.pmids && d.pmids.length) {
    const ul = el('ul');
    for (const p of d.pmids) {
      ul.appendChild(
        el('li', {}, el('a', { href: `https://pubmed.ncbi.nlm.nih.gov/${p}/`, target: '_blank', rel: 'noopener' }, `PMID:${p}`)),
      );
    }
    cit.appendChild(ul);
  } else {
    cit.appendChild(el('p', {}, 'No citations attached. If you confirm this connection, rate it ≥ 4/5 below; if not, mark it invalid.'));
  }
  host.appendChild(cit);

  // Edge rating block
  const rate = el('section', { class: 'rate-block' });
  rate.appendChild(el('h3', {}, 'Rate this connection — feeds the model'));

  // Validity row
  const validityRow = el('div', { class: 'validity-row' });
  const mkValidity = (key, label) => {
    const b = el('button', { onClick: () => {
      state.rating.validity = key;
      $$('.validity-row button').forEach((x) => x.classList.remove('sel', 'yes', 'no', 'uncertain'));
      b.classList.add('sel', key);
      updateSaveEnabled();
    } }, label);
    validityRow.appendChild(b);
    return b;
  };
  mkValidity('yes', 'Real');
  mkValidity('no', 'Not real');
  mkValidity('uncertain', 'Uncertain');
  rate.appendChild(validityRow);

  // Two-dim rating
  const dims = [
    { key: 'explanation', lbl: 'Explanation' },
    { key: 'citation',    lbl: 'Citation' },
  ];
  for (const dim of dims) {
    const row = el('div', { class: 'rate-dim' });
    row.appendChild(el('span', { class: 'lbl' }, dim.lbl));
    const stars = el('span', { class: 'stars' });
    for (let i = 1; i <= 5; i++) {
      const s = el('div', { class: 'star', onClick: () => {
        state.rating[dim.key] = i;
        renderStars(stars, dim.key);
        updateSaveEnabled();
      } }, '★');
      stars.appendChild(s);
    }
    row.appendChild(stars);
    const val = el('span', { class: 'val' }, '–');
    row.appendChild(val);
    rate.appendChild(row);
    renderStars(stars, dim.key);
  }

  // Free text
  const fb = el('textarea', { class: 'rate-feedback', placeholder: 'What did I get wrong? Any correction, missing citation, better mechanism? (optional, becomes an avoid pattern if you mark Not real)' });
  fb.addEventListener('input', (ev) => { state.rating.feedback = ev.target.value; });
  rate.appendChild(fb);

  const save = el('button', { class: 'rate-save', disabled: true, onClick: () => saveEdgeRating(d) }, 'Save judgement to model');
  rate.appendChild(save);
  host.appendChild(rate);

  function renderStars(starsEl, dimKey) {
    const cur = state.rating[dimKey];
    Array.from(starsEl.children).forEach((s, i) => s.classList.toggle('selected', cur >= i + 1));
    const valEl = starsEl.parentElement.querySelector('.val');
    if (valEl) valEl.textContent = cur || '–';
  }
  function updateSaveEnabled() {
    save.disabled = !(state.rating.validity && state.rating.explanation && state.rating.citation);
  }
}

function saveEdgeRating(d) {
  const r = state.rating;
  const entry = model.recordEdgeRating({
    edgeId: edgeId(d),
    from: d.source.id,
    to: d.target.id,
    kind: d.kind,
    proposedNote: d.note,
    proposedPmids: d.pmids,
    validity: r.validity,
    explanationQuality: r.explanation,
    citationQuality: r.citation,
    feedback: r.feedback,
  });
  if (r.validity === 'no') {
    toast(`Marked ${d.source.id} → ${d.target.id} as not real. Added avoid pattern; model bumped to ${model.version}.`, 'warn', 3800);
  } else if (r.validity === 'yes' && r.explanation >= 4) {
    toast(`Confirmed ${d.source.id} → ${d.target.id}. Promoted to few-shot example; model bumped to ${model.version}.`, 'bump', 3800);
  } else {
    toast(`Judgement saved (${r.validity}, ${r.explanation}/5, ${r.citation}/5).`, 'ok');
  }
  renderHeaderStatus();
  clearSelection();
}

// ---------------------------------------------------------------------------
// Header status + filters
// ---------------------------------------------------------------------------
function renderHeaderStatus() {
  // Model pill
  const pill = $('#model-status-pill');
  const ratedCount = model.edgeRatings.length;
  if (ratedCount > 0) {
    pill.className = 'pill trained';
    pill.textContent = `Trained · ${model.version} · ${ratedCount} edge${ratedCount === 1 ? '' : 's'} rated`;
  } else {
    pill.className = 'pill default';
    pill.textContent = `Model · ${model.version}`;
  }
}

function renderFilters() {
  const host = $('#disease-filters');
  host.innerHTML = '';
  const mk = (key, label, color, soft) => {
    const b = el('button', {
      style: state.activeFilter === key
        ? `background:${color};color:${color === '#6a7787' ? '#fff' : (key === 'ALL' ? '#0b0f14' : '#0b0f14')};`
        : '',
      onClick: () => { state.activeFilter = key; renderFilters(); applyFilter(); },
    }, label);
    if (state.activeFilter === key) b.classList.add('active');
    host.appendChild(b);
  };
  mk('ALL', 'All', '#56b1ff', '');
  for (const [key, d] of Object.entries(DISEASES)) mk(key, d.name, d.color, d.soft);
}

function applyFilter() {
  const k = state.activeFilter;
  const matches = (n) => k === 'ALL' || n.disease === k || (n.secondary || []).includes(k);
  nodeSel.style('opacity', (n) => matches(n) ? 1 : 0.18);
  edgeSel.style('opacity', (e) => {
    if (k === 'ALL') return 0.65;
    return matches(e.source) || matches(e.target) ? 0.85 : 0.05;
  });
}

function renderLegend() {
  const host = $('#edge-legend');
  host.innerHTML = '';
  for (const item of EDGE_LEGEND) {
    host.appendChild(
      el('span', { class: 'item' },
        el('span', { class: 'swatch', style: `background:${EDGE_COLORS[item.kind]}` }),
        el('span', {}, item.label),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------
function fadeHelp() {
  const h = $('#help-overlay');
  if (h) h.classList.add('fading');
}

window.addEventListener('resize', () => {
  simulation.force('x', d3.forceX((d) => seedX(d)).strength(0.06));
  simulation.force('y', d3.forceY(H() * 0.5).strength(0.025));
  simulation.alphaTarget(0.1).restart();
  setTimeout(() => simulation.alphaTarget(0), 600);
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
function boot() {
  renderHeaderStatus();
  renderFilters();
  renderLegend();
  $('#zoom-in').addEventListener('click', () => zoomBy(1.3));
  $('#zoom-out').addEventListener('click', () => zoomBy(1 / 1.3));
  $('#zoom-reset').addEventListener('click', () => zoomReset());
  $('#dismiss-help').addEventListener('click', () => $('#help-overlay').remove());
  model.on('change', renderHeaderStatus);
  // Kick the simulation
  simulation.alpha(1).restart();
  setTimeout(() => simulation.alphaTarget(0), 1800);
}

document.addEventListener('DOMContentLoaded', boot);
