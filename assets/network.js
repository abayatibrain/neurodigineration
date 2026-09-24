// neurodigineration — interactive cross-disease network.
//
// D3 v7 force-directed graph. Each node = a gene/protein; each edge = a
// curated biological relationship. The SME judges edges in the side panel;
// every judgement goes to BioscopeModel.recordEdgeRating, is pooled per gene
// pair into a consensus, and is compiled into every later prompt that
// touches those genes (train, ask and this page's suggest box).
//
// What the page does beyond drawing the graph:
//   - gene search (/ to focus) and deep links (?gene= / ?edge=A~B / ?path=A~B)
//   - path tracing: the cheapest mechanistic routes between two genes,
//     preferring strong, curated, SME-confirmed edges and never using
//     rejected ones
//   - live PubMed evidence per edge: listed PMIDs are resolved (and flagged
//     when PubMed does not know them), plus a title/abstract co-mention count
//   - verdict styling: confirmed edges turn solid, rejected ones red-dotted,
//     contested ones gold
//   - a triage queue that walks unrated edges, tentative ones first
//
// Imports D3 from CDN as an ES module so the page stays zero-build.

import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

import { BioscopeModel, pairKey } from './model.js';
import {
  DISEASES, NODES, EDGES, EDGE_COLORS, EDGE_LEGEND,
  EDGE_KIND_DEFS, EDGE_KIND_GUIDE, DIRECTIONAL_KINDS,
} from './network-data.js';
import { loadApiKey, looksLikeAnthropicKey, streamClaude } from './anthropic.js';
import { pubmedSummaries, pubmedCoMention } from './pubmed.js';

const model = new BioscopeModel();
const panelBySymbol = new Map(model.panel.map((g) => [g.symbol, g]));

// ---------------------------------------------------------------------------
// Build lookup tables and inject any panel gene that isn't already a node
// (so genes an SME added to their local panel appear, too).
// ---------------------------------------------------------------------------
const nodeById = new Map(NODES.map((n) => [n.id, n]));
for (const g of model.panel) {
  if (!nodeById.has(g.symbol)) {
    const inserted = {
      id: g.symbol,
      protein: g.notes || g.symbol,
      disease: guessDisease(g),
      prevalence: 0.4,
      role: g.notes || '',
      _fromPanel: true,
    };
    NODES.push(inserted);
    nodeById.set(g.symbol, inserted);
  }
}

function guessDisease(g) {
  const t = ((g.notes || '') + ' ' + (g.expectTokens || []).join(' ')).toLowerCase();
  if (/parkinson/.test(t)) return 'PD';
  if (/alzheim/.test(t)) return 'AD';
  if (/\bals\b|\bftd\b|amyotrophic|frontotemporal/.test(t)) return 'ALS';
  if (/huntington|polyq|ataxin|spinocerebellar/.test(t)) return 'HD';
  if (/prion|cjd|\bprp\b/.test(t)) return 'PRION';
  if (/lysosom|gaucher|niemann|tay-sachs|pompe|krabbe/.test(t)) return 'LSD';
  if (/nbia|iron/.test(t)) return 'NBIA';
  if (/spastic/.test(t)) return 'HSP';
  if (/charcot|cmt\d/.test(t)) return 'CMT';
  return 'SHARED';
}

// ---------------------------------------------------------------------------
// Merge SME-accepted novel edges from BioscopeModel state. These come from
// the train page (Free pair / AI-suggested → Accept into graph) or from
// this page's suggest box, and render as dashed-green overlays.
// ---------------------------------------------------------------------------
function acceptedToEdge(ae) {
  return {
    from: ae.from,
    to: ae.to,
    kind: EDGE_COLORS[ae.kind] ? ae.kind : 'shared-mechanism',
    note: ae.note || '',
    pmids: Array.isArray(ae.pmids) ? ae.pmids : [],
    strength: typeof ae.strength === 'number' ? ae.strength : 0.6,
    accepted: true,
    acceptedAt: ae.acceptedAt,
    acceptedId: ae.id,
  };
}
function ensureNode(id, role) {
  if (!nodeById.has(id)) {
    const n = { id, protein: id, disease: 'SHARED', prevalence: 0.35, role, _auto: true };
    NODES.push(n);
    nodeById.set(id, n);
  }
  return nodeById.get(id);
}
for (const ae of model.acceptedEdges) {
  ensureNode(ae.from, 'accepted-edge endpoint');
  ensureNode(ae.to, 'accepted-edge endpoint');
  EDGES.push(acceptedToEdge(ae));
}

const degree = new Map();
function recomputeDegree() {
  degree.clear();
  for (const n of NODES) degree.set(n.id, 0);
  for (const e of links) {
    const a = e.source.id ?? e.source, b = e.target.id ?? e.target;
    degree.set(a, (degree.get(a) || 0) + 1);
    degree.set(b, (degree.get(b) || 0) + 1);
  }
}

// ---------------------------------------------------------------------------
// DOM helpers
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
const VIEW_KEY = 'nd-network-view';
const state = {
  selected: null, // { type: 'node'|'edge'|'path', data }
  activeFilter: 'ALL', // disease key or 'ALL'
  hiddenKinds: new Set(),
  hideTentative: false,
  showVerdicts: true,
  path: null, // { from, to, routes: [{ nodes, edges, cost }] }
  triage: false,
  triageSkipped: new Set(),
  rating: { validity: null, explanation: 0, citation: 0, feedback: '' },
  panelToken: 0, // guards async evidence rendering against stale panels
};
try {
  const v = JSON.parse(localStorage.getItem(VIEW_KEY) || '{}');
  if (Array.isArray(v.hiddenKinds)) state.hiddenKinds = new Set(v.hiddenKinds);
  if (typeof v.hideTentative === 'boolean') state.hideTentative = v.hideTentative;
  if (typeof v.showVerdicts === 'boolean') state.showVerdicts = v.showVerdicts;
} catch { /* private mode / blocked storage: defaults are fine */ }
function saveView() {
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify({
      hiddenKinds: [...state.hiddenKinds], hideTentative: state.hideTentative, showVerdicts: state.showVerdicts,
    }));
  } catch { /* noop */ }
}

let suggestSeq = 0;
const edgeId = (e) => `${e.from}→${e.to}|${e.kind}${e.acceptedId ? `#${e.acceptedId}` : ''}${e._sid ? `#s${e._sid}` : ''}`;
const idOf = (x) => (typeof x === 'object' ? x.id : x);

// Consensus per gene pair, refreshed whenever the model changes.
let consensus = model.edgeConsensusMap();
const verdictOf = (e) => consensus.get(pairKey(idOf(e.source ?? e.from), idOf(e.target ?? e.to)));

// ---------------------------------------------------------------------------
// SVG + zoom
// ---------------------------------------------------------------------------
const svgEl = $('#graph');
const W = () => svgEl.clientWidth;
const H = () => svgEl.clientHeight;
const svg = d3.select(svgEl);

