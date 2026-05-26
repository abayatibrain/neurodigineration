// neurodigineration — interactive cross-disease network.
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
import { loadApiKey, looksLikeAnthropicKey, saveApiKey, streamClaude } from './anthropic.js';

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

// ---------------------------------------------------------------------------
// Merge in any SME-accepted novel edges from BioscopeModel state. These
// were added via the train page's Free-Pair / AI-suggested flow → Accept
// into graph button → recordAcceptedEdge. They render as dashed-green
// overlays so they're visually distinct from curated solid + dotted edges.
// ---------------------------------------------------------------------------
const acceptedEdges = (model.acceptedEdges || []).map((ae) => ({
  from: ae.from,
  to: ae.to,
  kind: ae.kind || 'shared-mechanism',
  note: ae.note || '',
  pmids: Array.isArray(ae.pmids) ? ae.pmids : [],
  strength: typeof ae.strength === 'number' ? ae.strength : 0.6,
  accepted: true,
  acceptedAt: ae.acceptedAt,
  acceptedId: ae.id,
}));
// Append to EDGES so all downstream code (filters, lookups, simulation) sees them
for (const ae of acceptedEdges) {
  // Inject endpoints as nodes if either is missing (defensive — should already
  // exist via the panel-injection step above, but accepted edges may reference
  // genes that aren't in the panel for some reason).
  for (const id of [ae.from, ae.to]) {
    if (!nodeById.has(id)) {
      const node = { id, protein: id, disease: 'SHARED', prevalence: 0.35, role: 'accepted-edge endpoint', _fromAccepted: true };
      NODES.push(node);
      nodeById.set(id, node);
    }
  }
  EDGES.push(ae);
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
  // Reset = recentre on SNCA at the default zoomed-out scale, matching
  // the initial-load view. If SNCA isn't in NODES for some reason fall
  // back to the plain identity transform.
  if (!recenterOnSNCA(0.55, 380)) {
    svg.transition().duration(380).call(zoom.transform, d3.zoomIdentity);
  }
}

/**
 * Translate + scale the SVG so that SNCA sits at the centre of the viewport.
 * Returns true if SNCA was found, false otherwise. Used both on initial
 * load (with a long transition to settle the eye) and by the zoom-reset
 * button.
 */
function recenterOnSNCA(scale = 0.55, ms = 800) {
  const snca = NODES.find((n) => n.id === 'SNCA');
  if (!snca || typeof snca.x !== 'number') return false;
  const w = W();
  const h = H();
  const tx = w / 2 - snca.x * scale;
  const ty = h / 2 - snca.y * scale;
  svg.transition().duration(ms)
    .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  return true;
}

// (The simulation.on('end', ...) hook that recentres on SNCA is registered
//  AFTER the simulation is created — see below, just after the const.)

// ---------------------------------------------------------------------------
// Force simulation
// ---------------------------------------------------------------------------
// Each NODE gets {x,y,vx,vy} from d3.forceSimulation. We seed initial x
// by disease so the first layout reads as columns before physics settles.
// All 11 disease groups are placed left→right so HSP/CMT/TAU don't pile up
// at center. The canvas is intentionally wider than the visible window —
// users can pan + zoom into the spread map. SPREAD scales the total canvas.
const diseaseOrder = ['NBIA', 'CMT', 'HSP', 'ALS', 'PD', 'SHARED', 'AD', 'TAU', 'HD', 'PRION', 'LSD'];
const SPREAD_X = 2400;  // wider seed canvas (was ~1200) so the 200+ nodes have room
const SPREAD_Y = 1600;  // taller seed canvas
function seedX(n) {
  const i = diseaseOrder.indexOf(n.disease);
  if (i < 0) return W() / 2;
  return ((i + 0.5) / diseaseOrder.length) * Math.max(W(), SPREAD_X);
}
function seedY(n) {
  return H() * 0.5 + (Math.random() - 0.5) * Math.max(H(), SPREAD_Y) * 0.85;
}
for (const n of NODES) { n.x = seedX(n); n.y = seedY(n); }

// Convert string from/to in EDGES into node references (d3 force expects)
const links = EDGES.map((e) => ({ ...e, source: e.from, target: e.to }));