const defs = svg.append('defs');
const filt = defs.append('filter').attr('id', 'glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
filt.append('feGaussianBlur').attr('stdDeviation', 3.5).attr('result', 'blur');
const merge = filt.append('feMerge');
merge.append('feMergeNode').attr('in', 'blur');
merge.append('feMergeNode').attr('in', 'SourceGraphic');

const gZoom = svg.append('g').attr('class', 'zoom-root');
const gEdges = gZoom.append('g').attr('class', 'edges-layer');
const gNodes = gZoom.append('g').attr('class', 'nodes-layer');

const zoom = d3.zoom()
  .scaleExtent([0.2, 4])
  .on('zoom', (event) => gZoom.attr('transform', event.transform));
svg.call(zoom).on('dblclick.zoom', null);

function zoomBy(factor) {
  svg.transition().duration(220).call(zoom.scaleBy, factor);
}
function zoomReset() {
  if (!recenterOn('SNCA', 0.55, 380)) svg.transition().duration(380).call(zoom.transform, d3.zoomIdentity);
}

/** Centre the viewport on one node at a given scale. */
function recenterOn(id, scale = 0.55, ms = 800) {
  const n = nodeById.get(id);
  if (!n || typeof n.x !== 'number') return false;
  svg.transition().duration(ms)
    .call(zoom.transform, d3.zoomIdentity.translate(W() / 2 - n.x * scale, H() / 2 - n.y * scale).scale(scale));
  return true;
}

/** Fit a set of nodes into the visible canvas (left of the side panel). */
function zoomToNodes(nodes, { maxScale = 1.4, ms = 650 } = {}) {
  const pts = nodes.filter((n) => typeof n?.x === 'number');
  if (!pts.length) return;
  const panelOpen = $('#panel').classList.contains('open');
  const right = W() - (panelOpen && W() > 760 ? $('#panel').offsetWidth : 0);
  // Keep clear of the left cards when the legend or path tracer is expanded.
  const cardsOpen = !$('#path-card').hidden || !$('#legend-body').hidden;
  const left = cardsOpen && W() > 760 ? $('.left-stack').getBoundingClientRect().right + 8 : 0;
  const visW = right - left;
  const pad = 110;
  const [x0, x1] = d3.extent(pts, (n) => n.x);
  const [y0, y1] = d3.extent(pts, (n) => n.y);
  const scale = Math.min(maxScale, (visW - pad * 2) / Math.max(1, x1 - x0), (H() - pad * 2) / Math.max(1, y1 - y0));
  const s = Math.max(0.25, scale);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  svg.transition().duration(ms)
    .call(zoom.transform, d3.zoomIdentity.translate(left + visW / 2 - cx * s, H() / 2 - cy * s).scale(s));
}

// ---------------------------------------------------------------------------
// Force simulation
// ---------------------------------------------------------------------------
// Initial x is seeded by disease so the first layout reads as columns
// before physics settles; the canvas is intentionally wider than the
// window; users pan and zoom into it.
const diseaseOrder = ['NBIA', 'CMT', 'HSP', 'ALS', 'PD', 'SHARED', 'AD', 'TAU', 'HD', 'PRION', 'LSD'];
const SPREAD_X = 2400;
const SPREAD_Y = 1600;
function seedX(n) {
  const i = diseaseOrder.indexOf(n.disease);
  if (i < 0) return W() / 2;
  return ((i + 0.5) / diseaseOrder.length) * Math.max(W(), SPREAD_X);
}
function seedY() {
  return H() * 0.5 + (Math.random() - 0.5) * Math.max(H(), SPREAD_Y) * 0.85;
}
for (const n of NODES) { n.x = seedX(n); n.y = seedY(); }

const links = EDGES.map((e) => ({ ...e, source: e.from, target: e.to }));

const simulation = d3.forceSimulation(NODES)
  .force('link', d3.forceLink(links).id((d) => d.id)
    .distance((d) => 180 - 50 * (d.strength || 0.5))
    .strength((d) => 0.14 + 0.35 * (d.strength || 0.5)))
  .force('charge', d3.forceManyBody().strength((d) => -380 - 320 * (d.prevalence || 0.4)))
  .force('collide', d3.forceCollide().radius((d) => nodeRadius(d) + 10))
  .force('x', d3.forceX((d) => seedX(d)).strength(0.04))
  .force('y', d3.forceY(H() * 0.5).strength(0.015))
  .alphaDecay(0.022);
recomputeDegree();

// Once the first layout has cooled, apply any deep link or centre on SNCA.
let initialViewDone = false;
function initialView() {
  if (initialViewDone) return;
  initialViewDone = true;
  if (!applyDeepLink()) recenterOn('SNCA', 0.55, 700);
}
simulation.on('end', initialView);
setTimeout(initialView, 1800); // heavy graphs can re-warm before 'end'

function nodeRadius(n) { return 18 + (n.prevalence || 0.4) * 22; }
function nodeWidth(d) { return 56 + (d.prevalence || 0.4) * 50; }
function nodeHeight(d) { return 26 + (d.prevalence || 0.4) * 14; }
function truncate(s, n) { return (s || '').length <= n ? (s || '') : (s || '').slice(0, n - 1) + '…'; }

// ---------------------------------------------------------------------------
// Render (data joins, so edges/nodes added later get drawn and ticked)
// ---------------------------------------------------------------------------
let edgeSel = d3.select(null);
let edgeHitSel = d3.select(null);
let nodeSel = d3.select(null);

function edgeClass(d) {
  const v = state.showVerdicts ? verdictOf(d) : null;
  return [
    'edge',
    d.tentative && 'tangential',
    d.accepted && 'accepted',
    d._userSuggested && !d.accepted && 'user-edge',
    v?.status === 'confirmed' && 'verdict-yes',
    v?.status === 'rejected' && 'verdict-no',
    v?.status === 'contested' && 'verdict-mixed',
  ].filter(Boolean).join(' ');
}

function renderEdges() {
  edgeHitSel = gEdges.selectAll('path.edge-hit')
    .data(links, edgeId)
    .join((enter) => enter.append('path')
      .attr('class', 'edge-hit')
      .attr('fill', 'none')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 16)
      .style('cursor', 'pointer')
      .style('pointer-events', 'stroke')
      .on('click', (event, d) => { event.stopPropagation(); selectEdge(d); })
      .on('mouseover', (event, d) => setHoverEdge(d))
      .on('mouseout', () => setHoverEdge(null)));

  edgeSel = gEdges.selectAll('path.edge')
    .data(links, edgeId)
    .join((enter) => enter.append('path').style('pointer-events', 'none'))
    .attr('class', edgeClass)
    .attr('stroke', (d) => (d.accepted ? '#15803d' : EDGE_COLORS[d.kind] || '#888'))
    .attr('stroke-width', (d) => (d.accepted ? 1.6 : 0.9) + 2.4 * (d.strength || 0.5));
  // Hit paths sit above visible paths so thin edges stay easy to grab.
  edgeHitSel.raise();
  applyVisibility();
}

function renderNodes() {
  nodeSel = gNodes.selectAll('g.node-group')
    .data(NODES, (d) => d.id)
    .join((enter) => {
      const g = enter.append('g')
        .attr('class', 'node-group')
        .style('color', (d) => DISEASES[d.disease]?.color || '#888')
        .on('click', (event, d) => { event.stopPropagation(); selectNode(d); })
        .on('dblclick', (event, d) => {
          d.fx = null; d.fy = null;
          simulation.alphaTarget(0.18).restart();
          setTimeout(() => simulation.alphaTarget(0), 600);
        })
        .on('mouseover', (event, d) => setHoverNode(d))
        .on('mouseout', () => setHoverNode(null))
        .call(d3.drag().on('start', dragStarted).on('drag', dragged).on('end', dragEnded));
      g.append('rect')
        .attr('class', 'node-bg')
        .attr('width', (d) => nodeWidth(d))
        .attr('height', (d) => nodeHeight(d))
        .attr('x', (d) => -nodeWidth(d) / 2)
        .attr('y', (d) => -nodeHeight(d) / 2)
        .attr('rx', 6)
        .attr('fill', (d) => DISEASES[d.disease]?.soft || '#11161d')
        .attr('stroke', (d) => DISEASES[d.disease]?.color || '#888');
      g.append('text')
        .attr('class', 'node-label')
        .attr('dy', (d) => -1 + ((d.prevalence || 0.4) > 0.7 ? -3 : 0))
        .attr('font-size', (d) => 11 + (d.prevalence || 0.4) * 4)
        .text((d) => d.id);
      g.filter((d) => (d.prevalence || 0) > 0.7)
        .append('text')
        .attr('class', 'node-sub')
        .attr('dy', 11)
        .text((d) => truncate(d.protein, 18));
      return g;
    });
  applyVisibility();
}

const edgePath = (d) => {
  const sx = d.source.x, sy = d.source.y;
  const tx = d.target.x, ty = d.target.y;
  const dist = Math.hypot(tx - sx, ty - sy);
  const dr = d.source.disease === d.target.disease ? dist * 2 : dist * 1.1;
  return `M${sx},${sy}A${dr},${dr} 0 0,1 ${tx},${ty}`;
};
simulation.on('tick', () => {
  edgeSel.attr('d', edgePath);
  edgeHitSel.attr('d', edgePath);
  nodeSel.attr('transform', (d) => `translate(${d.x},${d.y})`);
});

function dragStarted(event, d) {
  if (!event.active) simulation.alphaTarget(0.25).restart();
  d.fx = d.x; d.fy = d.y;
}
function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
function dragEnded(event) {
  // Sticky: the node stays where it was dropped until double-clicked.
  if (!event.active) simulation.alphaTarget(0);
}

// ---------------------------------------------------------------------------
// Visibility: kind toggles, tentative toggle, disease filter
// ---------------------------------------------------------------------------
const edgeVisible = (e) => !state.hiddenKinds.has(e.kind) && !(state.hideTentative && e.tentative && !e.accepted);
const nodeMatches = (n) => state.activeFilter === 'ALL' || n.disease === state.activeFilter ||
  (n.secondary || []).includes(state.activeFilter);

function baseEdgeOpacity(e) {
  if (state.activeFilter !== 'ALL') return nodeMatches(e.source) || nodeMatches(e.target) ? 0.85 : 0.05;
  if (state.showVerdicts && verdictOf(e)?.status === 'rejected') return 0.4;
  if (e.accepted) return 0.85;
  return e.tentative ? 0.5 : 0.65;
}

// Opacity goes on the presentation attribute (not inline style) so the
// .dim / .highlighted CSS classes still win during hover and selection.
function applyVisibility() {
  edgeSel
    .style('display', (e) => (edgeVisible(e) ? null : 'none'))
    .attr('opacity', baseEdgeOpacity);
  edgeHitSel.style('display', (e) => (edgeVisible(e) ? null : 'none'));
  nodeSel.attr('opacity', (n) => (nodeMatches(n) ? 1 : 0.18));
}