// Force tuning for ~204 nodes:
//   - link distance 180-50*s  (was 120-50*s)  → edges are longer overall
//   - charge -380 to -700     (was -240 to -460) → stronger node repulsion
//   - collide +10              (was +6)        → more breathing room per box
//   - x-seed strength 0.04     (was 0.06)      → weaker pull to seed column,
//     so the disease columns are suggestions rather than walls
//   - y-seed strength 0.015    (was 0.025)     → looser vertical anchor
const simulation = d3.forceSimulation(NODES)
  .force('link', d3.forceLink(links).id((d) => d.id)
    .distance((d) => 180 - 50 * (d.strength || 0.5))
    .strength((d) => 0.14 + 0.35 * (d.strength || 0.5)))
  .force('charge', d3.forceManyBody().strength((d) => -380 - 320 * (d.prevalence || 0.4)))
  .force('collide', d3.forceCollide().radius((d) => nodeRadius(d) + 10))
  .force('x', d3.forceX((d) => seedX(d)).strength(0.04))
  .force('y', d3.forceY(H() * 0.5).strength(0.015))
  .alphaDecay(0.022);

// After the initial simulation has cooled, recentre once on SNCA so the
// page opens with the user's anchor gene in the middle of the view.
// (recenterOnSNCA is declared above; this is the registration site that
//  has to live AFTER `const simulation = ...` to avoid the TDZ.)
let initialCenterDone = false;
simulation.on('end', () => {
  if (initialCenterDone) return;
  initialCenterDone = true;
  recenterOnSNCA(0.55, 700);
});
// Belt-and-braces: if 'end' never fires (heavy graphs re-warm before
// settling), centre after a fixed timeout.
setTimeout(() => {
  if (initialCenterDone) return;
  initialCenterDone = true;
  recenterOnSNCA(0.55, 700);
}, 1800);

function nodeRadius(n) {
  // Box "size" — actually we use rounded rects; expose as a single number for collision.
  return 18 + (n.prevalence || 0.4) * 22;
}

// ---------------------------------------------------------------------------
// Render: edges
// ---------------------------------------------------------------------------
// Two-layer edges: a wider invisible "hit area" path captures clicks/hover
// so edges are easy to grab even at 1-2px visible thickness. The visible
// edge has pointer-events:none so it never steals clicks from its hit layer.
const edgeHitSel = gEdges.selectAll('path.edge-hit')
  .data(links, edgeId)
  .enter()
  .append('path')
  .attr('class', 'edge-hit')
  .attr('fill', 'none')
  .attr('stroke', 'transparent')
  .attr('stroke-width', 16)
  .style('cursor', 'pointer')
  .style('pointer-events', 'stroke')
  .on('click', (event, d) => {
    event.stopPropagation();
    selectEdge(d);
  })
  .on('mouseover', (event, d) => setHoverEdge(d))
  .on('mouseout', () => setHoverEdge(null));