// ---------------------------------------------------------------------------
// Highlighting
// ---------------------------------------------------------------------------
const neighbourIds = (d) => {
  const ids = new Set([d.id]);
  for (const e of links) {
    if (!edgeVisible(e)) continue;
    if (e.source.id === d.id) ids.add(e.target.id);
    if (e.target.id === d.id) ids.add(e.source.id);
  }
  return ids;
};
function setHoverNode(d) {
  if (state.selected || state.path) return;
  if (!d) { clearHighlight(); return; }
  applyHighlight(neighbourIds(d), (e) => e.source.id === d.id || e.target.id === d.id);
}
function setHoverEdge(d) {
  if (state.selected || state.path) return;
  if (!d) { clearHighlight(); return; }
  applyHighlight(new Set([d.source.id, d.target.id]), (e) => e === d);
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
function highlightPath() {
  if (!state.path) return;
  const ids = new Set(state.path.routes.flatMap((r) => r.nodes));
  const es = new Set(state.path.routes.flatMap((r) => r.edges));
  applyHighlight(ids, (e) => es.has(e));
}

// ---------------------------------------------------------------------------
// Selection, URL state
// ---------------------------------------------------------------------------
function setURL(params) {
  // Built by hand so shared links keep a readable "~" (URLSearchParams would
  // write %7E): ?gene=SNCA, ?edge=GBA~SNCA, ?path=GBA~MAPT.
  const keep = new URLSearchParams(location.search);
  for (const k of ['gene', 'edge', 'path']) keep.delete(k);
  const parts = [...keep].map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  for (const [k, v] of Object.entries(params)) parts.push(`${k}=${encodeURIComponent(v)}`);
  history.replaceState(null, '', location.pathname + (parts.length ? `?${parts.join('&')}` : '') + location.hash);
}

function openPanel() {
  $('#panel').classList.add('open');
  fadeHelp();
}

function selectNode(d, { zoomTo = false } = {}) {
  state.selected = { type: 'node', data: d };
  state.triage = false;
  state.path = null;
  syncTriageButton();
  renderPanelForNode(d);
  applyHighlight(neighbourIds(d), (e) => edgeVisible(e) && (e.source.id === d.id || e.target.id === d.id));
  openPanel();
  setURL({ gene: d.id });
  if (zoomTo) zoomToNodes([...neighbourIds(d)].map((id) => nodeById.get(id)), { maxScale: 1.2 });
}

function selectEdge(d, { zoomTo = false } = {}) {
  state.selected = { type: 'edge', data: d };
  state.rating = { validity: null, explanation: 0, citation: 0, feedback: '' };
  renderPanelForEdge(d);
  if (state.path && state.path.routes.some((r) => r.edges.includes(d))) {
    const ids = new Set(state.path.routes.flatMap((r) => r.nodes));
    applyHighlight(ids, (e) => e === d);
  } else {
    applyHighlight(new Set([d.source.id, d.target.id]), (e) => e === d);
  }
  openPanel();
  setURL({ edge: `${d.source.id}~${d.target.id}` });
  if (zoomTo) zoomToNodes([d.source, d.target], { maxScale: 1.3 });
}

function clearSelection() {
  state.selected = null;
  state.path = null;
  state.triage = false;
  syncTriageButton();
  $('#panel').classList.remove('open');
  clearHighlight();
  setURL({});
}

svg.on('click', () => clearSelection());

const findLink = (a, b) => links.find((l) => pairKey(l.source.id, l.target.id) === pairKey(a, b));

function applyDeepLink() {
  const p = new URLSearchParams(location.search);
  const gene = (p.get('gene') || '').toUpperCase();
  const edge = p.get('edge');
  const path = p.get('path');
  if (gene && nodeById.has(gene)) {
    selectNode(nodeById.get(gene), { zoomTo: true });
    return true;
  }
  if (edge) {
    const [a, b] = edge.toUpperCase().split('~');
    const l = findLink(a, b);
    if (l) { selectEdge(l, { zoomTo: true }); return true; }
  }
  if (path) {
    const [a, b] = path.toUpperCase().split('~');
    if (nodeById.has(a) && nodeById.has(b)) {
      $('#path-from').value = a;
      $('#path-to').value = b;
      tracePath(a, b);
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Side panel: node
// ---------------------------------------------------------------------------
function panelShell(title, sub) {
  const host = $('#panel');
  state.panelToken++;
  host.innerHTML = '';
  host.scrollTop = 0;
  host.appendChild(el('button', { class: 'close', onClick: clearSelection, title: 'Close (Esc)' }, '×'));
  if (state.path && state.selected?.type === 'edge') {
    host.appendChild(el('button', { class: 'back-link', onClick: () => showPathPanel() }, '← back to path'));
  }
  host.appendChild(el('h2', {}, title));
  if (sub) host.appendChild(el('p', { class: 'sub' }, sub));
  return host;
}

const diseasePill = (key, extraStyle = '') =>
  el('span', { class: 'edge-kind-pill', style: `${extraStyle}background:${DISEASES[key]?.soft};color:${DISEASES[key]?.color}` },
    DISEASES[key]?.name || key);

const VERDICT_GLYPH = { confirmed: '✓', rejected: '✕', contested: '±', uncertain: '?' };
const VERDICT_LABEL = { confirmed: 'you confirmed', rejected: 'you rejected', contested: 'contested', uncertain: 'uncertain' };

function renderPanelForNode(d) {
  const host = panelShell(d.id, d.protein || '');
  host.appendChild(diseasePill(d.disease));
  for (const s of d.secondary || []) host.appendChild(diseasePill(s, 'margin-left:6px;'));

  const myEdges = links.filter((e) => e.source.id === d.id || e.target.id === d.id);
  const rated = myEdges.filter((e) => verdictOf(e)?.n).length;
  const cited = myEdges.filter((e) => (e.pmids || []).length).length;
  const bridges = new Set(myEdges.map((e) => (e.source.id === d.id ? e.target : e.source).disease));
  bridges.delete('SHARED');
  bridges.delete(d.disease);
  host.appendChild(el('p', { class: 'node-stats' },
    `${myEdges.length} connection${myEdges.length === 1 ? '' : 's'} · ${cited} cited · ${rated} rated by you` +
    (bridges.size ? ` · reaches ${[...bridges].map((k) => DISEASES[k]?.short || k).join(', ')}` : '')));

  if (d.role) {
    const block = el('section', { class: 'block' });
    block.appendChild(el('h3', {}, 'Role'));
    block.appendChild(el('p', {}, d.role));
    const pg = panelBySymbol.get(d.id);
    if (pg?.aliases?.length) block.appendChild(el('p', { class: 'muted small' }, `Also known as ${pg.aliases.join(', ')}`));
    host.appendChild(block);
  }

  const actions = el('div', { class: 'panel-actions' },
    el('button', { class: 'chip-btn', onClick: () => openPathCard(d.id) }, 'Trace a path from here'),
    el('a', { class: 'chip-btn', href: `./index.html?gene=${encodeURIComponent(d.id)}`, target: '_blank' }, 'Brief'),
    el('a', { class: 'chip-btn', href: `./ask.html?gene=${encodeURIComponent(d.id)}`, target: '_blank' }, 'Ask'),
    el('a', { class: 'chip-btn', href: ncbiGeneUrl(d.id), target: '_blank', rel: 'noopener' }, 'NCBI Gene'),
    el('a', { class: 'chip-btn', href: `https://www.genenames.org/tools/search/#!/?query=${encodeURIComponent(d.id)}`, target: '_blank', rel: 'noopener' }, 'HGNC'),
  );
  host.appendChild(actions);

  if (myEdges.length) {
    const conn = el('section', { class: 'block' });
    conn.appendChild(el('h3', {}, `Connections (${myEdges.length})`));
    const order = [...EDGE_LEGEND.map((x) => x.kind)];
    const byKind = d3.group(myEdges, (e) => e.kind);
    for (const kind of [...byKind.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b))) {
      conn.appendChild(el('div', { class: 'conn-kind', style: `color:${EDGE_COLORS[kind]}` },
        EDGE_LEGEND.find((x) => x.kind === kind)?.label || kind));
      const list = el('div', { class: 'connection-list' });
      for (const e of byKind.get(kind).sort((a, b) => (b.strength || 0) - (a.strength || 0))) {
        const outgoing = e.source.id === d.id;
        const other = outgoing ? e.target.id : e.source.id;
        const v = verdictOf(e);
        const arrow = DIRECTIONAL_KINDS.has(e.kind) ? (outgoing ? '→' : '←') : '·';
        list.appendChild(el('div', { class: `conn${edgeVisible(e) ? '' : ' hidden-kind'}`, onClick: () => selectEdge(e), title: truncate(e.note, 220) },
          el('span', { class: 'arrow' }, arrow),
          el('span', { class: 'gene' }, other),
          e.tentative ? el('span', { class: 'tag tent', title: 'tentative' }, 'tentative') : null,
          (e.pmids || []).length ? el('span', { class: 'tag', title: `${e.pmids.length} PMID(s)` }, `${e.pmids.length} ref`) : null,
          v?.n ? el('span', { class: `verdict v-${v.status}`, title: VERDICT_LABEL[v.status] }, VERDICT_GLYPH[v.status]) : null,
        ));
      }
      conn.appendChild(list);
    }
    host.appendChild(conn);
  }
}

// ---------------------------------------------------------------------------
// Side panel: edge
// ---------------------------------------------------------------------------
const ncbiGeneUrl = (sym) => `https://www.ncbi.nlm.nih.gov/gene/?term=${encodeURIComponent(sym)}%5BGene+Symbol%5D+AND+human%5BOrganism%5D`;
const namesFor = (sym) => [sym, ...((panelBySymbol.get(sym)?.aliases) || []).filter((a) => a.length >= 3 && !/\s{2,}/.test(a))].slice(0, 5);

function renderPanelForEdge(d) {
  const host = panelShell('Connection', d._userSuggested ? `Proposed by Claude from: “${truncate(d._prompt, 90)}”` : 'Click either gene to focus it.');
  if (state.triage) host.appendChild(renderTriageBar());

  const directional = DIRECTIONAL_KINDS.has(d.kind);
  host.appendChild(el('div', { class: 'edge-pair' },
    el('span', { class: 'gene', onClick: () => selectNode(d.source) }, d.source.id),
    el('span', { class: 'arrow', title: directional ? 'actor → target' : 'undirected' }, directional ? '→' : '–'),
    el('span', { class: 'gene', onClick: () => selectNode(d.target) }, d.target.id),
  ));

  const pills = el('div', { class: 'pill-row' },
    el('span', { class: 'edge-kind-pill', style: `background:${EDGE_COLORS[d.kind]}22;color:${EDGE_COLORS[d.kind]}` }, d.kind),
    d.tentative ? el('span', { class: 'edge-kind-pill', style: 'background:var(--gold-soft); color:var(--gold);' }, 'Tentative · needs SME validation') : null,
    d.accepted ? el('span', { class: 'edge-kind-pill', style: 'background:#dcfce7; color:#15803d;', title: `Accepted ${d.acceptedAt ? new Date(d.acceptedAt).toISOString().slice(0, 10) : ''}` }, 'SME accepted') : null,
  );
  host.appendChild(pills);
  if (EDGE_KIND_DEFS[d.kind]) host.appendChild(el('p', { class: 'kind-def' }, `${d.kind}: ${EDGE_KIND_DEFS[d.kind]}`));

  const note = el('section', { class: 'block' });
  note.appendChild(el('h3', {}, 'Interaction'));
  note.appendChild(el('p', {}, d.note || '(no description supplied)'));
  host.appendChild(note);

  const v = verdictOf(d);
  if (v?.n) host.appendChild(renderVerdictBlock(v));

  host.appendChild(renderEvidenceBlock(d));
  host.appendChild(renderRatingBlock(d));
}

function renderVerdictBlock(v) {
  const block = el('section', { class: `block verdict-block v-${v.status}` });
  block.appendChild(el('h3', {}, 'Your verdicts on this pair'));
  block.appendChild(el('p', {},
    el('strong', {}, `${VERDICT_GLYPH[v.status]} ${VERDICT_LABEL[v.status]}`),
    ` · ${v.yes} real, ${v.no} not real, ${v.uncertain} uncertain · P(real) ≈ ${v.pReal.toFixed(2)}`));
  if (v.meanExplanation != null) {
    block.appendChild(el('p', { class: 'muted small' },
      `Mean explanation ${v.meanExplanation.toFixed(1)}/5 · citation ${v.meanCitation.toFixed(1)}/5 · last ${new Date(v.last.ratedAt).toLocaleDateString()}`));
  }
  if (v.last?.feedback) block.appendChild(el('p', { class: 'quote' }, `“${v.last.feedback}”`));
  if (v.status === 'contested') {
    block.appendChild(el('p', { class: 'muted small' }, 'Contested pairs are left out of prompts until the verdicts agree.'));
  }
  return block;
}

function renderEvidenceBlock(d) {
  const token = state.panelToken;
  const live = () => token === state.panelToken;
  const block = el('section', { class: 'block evidence' });
  block.appendChild(el('h3', {}, 'Evidence · live from PubMed'));

  // 1) Listed PMIDs, resolved.
  const pmids = (d.pmids || []).filter(Boolean);
  const listed = el('div', { class: 'ev-part' });
  if (!pmids.length) {
    listed.appendChild(el('p', { class: 'muted small' }, 'No PMIDs curated for this edge yet. Use the co-mention hits below to find one, then note it in your feedback.'));
  } else {
    listed.appendChild(el('p', { class: 'muted small' }, `Listed citations (${pmids.length}). Check that each paper actually supports the claim:`));
    const ul = el('ul', { class: 'refs' }, pmids.map((p) => el('li', { 'data-pmid': p }, el('span', { class: 'muted' }, `PMID ${p} · resolving…`))));
    listed.appendChild(ul);
    pubmedSummaries(pmids).then((rows) => {
      if (!live()) return;
      let missing = 0;
      ul.innerHTML = '';
      for (const r of rows) {
        if (r.found) {
          ul.appendChild(el('li', {},
            el('a', { href: `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`, target: '_blank', rel: 'noopener' }, r.title),
            el('span', { class: 'ref-meta' }, ` ${r.firstAuthor ? `${r.firstAuthor} · ` : ''}${r.journal} ${r.year} · PMID ${r.pmid}`)));
        } else {
          missing++;
          ul.appendChild(el('li', { class: 'ref-missing' }, `PMID ${r.pmid}: not found in PubMed`));
        }
      }
      if (missing) {
        listed.appendChild(el('p', { class: 'warn-line' },
          `${missing} of ${rows.length} PMID${rows.length === 1 ? '' : 's'} did not resolve. ${d._userSuggested ? 'Claude likely invented them, so score Citation 1.' : 'Treat as a curation error.'}`));
      }
    }).catch((err) => {
      if (!live()) return;
      ul.innerHTML = '';
      ul.appendChild(el('li', { class: 'muted' }, `Could not reach PubMed (${err.message}). Links: `,
        ...pmids.map((p) => el('a', { href: `https://pubmed.ncbi.nlm.nih.gov/${p}/`, target: '_blank', rel: 'noopener', style: 'margin-right:6px' }, p))));
    });
  }
  block.appendChild(listed);

  // 2) Co-mention search.
  const a = d.source.id, b = d.target.id;
  const co = el('div', { class: 'ev-part' });
  const coHead = el('p', { class: 'muted small' }, `Papers naming both ${a} and ${b} in title/abstract · searching…`);
  co.appendChild(coHead);
  const shortSym = [a, b].filter((s) => s.length <= 3);
  pubmedCoMention(namesFor(a), namesFor(b)).then((res) => {
    if (!live()) return;
    coHead.innerHTML = '';
    coHead.appendChild(el('strong', {}, res.count.toLocaleString()));
    coHead.appendChild(document.createTextNode(` paper${res.count === 1 ? '' : 's'} name both ${a} and ${b} `));
    coHead.appendChild(el('a', { href: res.url, target: '_blank', rel: 'noopener' }, 'open search ↗'));
    if (shortSym.length) {
      co.appendChild(el('p', { class: 'muted small' }, `${shortSym.join(', ')} is a short symbol, so the count may be inflated by unrelated uses.`));
    } else if (res.count === 0) {
      co.appendChild(el('p', { class: 'muted small' }, 'Zero co-mentions is not proof of absence (papers use protein names), but a direct-interaction claim with none deserves scepticism.'));
    }
    if (res.top.length) {
      co.appendChild(el('ul', { class: 'refs' }, res.top.map((r) => el('li', {},
        el('a', { href: `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`, target: '_blank', rel: 'noopener' }, r.title),
        el('span', { class: 'ref-meta' }, ` ${r.journal} ${r.year} · PMID ${r.pmid}`)))));
    }
  }).catch((err) => {
    if (!live()) return;
    coHead.textContent = `Co-mention search failed (${err.message}).`;
  });
  block.appendChild(co);

  block.appendChild(el('p', { class: 'small gene-links' },
    el('a', { href: ncbiGeneUrl(a), target: '_blank', rel: 'noopener' }, `NCBI Gene: ${a}`), ' · ',
    el('a', { href: ncbiGeneUrl(b), target: '_blank', rel: 'noopener' }, `NCBI Gene: ${b}`)));
  return block;
}

function renderRatingBlock(d) {
  const rate = el('section', { class: 'rate-block' });
  rate.appendChild(el('h3', {}, 'Rate this connection — feeds the model'));

  const validityRow = el('div', { class: 'validity-row' });
  const mkValidity = (key, label) => {
    const b = el('button', {
      onClick: () => {
        state.rating.validity = key;
        validityRow.querySelectorAll('button').forEach((x) => x.classList.remove('sel', 'yes', 'no', 'uncertain'));
        b.classList.add('sel', key);
        updateSaveEnabled();
      },
    }, label);
    validityRow.appendChild(b);
  };
  mkValidity('yes', 'Real');
  mkValidity('no', 'Not real');
  mkValidity('uncertain', 'Uncertain');
  rate.appendChild(validityRow);

  for (const dim of [{ key: 'explanation', lbl: 'Explanation' }, { key: 'citation', lbl: 'Citation' }]) {
    const row = el('div', { class: 'rate-dim' });
    row.appendChild(el('span', { class: 'lbl' }, dim.lbl));
    const stars = el('span', { class: 'stars' });
    const val = el('span', { class: 'val' }, '–');
    const paint = () => {
      const cur = state.rating[dim.key];
      Array.from(stars.children).forEach((s, i) => s.classList.toggle('selected', cur >= i + 1));
      val.textContent = cur || '–';
    };
    for (let i = 1; i <= 5; i++) {
      stars.appendChild(el('div', { class: 'star', onClick: () => { state.rating[dim.key] = i; paint(); updateSaveEnabled(); } }, '★'));
    }
    row.appendChild(stars);
    row.appendChild(val);
    rate.appendChild(row);
  }

  const fb = el('textarea', { class: 'rate-feedback', placeholder: 'What is wrong or missing? Correction, better mechanism, a PMID that actually supports it… (optional; shown to Claude next time these genes come up)' });
  fb.addEventListener('input', (ev) => { state.rating.feedback = ev.target.value; });
  rate.appendChild(fb);

  if (d._userSuggested && !d.accepted) {
    rate.appendChild(el('p', { class: 'muted small' }, 'Marking this Real adds it to your graph as an SME-accepted edge.'));
  }
  const save = el('button', { class: 'rate-save', disabled: true, onClick: () => saveEdgeRating(d) }, 'Save judgement to model');
  rate.appendChild(save);
  function updateSaveEnabled() {
    save.disabled = !(state.rating.validity && state.rating.explanation && state.rating.citation);
  }
  return rate;
}

function saveEdgeRating(d) {
  const r = state.rating;
  model.recordEdgeRating({
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
  if (d._userSuggested && !d.accepted && r.validity === 'yes') {
    const ae = model.recordAcceptedEdge({
      from: d.source.id, to: d.target.id, kind: d.kind, note: d.note, pmids: d.pmids, strength: d.strength, source: 'live',
    });
    Object.assign(d, { accepted: true, acceptedAt: ae.acceptedAt, acceptedId: ae.id });
    renderEdges();
  }
  const c = model.edgeConsensus(d.source.id, d.target.id);
  const pair = `${d.source.id}–${d.target.id}`;
  if (r.validity === 'no') {
    toast(`${pair} rejected (pair now ${c.status}). Prompts touching these genes will say so; model ${model.version}.`, 'warn', 3800);
  } else if (r.validity === 'yes') {
    toast(`${pair} confirmed (pair now ${c.status}); model ${model.version}.`, 'bump', 3200);
  } else {
    toast(`Saved as uncertain (${c.n} verdict${c.n === 1 ? '' : 's'} on this pair).`, 'ok');
  }
  if (state.triage) { nextTriage(); return; }
  if (state.path) { showPathPanel(); return; }
  clearSelection();
}

// ---------------------------------------------------------------------------
// Triage queue: unrated edges, tentative first
// ---------------------------------------------------------------------------
function triageQueue() {
  return links
    .filter((e) => edgeVisible(e) && !verdictOf(e)?.n && !state.triageSkipped.has(edgeId(e)))
    .filter((e) => state.activeFilter === 'ALL' || nodeMatches(e.source) || nodeMatches(e.target))
    .sort((a, b) =>
      (b.tentative ? 1 : 0) - (a.tentative ? 1 : 0) ||
      ((a.pmids || []).length ? 1 : 0) - ((b.pmids || []).length ? 1 : 0) ||
      (degree.get(b.source.id) + degree.get(b.target.id)) - (degree.get(a.source.id) + degree.get(a.target.id)));
}
function nextTriage() {
  const q = triageQueue();
  if (!q.length) {
    state.triage = false;
    syncTriageButton();
    toast(state.triageSkipped.size ? 'Queue empty. Only skipped edges remain.' : 'Every visible edge has a verdict. Nice.', 'ok', 3200);
    clearSelection();
    return;
  }
  state.triage = true;
  syncTriageButton();
  state.path = null;
  selectEdge(q[0], { zoomTo: true });
}
function renderTriageBar() {
  const q = triageQueue();
  const tent = q.filter((e) => e.tentative).length;
  return el('div', { class: 'triage-bar' },
    el('span', {}, `Triage · ${q.length} unrated${tent ? ` (${tent} tentative)` : ''}${state.activeFilter !== 'ALL' ? ` in ${DISEASES[state.activeFilter]?.short}` : ''}`),
    el('button', { onClick: () => { state.triageSkipped.add(edgeId(state.selected.data)); nextTriage(); } }, 'Skip ›'),
    el('button', { onClick: () => clearSelection() }, 'Stop'),
  );
}
function syncTriageButton() {
  $('#triage-open')?.classList.toggle('active', state.triage);
}

// ---------------------------------------------------------------------------
// Path tracing
// ---------------------------------------------------------------------------
// Edge cost favours strong, curated, mechanistic, SME-confirmed links.
// Rejected pairs are excluded outright; shared-disease co-implication is
// penalised because "both cause ALS" is not a mechanism.
function edgeCost(e, avoidTentative) {
  const v = verdictOf(e);
  if (v?.status === 'rejected') return Infinity;
  if (avoidTentative && e.tentative && v?.status !== 'confirmed') return Infinity;
  let c = 1 + 0.8 * (1 - (e.strength ?? 0.5));
  if (e.tentative) c += 1.2;
  if (e.kind === 'shared-disease') c += 0.8;
  else if (e.kind === 'shared-mechanism') c += 0.25;
  if (v?.status === 'confirmed' || e.accepted) c -= 0.4;
  if ((e.pmids || []).length) c -= 0.1;
  return Math.max(0.2, c);
}

function shortestPath(from, to, costOf) {
  const adj = new Map();
  for (const e of links) {
    if (!edgeVisible(e)) continue;
    const c = costOf(e);
    if (!Number.isFinite(c)) continue;
    const a = e.source.id, b = e.target.id;
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push([b, e, c]);
    adj.get(b).push([a, e, c]);
  }
  const dist = new Map([[from, 0]]);
  const prev = new Map();
  const done = new Set();
  while (true) {
    let u = null, best = Infinity;
    for (const [k, dv] of dist) if (!done.has(k) && dv < best) { best = dv; u = k; }
    if (u === null || u === to) break;
    done.add(u);
    for (const [v, e, c] of adj.get(u) || []) {
      const nd = best + c;
      if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); prev.set(v, [u, e]); }
    }
  }
  if (!dist.has(to)) return null;
  const nodes = [to];
  const edges = [];
  let cur = to;
  while (cur !== from) {
    const [p, e] = prev.get(cur);
    edges.unshift(e);
    nodes.unshift(p);
    cur = p;
  }
  return { nodes, edges };
}

/** Up to three distinct routes: after each, its edges get pricier. */
function tracePath(from, to) {
  from = from.toUpperCase(); to = to.toUpperCase();
  if (!nodeById.has(from) || !nodeById.has(to)) { toast(`Unknown gene: ${!nodeById.has(from) ? from : to}`, 'warn'); return; }
  if (from === to) { toast('Pick two different genes.', 'warn'); return; }
  const avoid = $('#path-avoid-tentative').checked;
  const penalty = new Map();
  const routes = [];
  const seen = new Set();
  for (let i = 0; i < 6 && routes.length < 3; i++) {
    const r = shortestPath(from, to, (e) => edgeCost(e, avoid) * (penalty.get(e) || 1));
    if (!r) break;
    const cost = r.edges.reduce((s, e) => s + edgeCost(e, avoid), 0);
    const sig = r.nodes.join('>');
    if (!seen.has(sig) && (!routes.length || cost <= routes[0].cost * 1.6)) {
      seen.add(sig);
      routes.push({ ...r, cost });
    }
    for (const e of r.edges) penalty.set(e, (penalty.get(e) || 1) * 4);
  }
  if (!routes.length) {
    toast(`No route between ${from} and ${to} with the current filters${avoid ? ' (tentative edges excluded)' : ''}.`, 'warn', 3600);
    return;
  }
  state.path = { from, to, routes };
  state.triage = false;
  syncTriageButton();
  showPathPanel();
  setURL({ path: `${from}~${to}` });
  zoomToNodes(routes.flatMap((r) => r.nodes).map((id) => nodeById.get(id)), { maxScale: 1.2 });
}

function showPathPanel() {
  const { from, to, routes } = state.path;
  state.selected = { type: 'path', data: state.path };
  const host = panelShell('Path', `${from} → ${to} · ${routes.length} route${routes.length === 1 ? '' : 's'}`);
  routes.forEach((r, idx) => {
    const tentative = r.edges.filter((e) => e.tentative && verdictOf(e)?.status !== 'confirmed').length;
    const weakKinds = r.edges.filter((e) => e.kind === 'shared-disease').length;
    const block = el('section', { class: 'block path-route' });
    block.appendChild(el('h3', {}, `Route ${idx + 1} · ${r.edges.length} step${r.edges.length === 1 ? '' : 's'} · cost ${r.cost.toFixed(1)}`));
    const steps = el('ol', { class: 'path-steps' });
    r.edges.forEach((e, i) => {
      const a = r.nodes[i], b = r.nodes[i + 1];
      const forward = e.source.id === a;
      const dirGlyph = DIRECTIONAL_KINDS.has(e.kind) ? (forward ? '→' : '←') : '–';
      const v = verdictOf(e);
      steps.appendChild(el('li', { onClick: () => selectEdge(e) },
        el('div', { class: 'step-head' },
          el('span', { class: 'gene' }, a),
          el('span', { class: 'dir', style: `color:${EDGE_COLORS[e.kind]}` }, ` ${dirGlyph} `),
          el('span', { class: 'gene' }, b),
          el('span', { class: 'kind', style: `color:${EDGE_COLORS[e.kind]}` }, e.kind),
          e.tentative ? el('span', { class: 'tag tent' }, 'tentative') : null,
          v?.n ? el('span', { class: `verdict v-${v.status}` }, VERDICT_GLYPH[v.status]) : null),
        el('div', { class: 'step-note' }, truncate(e.note, 190))));
    });
    block.appendChild(steps);
    if (tentative || weakKinds) {
      const bits = [];
      if (tentative) bits.push(`${tentative} of ${r.edges.length} step${r.edges.length === 1 ? ' is' : 's are'} tentative`);
      if (weakKinds) bits.push(`${weakKinds} step${weakKinds === 1 ? ' is' : 's are'} shared-disease only`);
      block.appendChild(el('p', { class: 'warn-line' }, `${bits.join(' and ')}. Read this chain as a hypothesis, not a mechanism.`));
    }
    host.appendChild(block);
  });
  host.appendChild(el('p', { class: 'muted small' },
    'Routes prefer strong, curated, mechanistic edges and your confirmations; edges you rejected are never used. Click a step to read and rate it.'));
  highlightPath();
  openPanel();
}

function openPathCard(prefillFrom) {
  const card = $('#path-card');
  card.hidden = false;
  $('#path-open')?.classList.add('active');
  if (prefillFrom) $('#path-from').value = prefillFrom;
  ($('#path-from').value ? $('#path-to') : $('#path-from')).focus();
}

function setupPathCard() {
  const card = $('#path-card');
  const dl = $('#gene-list');
  for (const n of [...NODES].sort((a, b) => a.id.localeCompare(b.id))) dl.appendChild(el('option', { value: n.id }, n.protein));
  $('#path-open').addEventListener('click', () => {
    if (card.hidden) openPathCard(state.selected?.type === 'node' ? state.selected.data.id : '');
    else { card.hidden = true; $('#path-open').classList.remove('active'); }
  });
  $('#path-close').addEventListener('click', () => { card.hidden = true; $('#path-open').classList.remove('active'); });
  const go = () => tracePath($('#path-from').value.trim(), $('#path-to').value.trim());
  $('#path-go').addEventListener('click', go);
  for (const id of ['#path-from', '#path-to']) $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  $('#path-swap').addEventListener('click', () => {
    const a = $('#path-from').value;
    $('#path-from').value = $('#path-to').value;
    $('#path-to').value = a;
  });
}

// ---------------------------------------------------------------------------
// Gene search
// ---------------------------------------------------------------------------
function searchGenes(q) {
  q = q.trim().toUpperCase();
  if (!q) return [];
  const scored = [];
  for (const n of NODES) {
    const aliases = (panelBySymbol.get(n.id)?.aliases || []).map((a) => a.toUpperCase());
    const prot = (n.protein || '').toUpperCase();
    let s = 0;
    if (n.id === q) s = 100;
    else if (n.id.startsWith(q)) s = 80 - n.id.length * 0.1;
    else if (aliases.includes(q)) s = 70;
    else if (aliases.some((a) => a.startsWith(q))) s = 50;
    else if (n.id.includes(q)) s = 40;
    else if (prot.includes(q)) s = 25;
    else if (q.length >= 4 && (n.role || '').toUpperCase().includes(q)) s = 10;
    if (s) scored.push([s + (n.prevalence || 0), n]);
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, 8).map((x) => x[1]);
}

function setupSearch() {
  const input = $('#gene-search');
  const list = $('#gene-search-results');
  let results = [];
  let active = 0;
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); };
  const choose = (n) => {
    if (!n) return;
    input.value = '';
    close();
    input.blur();
    state.path = null;
    selectNode(n, { zoomTo: true });
  };
  const paint = () => {
    list.innerHTML = '';
    if (!results.length) {
      list.appendChild(el('li', { class: 'empty' }, 'No match in the graph'));
    }
    results.forEach((n, i) => {
      list.appendChild(el('li', {
        class: i === active ? 'active' : '', role: 'option',
        onMousedown: (ev) => { ev.preventDefault(); choose(n); },
      },
      el('span', { class: 'dot', style: `background:${DISEASES[n.disease]?.color}` }),
      el('span', { class: 'sym' }, n.id),
      el('span', { class: 'prot' }, truncate(n.protein, 34))));
    });
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };
  input.addEventListener('input', () => {
    results = searchGenes(input.value);
    active = 0;
    if (input.value.trim()) paint(); else close();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { active = Math.min(results.length - 1, active + 1); paint(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); paint(); e.preventDefault(); }
    else if (e.key === 'Enter') { choose(results[active]); e.preventDefault(); }
    else if (e.key === 'Escape') { input.value = ''; close(); input.blur(); }
  });
  input.addEventListener('blur', () => setTimeout(close, 120));
}

// ---------------------------------------------------------------------------
// Header status, filters, legend
// ---------------------------------------------------------------------------
function renderHeaderStatus() {
  const pill = $('#model-status-pill');
  const n = model.edgeRatings.length;
  if (n > 0) {
    pill.className = 'pill trained';
    pill.textContent = `Model ${model.version} · ${n} verdict${n === 1 ? '' : 's'}`;
  } else {
    pill.className = 'pill default';
    pill.textContent = `Model · ${model.version}`;
  }
  pill.title = 'Your edge verdicts are pooled per gene pair and sent to Claude with any request that touches those genes.';
}

function renderFilters() {
  const host = $('#disease-filters');
  host.innerHTML = '';
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#56b1ff';
  const mk = (key, label, color, title) => {
    const b = el('button', {
      title,
      style: state.activeFilter === key ? `background:${color};color:#ffffff;border-color:transparent;font-weight:600;` : '',
      onClick: () => { state.activeFilter = key; renderFilters(); applyVisibility(); },
    }, label);
    if (state.activeFilter === key) b.classList.add('active');
    host.appendChild(b);
  };
  mk('ALL', 'All', accent, 'All disease groups');
  for (const [key, d] of Object.entries(DISEASES)) mk(key, d.short === '·' ? 'Shared' : d.short, d.color, d.name);
}

function renderLegend() {
  const host = $('#edge-legend');
  host.innerHTML = '';
  const counts = d3.rollup(links, (v) => v.length, (e) => e.kind);
  for (const item of EDGE_LEGEND) {
    const off = state.hiddenKinds.has(item.kind);
    host.appendChild(el('button', {
      class: `item${off ? ' off' : ''}`,
      title: `${EDGE_KIND_DEFS[item.kind] || ''} Click to ${off ? 'show' : 'hide'}.`,
      onClick: () => {
        if (off) state.hiddenKinds.delete(item.kind); else state.hiddenKinds.add(item.kind);
        saveView(); renderLegend(); applyVisibility();
      },
    },
    el('span', { class: 'swatch', style: `background:${EDGE_COLORS[item.kind]}` }),
    el('span', { class: 'lbl' }, item.label),
    el('span', { class: 'count' }, counts.get(item.kind) || 0)));
  }
  const acceptedCount = links.filter((e) => e.accepted).length;
  if (acceptedCount > 0) {
    host.appendChild(el('span', { class: 'item static', title: 'SME-accepted edges from the train page or the suggest box' },
      el('span', { class: 'swatch', style: 'background: repeating-linear-gradient(90deg, #15803d 0, #15803d 4px, transparent 4px, transparent 8px); border:1px solid #15803d;' }),
      el('span', { class: 'lbl' }, 'SME accepted'),
      el('span', { class: 'count' }, acceptedCount)));
  }
  const rated = links.filter((e) => verdictOf(e)?.n).length;
  const cited = links.filter((e) => (e.pmids || []).length).length;
  const tent = links.filter((e) => e.tentative).length;
  $('#legend-stats').textContent =
    `${NODES.length} genes · ${links.length} edges · ${tent} tentative · ${cited} with PMIDs · ${rated} rated by you`;
  $('#opt-hide-tentative').checked = state.hideTentative;
  $('#opt-verdicts').checked = state.showVerdicts;
}

function setupLegendFloat() {
  const btn = $('#legend-toggle');
  const body = $('#legend-body');
  btn.addEventListener('click', () => {
    const isOpen = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!isOpen));
    if (isOpen) body.setAttribute('hidden', ''); else body.removeAttribute('hidden');
  });
  $('#opt-hide-tentative').addEventListener('change', (e) => { state.hideTentative = e.target.checked; saveView(); applyVisibility(); });
  $('#opt-verdicts').addEventListener('change', (e) => { state.showVerdicts = e.target.checked; saveView(); renderEdges(); });
  $('#opt-show-all').addEventListener('click', () => {
    state.hiddenKinds.clear(); state.hideTentative = false; saveView(); renderLegend(); applyVisibility();
  });
}

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
// Suggest-a-connection: SME asks, Claude proposes, SME rates
// ---------------------------------------------------------------------------
// Free text → Claude returns {from,to,kind,note,pmids[]} → drawn as a dashed
// transient edge and opened in the side panel. Its PMIDs are resolved live,
// so invented citations show up immediately. Rating it Real persists it as
// an SME-accepted edge; otherwise it is gone on reload (the verdict stays).
const SUGGEST_PROMPT = `You are neurodigineration, proposing a biological connection between two genes/proteins from a free-text SME prompt.

The SME may give you two gene symbols (e.g., "SNCA TFEB"), a question (e.g., "is BRCA1 connected to neurodegeneration?"), or a description. Identify the most relevant gene/protein pair and propose the strongest documented connection.

Return ONLY a single JSON object with this exact shape, no markdown fences, no preamble:

{
  "from": "<HGNC symbol of first gene; the actor for directional kinds>",
  "to": "<HGNC symbol of second gene>",
  "kind": "<one kind from the list below, or none>",
  "note": "<2-3 sentence mechanistic explanation. If kind=none, explain what each gene does and that no significant connection is documented.>",
  "pmids": ["<pmid1>", "<pmid2>"]
}

Rules:
- Cite REAL PubMed PMIDs only. Every PMID is checked against PubMed; an empty list beats an invented one.
- Prefer kind="none" over fabricating.
- note: ≤ 400 characters. pmids: ≤ 3 entries.
- Honesty about absence of connection is rewarded; fabrication is penalised.

${EDGE_KIND_GUIDE}`;

function setupSuggestCard() {
  const card = $('#suggest-card');
  const toggle = $('#suggest-toggle');
  const closeBtn = $('#suggest-close');
  const openBtn = $('#suggest-open');
  const head = $('#suggest-head');
  const goBtn = $('#suggest-go');
  const input = $('#suggest-input');

  const setOpen = (open) => {
    card.hidden = !open;
    openBtn?.classList.toggle('active', open);
    if (open) {
      card.classList.remove('collapsed');
      toggle.textContent = '−';
      input?.focus();
    }
  };
  openBtn?.addEventListener('click', () => setOpen(card.hidden));
  closeBtn?.addEventListener('click', () => setOpen(false));
  const flip = () => {
    card.classList.toggle('collapsed');
    toggle.textContent = card.classList.contains('collapsed') ? '+' : '−';
  };
  head.addEventListener('click', (e) => {
    if (e.target === toggle || e.target === closeBtn || e.target === goBtn) return;
    flip();
  });
  toggle.addEventListener('click', (e) => { e.stopPropagation(); flip(); });
  goBtn.addEventListener('click', () => askSuggestion(input.value.trim()));
  input.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') askSuggestion(input.value.trim());
  });
  const hasKey = looksLikeAnthropicKey((loadApiKey() || '').trim());
  $('#suggest-meta').textContent = hasKey ? `key set · ${model.settings.anthropicModel}` : 'needs your API key (set on Train or Ask)';
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

  // Genes named in the prompt scope the SME's prior verdicts sent along.
  const named = [...new Set((text.toUpperCase().match(/[A-Z0-9-]{2,}/g) || []).filter((t) => nodeById.has(t)))];
  try {
    const result = await streamClaude({
      apiKey,
      model: model.settings.anthropicModel,
      system: model.compilePrompt({ base: SUGGEST_PROMPT, genes: named.length ? named : null, examples: false }).system,
      messages: [{ role: 'user', content: text }],
      maxTokens: 800,
    });
    let parsed;
    try {
      const m = result.text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m ? m[0] : result.text);
    } catch {
      toast('Claude did not return parseable JSON. Try rephrasing.', 'warn', 4000);
      return;
    }
    const from = String(parsed.from || '').toUpperCase().trim();
    const to = String(parsed.to || '').toUpperCase().trim();
    if (!from || !to || from === to) { toast('Claude could not identify two distinct genes.', 'warn'); return; }
    if (parsed.kind === 'none') {
      toast(`Claude found no documented ${from}–${to} connection. You can still rate the explanation.`, 'ok', 4200);
    }
    const nodeFrom = ensureNode(from, 'auto-added from SME suggestion');
    const nodeTo = ensureNode(to, 'auto-added from SME suggestion');
    for (const [n, dx] of [[nodeFrom, -80], [nodeTo, 80]]) {
      if (typeof n.x !== 'number') { n.x = W() / 2 + dx; n.y = H() / 2; }
    }
    const kind = EDGE_COLORS[parsed.kind] ? parsed.kind : 'shared-mechanism';
    const newLink = {
      from, to, kind,
      note: parsed.note || '',
      pmids: Array.isArray(parsed.pmids) ? parsed.pmids.map(String).filter(Boolean).slice(0, 3) : [],
      strength: 0.6,
      tentative: parsed.kind === 'none',
      source: nodeFrom, target: nodeTo,
      _userSuggested: true,
      _sid: ++suggestSeq,
      _prompt: text,
    };
    links.push(newLink);
    rerenderGraphIncremental();
    state.path = null;
    selectEdge(newLink, { zoomTo: true });
    meta.textContent = `${result.usage?.input_tokens || 0} in / ${result.usage?.output_tokens || 0} out tok`;
  } catch (err) {
    console.error(err);
    toast(`Failed: ${err.message}`, 'danger', 5000);
    meta.textContent = 'failed';
  } finally {
    goBtn.disabled = false; goBtn.textContent = 'Ask Claude';
  }
}