const edgeSel = gEdges.selectAll('path.edge')
  .data(links, edgeId)
  .enter()
  .append('path')
  .attr('class', (d) => `edge${d.tentative ? ' tangential' : ''}${d.accepted ? ' accepted' : ''}`)
  // Accepted (SME-confirmed novel) edges render green; curated edges use EDGE_COLORS by kind
  .attr('stroke', (d) => d.accepted ? '#15803d' : EDGE_COLORS[d.kind])
  .attr('stroke-width', (d) => (d.accepted ? 1.6 : 0.9) + 2.4 * (d.strength || 0.5))
  .attr('opacity', (d) => d.accepted ? 0.85 : (d.tentative ? 0.5 : 0.65))
  .style('pointer-events', 'none');

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
  const pathFor = (d) => {
    const sx = d.source.x, sy = d.source.y;
    const tx = d.target.x, ty = d.target.y;
    const dx = tx - sx, dy = ty - sy;
    const sameDisease = d.source.disease === d.target.disease;
    const dr = sameDisease ? Math.hypot(dx, dy) * 2 : Math.hypot(dx, dy) * 1.1;
    return `M${sx},${sy}A${dr},${dr} 0 0,1 ${tx},${ty}`;
  };
  edgeSel.attr('d', pathFor);
  edgeHitSel.attr('d', pathFor);
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
  ul.appendChild(el('li', {}, el('a', { href: `./ask.html?gene=${encodeURIComponent(d.id)}`, target: '_blank' }, 'Open in neurodigineration ask')));
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
  if (d.tentative) {
    host.appendChild(
      el('span', { class: 'edge-kind-pill', style: 'margin-left:6px; background:var(--gold-soft); color:var(--gold);' }, 'Tangential · needs SME validation'),
    );
  }
  if (d.accepted) {
    host.appendChild(
      el('span', { class: 'edge-kind-pill', style: 'margin-left:6px; background:#dcfce7; color:#15803d;', title: `Accepted ${d.acceptedAt ? new Date(d.acceptedAt).toISOString().slice(0,10) : ''}` }, 'SME accepted · from train page'),
    );
  }

  // Explanation
  const note = el('section', { class: 'block' });
  note.appendChild(el('h3', {}, 'Interaction'));
  note.appendChild(el('p', {}, d.note || '(no description supplied)'));
  host.appendChild(note);

  // Sources — for now we link to the NCBI Gene records for both genes
  // rather than per-claim PMIDs. The PMIDs in the data are placeholders
  // pending SME validation; surfacing them as authoritative would be
  // misleading. NCBI Gene gives the SME a quick way to verify the gene
  // identity and follow into its literature themselves.
  const ncbiUrl = (sym) => `https://www.ncbi.nlm.nih.gov/gene/?term=${encodeURIComponent(sym)}%5BGene+Symbol%5D+AND+human%5BOrganism%5D`;
  const cit = el('section', { class: 'block' });
  cit.appendChild(el('h3', {}, 'Sources'));
  cit.appendChild(el('p', {}, 'Per-claim PMIDs need SME validation (deferred). For now, jump to NCBI Gene for either gene to verify identity and explore literature.'));
  const ul = el('ul');
  ul.appendChild(el('li', {}, el('a', { href: ncbiUrl(d.source.id), target: '_blank', rel: 'noopener' }, `NCBI Gene: ${d.source.id}`)));
  ul.appendChild(el('li', {}, el('a', { href: ncbiUrl(d.target.id), target: '_blank', rel: 'noopener' }, `NCBI Gene: ${d.target.id}`)));
  cit.appendChild(ul);
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
  // Disease colors are mostly dark/saturated, so the active chip uses
  // white text on the colored bg in both themes. The "All" chip uses
  // the current accent.
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#56b1ff';
  const mk = (key, label, color) => {
    const b = el('button', {
      style: state.activeFilter === key
        ? `background:${color};color:#ffffff;border-color:transparent;font-weight:600;`
        : '',
      onClick: () => { state.activeFilter = key; renderFilters(); applyFilter(); },
    }, label);
    if (state.activeFilter === key) b.classList.add('active');
    host.appendChild(b);
  };
  mk('ALL', 'All', accent);
  for (const [key, d] of Object.entries(DISEASES)) mk(key, d.name, d.color);
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
  // SME-accepted edges legend chip (only shown if any exist)
  const acceptedCount = (model.acceptedEdges || []).length;
  if (acceptedCount > 0) {
    host.appendChild(
      el('span', { class: 'item', title: `${acceptedCount} SME-accepted edge${acceptedCount === 1 ? '' : 's'} from the train page` },
        el('span', {
          class: 'swatch',
          style: 'background: repeating-linear-gradient(90deg, #15803d 0, #15803d 4px, transparent 4px, transparent 8px); border:1px solid #15803d;',
        }),
        el('span', {}, `SME accepted (${acceptedCount})`),
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
  simulation.force('x', d3.forceX((d) => seedX(d)).strength(0.04));
  simulation.force('y', d3.forceY(H() * 0.5).strength(0.015));
  simulation.alphaTarget(0.1).restart();
  setTimeout(() => simulation.alphaTarget(0), 600);
});

// ---------------------------------------------------------------------------
// Suggest-a-connection corner prompt — SME asks, Claude proposes
// ---------------------------------------------------------------------------
// Free-text prompt → Claude returns {from,to,kind,note,pmids[]} → the new
// edge is drawn on the canvas as a dashed transient edge AND the side panel
// opens with the rating block, so the SME judges it like any other edge.
//
// The user-suggested edge is also injected into the live `links` array so
// it appears in the SVG; on reload it's gone (we don't persist the data
// graph here — but the EDGE RATING is persisted via recordEdgeRating).
const SUGGEST_PROMPT = `You are neurodigineration, proposing a biological connection between two genes/proteins from a free-text SME prompt.

The SME may give you two gene symbols (e.g., "SNCA TFEB"), a question (e.g., "is BRCA1 connected to neurodegeneration?"), or a description. Identify the most relevant gene/protein pair and propose the strongest documented connection.

Return ONLY a single JSON object with this exact shape, no markdown fences, no preamble:

{
  "from": "<HGNC symbol of first gene>",
  "to": "<HGNC symbol of second gene>",
  "kind": "kinase-substrate" | "receptor-ligand" | "complex" | "modifier" | "shared-mechanism" | "shared-disease" | "opposes" | "none",
  "note": "<2-3 sentence mechanistic explanation. If kind=none, explain what each gene does and that no significant connection is documented.>",
  "pmids": ["<pmid1>", "<pmid2>"]
}

Rules:
- Cite REAL PubMed PMIDs only — do not invent.
- Prefer kind="none" over fabricating.
- Pick the most specific kind that applies.
- note: ≤ 400 characters.
- pmids: ≤ 3 entries.
- Honesty about absence of connection is rewarded; fabrication is penalised.`;

function setupSuggestCard() {
  const card = $('#suggest-card');
  const toggle = $('#suggest-toggle');
  const closeBtn = $('#suggest-close');
  const openBtn = $('#suggest-open');
  const head = $('#suggest-head');
  const goBtn = $('#suggest-go');
  const input = $('#suggest-input');

  // Hidden by default — opened via the ✦ header button.
  const setOpen = (open) => {
    if (open) {
      card.hidden = false;
      card.classList.remove('collapsed');
      if (toggle) toggle.textContent = '−';
      openBtn?.classList.add('active');
      input?.focus();
    } else {
      card.hidden = true;
      openBtn?.classList.remove('active');
    }
  };

  openBtn?.addEventListener('click', () => setOpen(card.hidden));
  closeBtn?.addEventListener('click', () => setOpen(false));

  // Clicking the header (but not its sub-buttons) collapses the body.
  head.addEventListener('click', (e) => {
    if (e.target === toggle || e.target === closeBtn || e.target === goBtn) return;
    card.classList.toggle('collapsed');
    toggle.textContent = card.classList.contains('collapsed') ? '+' : '−';
  });
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    card.classList.toggle('collapsed');
    toggle.textContent = card.classList.contains('collapsed') ? '+' : '−';
  });

  goBtn.addEventListener('click', () => askSuggestion(input.value.trim()));
  input.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') askSuggestion(input.value.trim());
  });
}

function setupLegendFloat() {
  const btn = $('#legend-toggle');
  const body = $('#legend-body');
  if (!btn || !body) return;
  btn.addEventListener('click', () => {
    const isOpen = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!isOpen));
    if (isOpen) body.setAttribute('hidden', '');
    else body.removeAttribute('hidden');
  });
}

async function askSuggestion(text) {
  if (!text) { toast('Type a suggestion first.', 'warn'); return; }
  const apiKey = (loadApiKey() || '').trim();
  if (!apiKey || !looksLikeAnthropicKey(apiKey)) {
    toast('This needs your Anthropic key — set it on the Train or Ask page.', 'warn', 4200);
    return;
  }

  const goBtn = $('#suggest-go');
  const meta = $('#suggest-meta');
  goBtn.disabled = true; goBtn.textContent = 'Asking…';
  meta.textContent = 'thinking';

  try {
    const result = await streamClaude({
      apiKey,
      model: model.settings.anthropicModel,
      system: SUGGEST_PROMPT,
      messages: [{ role: 'user', content: text }],
      maxTokens: 800,
    });
    let parsed;
    try {
      const m = result.text.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : JSON.parse(result.text);
    } catch {
      toast('Claude did not return parseable JSON. Try rephrasing.', 'warn', 4000);
      return;
    }
    const from = (parsed.from || '').toUpperCase();
    const to   = (parsed.to   || '').toUpperCase();
    if (!from || !to) { toast('Claude could not identify two genes.', 'warn'); return; }

    // Look up or auto-inject nodes for from/to so the dashed edge has endpoints
    let nodeFrom = nodeById.get(from);
    let nodeTo   = nodeById.get(to);
    if (!nodeFrom) {
      nodeFrom = { id: from, protein: from, disease: 'SHARED', prevalence: 0.4, role: 'auto-added from SME suggestion', x: W()/2 - 80, y: H()/2 };
      NODES.push(nodeFrom); nodeById.set(from, nodeFrom);
    }
    if (!nodeTo) {
      nodeTo = { id: to, protein: to, disease: 'SHARED', prevalence: 0.4, role: 'auto-added from SME suggestion', x: W()/2 + 80, y: H()/2 };
      NODES.push(nodeTo); nodeById.set(to, nodeTo);
    }

    // Append a transient dashed edge so the SME sees what Claude proposed
    const newLink = {
      from, to, kind: parsed.kind || 'none',
      note: parsed.note || '',
      pmids: Array.isArray(parsed.pmids) ? parsed.pmids.filter(Boolean) : [],
      strength: 0.6,
      source: nodeFrom, target: nodeTo,
      _userSuggested: true,
      _prompt: text,
    };
    links.push(newLink);
    rerenderGraphIncremental();

    // Open the side panel with the proposed connection + rating block
    selectEdge(newLink);
    meta.textContent = `${result.usage?.input_tokens || 0}/${result.usage?.output_tokens || 0} tok`;
    toast(`Proposed ${from} ↔ ${to} (${parsed.kind}). Rate it in the side panel.`, 'ok');
  } catch (err) {
    console.error(err);
    toast(`Failed: ${err.message}`, 'danger', 5000);
    meta.textContent = 'failed';
  } finally {
    goBtn.disabled = false; goBtn.textContent = 'Ask Claude';
  }
}