function rerenderGraphIncremental() {
  renderEdges();
  renderNodes();
  recomputeDegree();
  simulation.nodes(NODES);
  simulation.force('link').links(links);
  simulation.alpha(0.5).restart();
  setTimeout(() => simulation.alphaTarget(0), 1400);
  renderLegend();
}

// ---------------------------------------------------------------------------
// Theme toggle (light/dark)
// ---------------------------------------------------------------------------
// The inline script in network.html applies the saved theme before first
// paint; here we just wire the toggle.
const THEME_KEY = 'nd-network-theme';
function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}
function setTheme(t) {
  if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.setAttribute('data-theme', 'dark');
  try { localStorage.setItem(THEME_KEY, t); } catch { /* noop */ }
  renderFilters(); // the "All" chip uses the theme accent
}

// ---------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------
function setupKeys() {
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    if (e.key === '/' && !typing) { e.preventDefault(); $('#gene-search').focus(); return; }
    if (e.key === 'Escape' && !typing) {
      if (state.selected || state.path) clearSelection();
      return;
    }
    if (!typing && state.triage && state.selected?.type === 'edge' && (e.key === 'n' || e.key === 'N')) {
      state.triageSkipped.add(edgeId(state.selected.data));
      nextTriage();
    }
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
function trackHeaderHeight() {
  // The header wraps on narrow screens; everything below it keys off this.
  const header = $('header.site');
  const set = () => document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
  set();
  if ('ResizeObserver' in window) new ResizeObserver(set).observe(header);
}

function boot() {
  trackHeaderHeight();
  renderEdges();
  renderNodes();
  renderHeaderStatus();
  renderFilters();
  renderLegend();
  $('#zoom-in').addEventListener('click', () => zoomBy(1.3));
  $('#zoom-out').addEventListener('click', () => zoomBy(1 / 1.3));
  $('#zoom-reset').addEventListener('click', () => zoomReset());

  const helpOverlay = $('#help-overlay');
  const helpOpenBtn = $('#help-open');
  const setHelpOpen = (open) => {
    helpOverlay.hidden = !open;
    helpOpenBtn?.classList.toggle('active', open);
    if (open) helpOverlay.classList.remove('fading');
  };
  helpOpenBtn?.addEventListener('click', () => setHelpOpen(helpOverlay.hidden));
  $('#dismiss-help').addEventListener('click', () => setHelpOpen(false));
  $('#theme-toggle').addEventListener('click', () => setTheme(currentTheme() === 'light' ? 'dark' : 'light'));
  $('#triage-open').addEventListener('click', () => {
    if (state.triage) clearSelection();
    else { state.triageSkipped.clear(); nextTriage(); }
  });

  setupSuggestCard();
  setupLegendFloat();
  setupSearch();
  setupPathCard();
  setupKeys();

  model.on('change', () => {
    consensus = model.edgeConsensusMap();
    renderHeaderStatus();
    edgeSel.attr('class', edgeClass);
    applyVisibility();
    renderLegend();
  });

  simulation.alpha(1).restart();
  setTimeout(() => simulation.alphaTarget(0), 1800);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