function rerenderGraphIncremental() {
  // Add any new hit-area path
  const hitEnter = gEdges.selectAll('path.edge-hit').data(links, edgeId).enter()
    .append('path').attr('class', 'edge-hit')
    .attr('fill', 'none').attr('stroke', 'transparent').attr('stroke-width', 16)
    .style('cursor', 'pointer').style('pointer-events', 'stroke')
    .on('click', (event, d) => { event.stopPropagation(); selectEdge(d); })
    .on('mouseover', (event, d) => setHoverEdge(d))
    .on('mouseout', () => setHoverEdge(null));

  // Add any new visible edge
  const visEnter = gEdges.selectAll('path.edge').data(links, edgeId).enter()
    .append('path').attr('class', (d) => `edge ${d._userSuggested ? 'user-edge' : ''}`)
    .attr('stroke', (d) => EDGE_COLORS[d.kind] || '#888')
    .attr('stroke-width', (d) => 0.9 + 2.6 * (d.strength || 0.5))
    .attr('opacity', 0.7).style('pointer-events', 'none');

  // Add any new node
  const nodeEnter = gNodes.selectAll('g.node-group').data(NODES, (d) => d.id).enter()
    .append('g').attr('class', 'node-group')
    .style('color', (d) => DISEASES[d.disease]?.color || '#888')
    .on('click', (event, d) => { event.stopPropagation(); selectNode(d); })
    .on('mouseover', (event, d) => setHoverNode(d))
    .on('mouseout', () => setHoverNode(null))
    .call(d3.drag().on('start', dragStarted).on('drag', dragged).on('end', dragEnded));
  nodeEnter.append('rect').attr('class', 'node-bg')
    .attr('width', (d) => nodeWidth(d)).attr('height', (d) => nodeHeight(d))
    .attr('x', (d) => -nodeWidth(d)/2).attr('y', (d) => -nodeHeight(d)/2)
    .attr('rx', 6)
    .attr('fill', (d) => DISEASES[d.disease]?.soft || '#11161d')
    .attr('stroke', (d) => DISEASES[d.disease]?.color || '#888');
  nodeEnter.append('text').attr('class', 'node-label')
    .attr('dy', (d) => -1).attr('font-size', (d) => 11 + (d.prevalence || 0.4) * 4)
    .text((d) => d.id);

  // Refresh sel references (D3 v7 selectAll re-binds)
  // Restart simulation to lay out new nodes/edges
  simulation.nodes(NODES);
  simulation.force('link').links(links);
  simulation.alpha(0.7).restart();
  setTimeout(() => simulation.alphaTarget(0), 1400);
}

// ---------------------------------------------------------------------------
// Theme toggle (light/dark)
// ---------------------------------------------------------------------------
// The inline script in network.html applies the saved theme BEFORE first
// paint so there's no flash. Here we just wire the toggle button.
const THEME_KEY = 'nd-network-theme';
function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}
function setTheme(t) {
  if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  try { localStorage.setItem(THEME_KEY, t); } catch { /* noop */ }
}
function toggleTheme() {
  setTheme(currentTheme() === 'light' ? 'dark' : 'light');
}

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
  // Help overlay — hidden on load; opened/closed by the "?" header button
  // and dismissed by the "Got it" button. Re-openable, not destroyed.
  const helpOverlay = $('#help-overlay');
  const helpOpenBtn = $('#help-open');
  const setHelpOpen = (open) => {
    if (open) {
      helpOverlay.hidden = false;
      helpOpenBtn?.classList.add('active');
    } else {
      helpOverlay.hidden = true;
      helpOpenBtn?.classList.remove('active');
    }
  };
  helpOpenBtn?.addEventListener('click', () => setHelpOpen(helpOverlay.hidden));
  $('#dismiss-help').addEventListener('click', () => setHelpOpen(false));
  $('#theme-toggle').addEventListener('click', toggleTheme);
  setupSuggestCard();
  setupLegendFloat();
  model.on('change', renderHeaderStatus);
  // Kick the simulation
  simulation.alpha(1).restart();
  setTimeout(() => simulation.alphaTarget(0), 1800);
}

document.addEventListener('DOMContentLoaded', boot);
