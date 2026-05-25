// neurodigineration training mode — main app wiring.
//
// Boot order:
//   1. instantiate BioscopeModel from localStorage
//   2. wire header (mode toggle, key field, exports menu, reset)
//   3. wire left column (system prompt textarea, examples, avoid, rubric)
//   4. wire center column (gene picker, brief frame, rating block / AB mode)
//   5. wire right column (panel CRUD, metrics dashboard)
//   6. subscribe to model events to re-render

import { BioscopeModel, DEFAULT_SYSTEM_PROMPT, mean } from './model.js';
import {
  MOCK_BRIEFS,
  mockGenes,
  pickAB,
  pickRandomVariant,
} from './mock-briefs.js';
import {
  ANTHROPIC_MODELS,
  loadApiKey,
  looksLikeAnthropicKey,
  saveApiKey,
  streamClaude,
} from './anthropic.js';
import { EDGES as NETWORK_EDGES, EDGE_COLORS, NODES as NETWORK_NODES } from './network-data.js';

const model = new BioscopeModel();

const state = {
  mode: 'mock', // 'mock' | 'live'
  centerMode: 'single', // 'single' | 'ab' | 'connection'
  currentGene: model.panel[0]?.symbol ?? 'SNCA',
  currentBrief: null, // { gene, brief, source, variant }
  currentRating: { factuality: 0, completeness: 0, citation: 0, clarity: 0 },
  currentComment: '',
  abPair: null, // { gene, A, B }

  // Connection-training mode (Train connection tab)
  connSubMode: 'established', // 'established' | 'freepair' | 'aisuggest'
  connGeneA: null,
  connGeneB: null,
  connProposal: null, // { from, to, kind, note, pmids, source: 'live'|'mock'|'live-new' }
  connRating: { validity: null, explanation: 0, citation: 0, feedback: '' },
  aiSuggestions: [], // [{ from, to, reason }]
  connAcceptedId: null, // id returned by recordAcceptedEdge after SME hits Accept
};

// =============================================================================
// Tiny DOM helpers
// =============================================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'style') node.setAttribute('style', v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') node.innerHTML = v;
    else if (v === true) node.setAttribute(k, '');
    else if (v != null && v !== false) node.setAttribute(k, String(v));
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
};
const escape = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Trivial markdown renderer (headings, bold, italic, lists, code, links).
function renderMarkdown(md) {
  if (!md) return '';
  const lines = md.split('\n');
  let out = '';
  let inList = false;
  let inPara = false;
  const flushPara = () => { if (inPara) { out += '</p>'; inPara = false; } };
  const flushList = () => { if (inList) { out += '</ul>'; inList = false; } };
  const inline = (s) =>
    escape(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(?<![\w*])\*([^*]+)\*(?![\w*])/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^# /.test(line)) { flushPara(); flushList(); out += `<h1>${inline(line.slice(2))}</h1>`; continue; }
    if (/^## /.test(line)) { flushPara(); flushList(); out += `<h2>${inline(line.slice(3))}</h2>`; continue; }
    if (/^### /.test(line)) { flushPara(); flushList(); out += `<h3>${inline(line.slice(4))}</h3>`; continue; }
    if (/^[-*] /.test(line)) {
      flushPara();
      if (!inList) { out += '<ul>'; inList = true; }
      out += `<li>${inline(line.slice(2))}</li>`;
      continue;
    }
    if (line.trim() === '') {
      flushPara(); flushList();
      continue;
    }
    flushList();
    if (!inPara) { out += '<p>'; inPara = true; }
    out += inline(line) + ' ';
  }
  flushPara(); flushList();
  return out;
}

// =============================================================================
// Toast
// =============================================================================
function toast(message, kind = 'ok', ms = 2800) {
  const host = $('#toast-host');
  const t = el('div', { class: `toast ${kind}` }, message);
  host.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

// =============================================================================
// Header rendering
// =============================================================================
function renderHeader() {
  // Mode toggle
  $$('.mode-toggle button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === state.mode);
  });
  // Mode pill
  const pill = $('#mode-pill');
  pill.className = `pill mode-${state.mode}`;
  pill.textContent = state.mode === 'mock' ? 'Mock briefs' : 'Live · Claude';
  // Version pill
  $('#version-pill').textContent = `Model ${model.version}`;
  // Key field
  renderKeyField();
}

function renderKeyField() {
  const input = $('#api-key-input');
  const status = $('#api-key-status');
  const stored = loadApiKey();
  if (input.value === '' && stored) input.value = stored;
  const value = input.value.trim();
  if (!value) {
    status.className = 'status none';
    status.textContent = 'no key';
  } else if (looksLikeAnthropicKey(value)) {
    status.className = 'status ok';
    status.textContent = 'saved';
  } else {
    status.className = 'status bad';
    status.textContent = 'bad format';
  }
}

// =============================================================================
// Left column rendering
// =============================================================================
function renderSystemPrompt() {
  const ta = $('#system-prompt');
  if (ta.value !== model.systemPrompt) ta.value = model.systemPrompt;
}

function renderExamplesList() {
  const list = $('#examples-list');
  const count = $('#examples-count');
  count.textContent = model.fewShotExamples.length;
  list.innerHTML = '';
  if (model.fewShotExamples.length === 0) {
    list.appendChild(el('div', { class: 'empty-state' }, 'No examples yet. Rate a brief ≥ 4/5 and the learning loop will promote it here.'));
    return;
  }
  for (const ex of model.fewShotExamples.slice().reverse()) {
    list.appendChild(
      el('div', { class: 'example-item' },
        el('div', { class: 'gene' }, ex.gene),
        el('div', { class: 'meta' }, `overall ${ex.overall.toFixed(1)}/5 · saved ${humanTime(ex.savedAt)}`),
        el('div', { class: 'snippet' }, snippet(ex.brief, 140)),
      ),
    );
  }
}

function renderAvoidList() {
  const list = $('#avoid-list');
  const count = $('#avoid-count');
  count.textContent = model.avoidPatterns.length;
  list.innerHTML = '';
  if (model.avoidPatterns.length === 0) {
    list.appendChild(el('div', { class: 'empty-state' }, 'No avoid patterns yet. Rate a brief ≤ 2/5 and add a comment to teach the model.'));
    return;
  }
  for (const av of model.avoidPatterns.slice().reverse()) {
    list.appendChild(
      el('div', { class: 'avoid-item' },
        el('div', { class: 'pattern' }, av.pattern),
        el('div', { class: 'meta' }, `from ${av.sourceDimension} · added ${humanTime(av.addedAt)}`),
      ),
    );
  }
}

function renderRubric() {
  const host = $('#rubric-grid');
  host.innerHTML = '';
  for (const [dim, w] of Object.entries(model.rubricWeights)) {
    const pct = Math.min(100, (w / 2) * 100); // 2.0 is the cap
    host.appendChild(el('span', { class: 'name' }, dim));
    host.appendChild(
      el('div', { class: 'bar' },
        el('div', { class: 'bar-fill', style: `width: ${pct.toFixed(1)}%` }),
      ),
    );
    host.appendChild(el('span', { class: 'val' }, w.toFixed(2)));
  }
}

// =============================================================================
// Center column — brief, rating, A/B
// =============================================================================
function renderGenePicker() {
  const sel = $('#gene-picker');
  sel.innerHTML = '';
  for (const g of model.panel) {
    sel.appendChild(el('option', { value: g.symbol }, g.symbol));
  }
  sel.value = state.currentGene;
}

function renderCenterMode() {
  $$('.center-mode button').forEach((b) => b.classList.toggle('active', b.dataset.cmode === state.centerMode));
  $('#single-pane').style.display = state.centerMode === 'single' ? '' : 'none';
  $('#ab-pane').style.display = state.centerMode === 'ab' ? '' : 'none';
  $('#connection-pane').style.display = state.centerMode === 'connection' ? '' : 'none';
}

function renderBrief() {
  const frame = $('#brief-frame');
  const metaHost = $('#brief-meta');
  if (!state.currentBrief) {
    frame.className = 'brief-frame empty';
    frame.innerHTML = `Click <strong>Generate brief</strong> to fetch a brief for <code>${escape(state.currentGene)}</code>.`;
    metaHost.innerHTML = '';
    return;
  }
  frame.className = 'brief-frame';
  frame.innerHTML = renderMarkdown(state.currentBrief.brief);
  metaHost.innerHTML = '';
  metaHost.appendChild(el('span', { class: `tag ${state.currentBrief.source}` }, state.currentBrief.source));
  if (state.currentBrief.variant) {
    metaHost.appendChild(el('span', { class: 'tag' }, `variant ${state.currentBrief.variant}`));
  }
  metaHost.appendChild(el('span', { class: 'tag' }, `${state.currentBrief.brief.length} chars`));
  if (state.currentBrief.usage) {
    metaHost.appendChild(
      el('span', { class: 'tag' },
        `${state.currentBrief.usage.input_tokens ?? 0}/${state.currentBrief.usage.output_tokens ?? 0} tok`,
      ),
    );
  }
}

function renderRatingStars() {
  const grid = $('#dim-grid');
  grid.innerHTML = '';
  const dims = [
    ['factuality', 'Are the claims correct and cited verbatim?'],
    ['completeness', 'Are all expected sections present?'],
    ['citation', 'Are identifiers (UniProt, PMID, Reactome) present?'],
    ['clarity', 'Is it dense, readable, and free of hedging?'],
  ];
  for (const [dim, hint] of dims) {
    grid.appendChild(
      el('div', { class: 'dim-name' },
        el('span', {}, capitalize(dim)),
        el('span', { class: 'hint' }, hint),
      ),
    );
    const stars = el('div', { class: 'stars' });
    for (let i = 1; i <= 5; i++) {
      const cur = state.currentRating[dim];
      stars.appendChild(
        el('div', {
          class: `star ${cur >= i ? 'selected' : ''}`,
          'data-dim': dim,
          'data-value': i,
          title: `${i}/5`,
          onClick: () => {
            state.currentRating[dim] = i;
            renderRatingStars();
          },
        }, '★'),
      );
    }
    grid.appendChild(stars);
    grid.appendChild(el('div', { class: 'dim-val' }, state.currentRating[dim] || '–'));
  }
}

function resetRating() {
  state.currentRating = { factuality: 0, completeness: 0, citation: 0, clarity: 0 };
  state.currentComment = '';
  $('#comment-input').value = '';
  renderRatingStars();
}

// =============================================================================
// Right column — panel CRUD + metrics
// =============================================================================
function renderPanelTable() {
  const tbody = $('#panel-tbody');
  tbody.innerHTML = '';
  const totalSpan = $('#panel-total-count');
  if (totalSpan) totalSpan.textContent = String(model.panel.length);
  for (const g of model.panel) {
    const isMock = mockGenes().includes(g.symbol);
    tbody.appendChild(
      el('tr', {},
        el('td', {},
          el('div', { class: 'sym' }, g.symbol),
          isMock ? null : el('div', { class: 'notes' }, '(no mock briefs — live mode only)'),
        ),
        el('td', {},
          el('div', {}, g.notes || ''),
          (g.expectTokens?.length ? el('div', { class: 'notes mono' }, g.expectTokens.slice(0, 4).join(', ')) : null),
        ),
        el('td', { class: 'actions' },
          el('button', { onClick: () => openGeneEditor(g) }, 'edit'),
          el('button', { class: 'del', onClick: () => removeGeneConfirm(g.symbol) }, '×'),
        ),
      ),
    );
  }
}

function renderMetrics() {
  // Counters
  const ratings = model.ratingsLog;
  const prefs = model.preferences;
  const golds = model.goldStandards;
  const examples = model.fewShotExamples;
  const avg = ratings.length === 0 ? 0 : mean(ratings.map((r) => r.overall));
  $('#metric-stats').innerHTML = '';
  const stats = [
    ['Ratings', ratings.length],
    ['Preferences', prefs.length],
    ['Gold std', golds.length],
    ['Examples', examples.length],
    ['Avg overall', ratings.length === 0 ? '—' : avg.toFixed(2)],
    ['Avoid', model.avoidPatterns.length],
  ];
  for (const [k, n] of stats) {
    $('#metric-stats').appendChild(
      el('div', { class: 'metric-stat' },
        el('div', { class: 'n' }, n),
        el('div', { class: 'k' }, k),
      ),
    );
  }

  // Version timeline
  const tl = $('#version-timeline');
  tl.innerHTML = '';
  for (const v of model.state.versionHistory.slice().reverse()) {
    tl.appendChild(
      el('div', { class: 'version-row' },
        el('span', { class: 'v' }, v.version),
        el('span', { class: 'what' }, summariseVersion(v)),
        el('span', { class: 'when' }, humanTime(v.at)),
      ),
    );
  }

  // Rating distribution (1..5 histogram of overall, bucketed by floor())
  renderRatingHistogram();
  // Per-dimension trend (last 12 ratings)
  renderDimensionTrend();
}

function summariseVersion(v) {
  if (v.change === 'initial') return 'initial';
  if (v.change === 'system-prompt-edit') return 'system prompt edited';
  if (v.change === 'learning-loop') {
    const d = v.delta || {};
    const parts = [];
    if (d.addedExamples) parts.push(`+${d.addedExamples} example${d.addedExamples > 1 ? 's' : ''}`);
    if (d.addedAvoidPatterns) parts.push(`+${d.addedAvoidPatterns} avoid`);
    parts.push('rubric updated');
    return parts.join(', ');
  }
  return v.change;
}

function renderRatingHistogram() {
  const svg = $('#hist-svg');
  svg.innerHTML = '';
  const W = svg.clientWidth || 320;
  const H = 90;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const ratings = model.ratingsLog;
  if (ratings.length === 0) {
    svg.appendChild(svgEl('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', class: 'label' }, 'No ratings yet'));
    return;
  }
  const buckets = [0, 0, 0, 0, 0]; // 1..5
  for (const r of ratings) {
    const b = Math.min(5, Math.max(1, Math.round(r.overall)));
    buckets[b - 1]++;
  }
  const maxN = Math.max(...buckets, 1);
  const barW = (W - 24) / 5 - 6;
  for (let i = 0; i < 5; i++) {
    const x = 12 + i * ((W - 24) / 5);
    const h = (buckets[i] / maxN) * (H - 24);
    const y = H - 18 - h;
    const cls = i <= 1 ? 'bar low' : i === 2 ? 'bar mid' : 'bar high';
    svg.appendChild(svgEl('rect', { x, y, width: barW, height: Math.max(2, h), rx: 3, class: cls }));
    svg.appendChild(svgEl('text', { x: x + barW / 2, y: H - 4, 'text-anchor': 'middle', class: 'label' }, `${i + 1}★`));
    svg.appendChild(svgEl('text', { x: x + barW / 2, y: y - 2, 'text-anchor': 'middle', class: 'label' }, String(buckets[i])));
  }
}

function renderDimensionTrend() {
  const svg = $('#trend-svg');
  svg.innerHTML = '';
  const W = svg.clientWidth || 320;
  const H = 120;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const recent = model.ratingsLog.slice(-12);
  if (recent.length < 2) {
    svg.appendChild(svgEl('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', class: 'label' }, recent.length === 0 ? 'No data' : 'Need ≥2 ratings'));
    return;
  }
  const dims = [
    ['factuality', '#0b3b5a'],
    ['completeness', '#7c3aed'],
    ['citation', '#0891b2'],
    ['clarity', '#dc2626'],
  ];
  const padL = 22, padR = 8, padT = 12, padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  // Y grid at 1..5
  for (let y = 1; y <= 5; y++) {
    const py = padT + innerH - ((y - 1) / 4) * innerH;
    svg.appendChild(svgEl('line', { x1: padL, x2: W - padR, y1: py, y2: py, class: 'grid-line' }));
    svg.appendChild(svgEl('text', { x: 2, y: py + 3, class: 'label' }, String(y)));
  }
  for (const [dim, color] of dims) {
    const pts = recent.map((r, i) => {
      const x = padL + (i / (recent.length - 1)) * innerW;
      const y = padT + innerH - ((r.ratings[dim] - 1) / 4) * innerH;
      return [x, y];
    });
    const d = 'M ' + pts.map((p) => p.join(' ')).join(' L ');
    svg.appendChild(svgEl('path', { d, fill: 'none', stroke: color, 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: 0.85 }));
    for (const [x, y] of pts) svg.appendChild(svgEl('circle', { cx: x, cy: y, r: 2.2, fill: color }));
  }
  // Legend
  let lx = padL;
  for (const [dim, color] of dims) {
    svg.appendChild(svgEl('rect', { x: lx, y: H - 12, width: 8, height: 4, fill: color }));
    svg.appendChild(svgEl('text', { x: lx + 11, y: H - 8, class: 'label' }, dim));
    lx += 70;
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs = {}, ...kids) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  for (const c of kids) n.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
}

// =============================================================================
// Brief generation (mock + live)
// =============================================================================
async function generateBrief() {
  const gene = state.currentGene;
  const generateBtn = $('#generate-btn');
  generateBtn.disabled = true;
  generateBtn.textContent = state.mode === 'live' ? 'Calling Claude…' : 'Loading…';
  try {
    if (state.mode === 'mock') {
      const v = pickRandomVariant(gene);
      if (!v) {
        toast(`No mock brief for ${gene}. Switch to live mode or add briefs.`, 'warn');
        return;
      }
      state.currentBrief = { gene, brief: v.brief, source: 'mock', variant: v.variant };
      resetRating();
      renderBrief();
      return;
    }
    // Live mode
    const apiKey = (loadApiKey() || $('#api-key-input').value).trim();
    if (!apiKey) {
      toast('Paste your Anthropic API key in the header first.', 'warn', 4200);
      return;
    }
    if (!looksLikeAnthropicKey(apiKey)) {
      toast('That key doesn\'t look like an Anthropic key (sk-ant-…).', 'danger', 4200);
      return;
    }
    saveApiKey(apiKey);

    // Build messages from few-shot examples
    const messages = [];
    for (const ex of model.fewShotExamples.slice(-3)) {
      messages.push({ role: 'user', content: `Produce a neurodigineration brief for the gene ${ex.gene}.` });
      messages.push({ role: 'assistant', content: ex.brief });
    }
    messages.push({ role: 'user', content: `Produce a neurodigineration brief for the gene ${gene}. Follow every rule in the system prompt.` });

    // Build system prompt with avoid patterns appended
    let sys = model.systemPrompt;
    if (model.avoidPatterns.length > 0) {
      sys += '\n\n## Avoid these specific failure modes observed in low-rated past briefs:\n';
      for (const av of model.avoidPatterns) sys += `- ${av.pattern}\n`;
    }

    // Stream the response into the brief frame
    state.currentBrief = { gene, brief: '', source: 'live', variant: null };
    renderBrief();
    const result = await streamClaude({
      apiKey,
      model: model.settings.anthropicModel,
      system: sys,
      messages,
      maxTokens: model.settings.anthropicMaxTokens,
      onToken: (_d, full) => {
        state.currentBrief.brief = full;
        renderBrief();
      },
    });
    state.currentBrief.brief = result.text;
    state.currentBrief.usage = result.usage;
    state.currentBrief.stopReason = result.stopReason;
    resetRating();
    renderBrief();
    toast(`Brief generated (${result.usage.input_tokens || 0} in / ${result.usage.output_tokens || 0} out tokens).`, 'ok');
  } catch (err) {
    console.error(err);
    toast(`Generation failed: ${err.message || err}`, 'danger', 5000);
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate brief';
  }
}

async function generateABPair() {
  const gene = state.currentGene;
  if (state.mode === 'mock') {
    const pair = pickAB(gene);
    if (!pair) { toast(`No A/B pair available for ${gene}.`, 'warn'); return; }
    state.abPair = pair;
    renderABPane();
    return;
  }
  // Live: generate twice — once with full model state, once with bare prompt.
  // The SME's preference between "trained model output" and "baseline output"
  // is the DPO-style signal.
  const apiKey = (loadApiKey() || $('#api-key-input').value).trim();
  if (!apiKey || !looksLikeAnthropicKey(apiKey)) { toast('Need a valid Anthropic key.', 'warn'); return; }
  saveApiKey(apiKey);
  const btn = $('#ab-generate-btn');
  btn.disabled = true; btn.textContent = 'Generating both…';
  try {
    const baseline = await streamClaude({
      apiKey,
      model: model.settings.anthropicModel,
      system: DEFAULT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Produce a neurodigineration brief for the gene ${gene}.` }],
      maxTokens: model.settings.anthropicMaxTokens,
    });
    const trainedMessages = [];
    for (const ex of model.fewShotExamples.slice(-3)) {
      trainedMessages.push({ role: 'user', content: `Produce a neurodigineration brief for the gene ${ex.gene}.` });
      trainedMessages.push({ role: 'assistant', content: ex.brief });
    }
    trainedMessages.push({ role: 'user', content: `Produce a neurodigineration brief for the gene ${gene}.` });
    let sys = model.systemPrompt;
    if (model.avoidPatterns.length > 0) {
      sys += '\n\n## Avoid:\n' + model.avoidPatterns.map((a) => `- ${a.pattern}`).join('\n');
    }
    const trained = await streamClaude({
      apiKey,
      model: model.settings.anthropicModel,
      system: sys,
      messages: trainedMessages,
      maxTokens: model.settings.anthropicMaxTokens,
    });
    // Randomise which side is A vs B so the SME can't position-bias
    const flip = Math.random() < 0.5;
    state.abPair = {
      gene,
      A: flip
        ? { brief: trained.text, label: `trained (${model.version})`, source: 'live' }
        : { brief: baseline.text, label: 'baseline (default prompt)', source: 'live' },
      B: flip
        ? { brief: baseline.text, label: 'baseline (default prompt)', source: 'live' }
        : { brief: trained.text, label: `trained (${model.version})`, source: 'live' },
    };
    renderABPane();
  } catch (err) {
    toast(`A/B generation failed: ${err.message}`, 'danger', 5000);
  } finally {
    btn.disabled = false; btn.textContent = 'Generate A/B pair';
  }
}

function renderABPane() {
  const aHost = $('#ab-a');
  const bHost = $('#ab-b');
  if (!state.abPair) {
    aHost.innerHTML = bHost.innerHTML = '';
    $('#ab-a-label').textContent = 'A';
    $('#ab-b-label').textContent = 'B';
    return;
  }
  $('#ab-a-label').textContent = `A — ${state.abPair.A.label || state.abPair.A.variant || ''}`;
  $('#ab-b-label').textContent = `B — ${state.abPair.B.label || state.abPair.B.variant || ''}`;
  aHost.innerHTML = renderMarkdown(state.abPair.A.brief);
  bHost.innerHTML = renderMarkdown(state.abPair.B.brief);
  aHost.parentElement.classList.remove('chosen');
  bHost.parentElement.classList.remove('chosen');
}

function pickABWinner(winner) {
  if (!state.abPair) return;
  $('#ab-a').parentElement.classList.toggle('chosen', winner === 'A');
  $('#ab-b').parentElement.classList.toggle('chosen', winner === 'B');
  const reason = ($('#ab-reason').value || '').trim();
  model.recordPreference({
    gene: state.abPair.gene,
    briefA: state.abPair.A.brief,
    briefB: state.abPair.B.brief,
    winner,
    reason,
  });
  toast(`Preference recorded: ${winner === 'tie' ? 'tie' : `chose ${winner}`}.`, 'ok');
  $('#ab-reason').value = '';
  // Auto-load next pair
  setTimeout(() => { state.abPair = null; generateABPair(); }, 600);
}

// =============================================================================
// Rating submission
// =============================================================================
function saveRating() {
  if (!state.currentBrief) { toast('Generate a brief first.', 'warn'); return; }
  const r = state.currentRating;
  if (r.factuality === 0 || r.completeness === 0 || r.citation === 0 || r.clarity === 0) {
    toast('Rate every dimension before saving.', 'warn');
    return;
  }
  const entry = model.recordRating({
    gene: state.currentBrief.gene,
    brief: state.currentBrief.brief,
    briefSource: state.currentBrief.source,
    briefVariant: state.currentBrief.variant,
    ratings: r,
    comment: $('#comment-input').value,
  });
  toast(`Rating saved (overall ${entry.overall.toFixed(2)}/5).`, 'ok');
}

function saveAsGoldStandard() {
  if (!state.currentBrief) { toast('Generate a brief first.', 'warn'); return; }
  const entry = model.recordGoldStandard({
    gene: state.currentBrief.gene,
    brief: state.currentBrief.brief,
    basedOnRatingId: null,
    notes: ($('#comment-input').value || '').trim(),
  });
  toast(`Saved as gold standard (${entry.id}).`, 'ok');
}

// =============================================================================
// Panel CRUD modal
// =============================================================================
function openGeneEditor(gene) {
  const modal = $('#gene-modal');
  $('#gm-title').textContent = gene ? `Edit ${gene.symbol}` : 'Add gene to panel';
  $('#gm-symbol').value = gene?.symbol ?? '';
  $('#gm-symbol').disabled = !!gene;
  $('#gm-aliases').value = (gene?.aliases ?? []).join(', ');
  $('#gm-notes').value = gene?.notes ?? '';
  $('#gm-tokens').value = (gene?.expectTokens ?? []).join(', ');
  modal.classList.add('open');
}
function closeGeneEditor() { $('#gene-modal').classList.remove('open'); }
function saveGeneFromModal() {
  const symbol = $('#gm-symbol').value.trim().toUpperCase();
  if (!symbol) { toast('Symbol is required.', 'warn'); return; }
  const g = {
    symbol,
    aliases: $('#gm-aliases').value.split(',').map((s) => s.trim()).filter(Boolean),
    notes: $('#gm-notes').value.trim(),
    expectTokens: $('#gm-tokens').value.split(',').map((s) => s.trim()).filter(Boolean),
  };
  model.addOrUpdateGene(g);
  closeGeneEditor();
  toast(`Saved ${symbol} to panel.`, 'ok');
}
function removeGeneConfirm(symbol) {
  if (model.panel.length <= 1) { toast('Keep at least one gene in the panel.', 'warn'); return; }
  if (!confirm(`Remove ${symbol} from the training panel?`)) return;
  model.removeGene(symbol);
  if (state.currentGene === symbol) state.currentGene = model.panel[0]?.symbol ?? 'SNCA';
}

// =============================================================================
// Exports
// =============================================================================
function exportFullState() {
  download('neurodigineration-model.json', model.export(), 'application/json');
}

function exportDpoJsonl() {
  if (model.preferences.length === 0) { toast('No preference data yet.', 'warn'); return; }
  const lines = model.preferences
    .filter((p) => p.winner !== 'tie')
    .map((p) => {
      const chosen = p.winner === 'A' ? p.briefA.full : p.briefB.full;
      const rejected = p.winner === 'A' ? p.briefB.full : p.briefA.full;
      return JSON.stringify({
        prompt: `Produce a neurodigineration brief for the gene ${p.gene}.`,
        chosen,
        rejected,
        metadata: { gene: p.gene, model_version: model.version, reason: p.reason },
      });
    });
  if (lines.length === 0) { toast('All preferences were ties.', 'warn'); return; }
  download('neurodigineration-preferences.jsonl', lines.join('\n'), 'application/jsonl');
}

function exportSftJsonl() {
  if (model.goldStandards.length === 0) { toast('No gold-standard briefs yet.', 'warn'); return; }
  const lines = model.goldStandards.map((g) =>
    JSON.stringify({
      messages: [
        { role: 'system', content: model.systemPrompt },
        { role: 'user', content: `Produce a neurodigineration brief for the gene ${g.gene}.` },
        { role: 'assistant', content: g.brief },
      ],
      metadata: { gene: g.gene, model_version: model.version, notes: g.notes },
    }),
  );
  download('neurodigineration-gold-standards.jsonl', lines.join('\n'), 'application/jsonl');
}

function exportRatingsCsv() {
  if (model.ratingsLog.length === 0) { toast('No ratings yet.', 'warn'); return; }
  const head = 'id,gene,source,variant,factuality,completeness,citation,clarity,overall,comment,rated_at\n';
  const rows = model.ratingsLog.map((r) =>
    [r.id, r.gene, r.briefSource, r.briefVariant ?? '',
     r.ratings.factuality, r.ratings.completeness, r.ratings.citation, r.ratings.clarity,
     r.overall, JSON.stringify(r.comment || ''), r.ratedAt].join(','),
  );
  download('neurodigineration-ratings.csv', head + rows.join('\n'), 'text/csv');
}

function importStateFromFile() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'application/json';
  inp.onchange = async () => {
    const f = inp.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      model.import(text);
      toast('Model state imported.', 'ok');
    } catch (err) {
      toast(`Import failed: ${err.message}`, 'danger', 5000);
    }
  };
  inp.click();
}

function download(filename, data, type) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// =============================================================================
// Connection-training mode
// =============================================================================

const CONNECTION_GENERATOR_PROMPT = `You are neurodigineration, proposing a biological connection between two genes/proteins for SME (subject-matter expert) validation.

You will receive two HGNC gene symbols (A and B). Your task is to propose the strongest documented connection between them, if one exists.

Return ONLY a single JSON object with this exact shape, no markdown fences, no preamble:

{
  "kind": "kinase-substrate" | "receptor-ligand" | "complex" | "modifier" | "shared-mechanism" | "shared-disease" | "opposes" | "none",
  "note": "<2-3 sentence mechanistic explanation. If kind=none, explain what each gene does separately and that no significant connection is documented.>",
  "pmids": ["<pmid1>", "<pmid2>"]
}

Rules:
- Cite REAL PubMed PMIDs only. Do not invent. If you don't know a PMID for a claim, leave the pmids array empty rather than guessing.
- Prefer kind="none" over fabricating a relationship.
- Pick the most specific kind that applies.
- note: ≤ 400 characters.
- pmids: ≤ 3 entries.
- The SME will rate your proposal. Honesty about absence of connection is rewarded; fabrication is penalised.`;

// Free-pair mode: SME deliberately picks two genes that may NOT already be
// in the curated graph and asks Claude to draft a NEW connection. We tell
// Claude this so it leans toward proposing something novel rather than
// rehashing a textbook fact — but still lets it return kind="none".
const CONNECTION_FREEPAIR_PROMPT = `You are neurodigineration, drafting a NEW biological connection between two genes/proteins for an SME (subject-matter expert) to validate.

The SME has picked these two genes deliberately and wants the strongest plausible mechanistic connection — even if it is not yet a well-established textbook fact. You may propose connections at any level (direct molecular interaction, shared complex, shared pathway, shared cellular compartment, shared disease vulnerability) — but each must be defensible from published literature.

Return ONLY a single JSON object with this exact shape, no markdown fences, no preamble:

{
  "kind": "kinase-substrate" | "receptor-ligand" | "complex" | "modifier" | "shared-mechanism" | "shared-disease" | "opposes" | "none",
  "note": "<2-4 sentence mechanistic explanation framed for an SME — be specific about which step, compartment, or substrate is involved. If kind=none, say so clearly and explain what each gene does separately.>",
  "pmids": ["<pmid1>", "<pmid2>", "<pmid3>"],
  "strength": 0.0..1.0,
  "novel": true | false
}

Rules:
- Cite REAL PubMed PMIDs only. Do not invent. If you don't know a PMID, leave the array empty rather than guessing.
- "novel": true if this is a plausible NEW edge you would draft rather than rehashing a canonical textbook claim.
- "strength" is your subjective confidence (0=speculative, 1=textbook fact).
- Prefer kind="none" over fabricating. The SME rewards honest "no connection" answers.
- note: ≤ 500 characters.
- pmids: ≤ 3 entries.`;

// AI-suggested-pair mode: ask Claude for a *list* of candidate pairs that are
// likely related but rare/underexplored, optionally biased by a SME theme.
const CONNECTION_AISUGGEST_PROMPT = `You are neurodigineration, suggesting candidate gene/protein pairs for an SME to investigate as potentially NEW network edges.

Return ONLY a single JSON object with this exact shape, no markdown fences, no preamble:

{
  "pairs": [
    { "from": "<HGNC symbol>", "to": "<HGNC symbol>", "kind": "shared-mechanism", "reason": "<≤ 200 chars, why these two might be linked>" },
    ...
  ]
}

Rules:
- Each pair must consist of human HGNC symbols.
- Suggest pairs the SME has NOT already listed in the "exclude" set. The exclude set is a list of curated edges already in the graph plus already-accepted edges.
- Lean toward pairs with biological plausibility but limited textbook coverage (these are the ones worth SME judgement).
- Prefer cross-disease pairs (e.g. one PD gene + one AD gene) when the mechanism plausibly bridges them.
- kind must be one of: kinase-substrate, receptor-ligand, complex, modifier, shared-mechanism, shared-disease, opposes.
- Do not duplicate pairs within your own output.
- The SME will pick from your list. Quality over quantity.`;

function pickRandomGeneFromPanel() {
  const panel = model.panel;
  return panel[Math.floor(Math.random() * panel.length)]?.symbol;
}

function populateConnPickers() {
  const a = $('#conn-gene-a');
  const b = $('#conn-gene-b');
  a.innerHTML = ''; b.innerHTML = '';
  for (const g of model.panel) {
    a.appendChild(el('option', { value: g.symbol }, g.symbol));
    b.appendChild(el('option', { value: g.symbol }, g.symbol));
  }
  if (!state.connGeneA) state.connGeneA = model.panel[0]?.symbol ?? 'SNCA';
  if (!state.connGeneB) {
    // Default B to second gene, not same as A
    const alt = model.panel[1]?.symbol;
    state.connGeneB = alt && alt !== state.connGeneA ? alt : pickRandomGeneFromPanel();
  }
  a.value = state.connGeneA;
  b.value = state.connGeneB;
}

function pickRandomConnPair() {
  // In "established" sub-mode, the user wants a pair that has a curated edge
  // to rate — so pick one from EDGES directly. In "freepair" sub-mode the
  // SME is drafting new connections, so any panel pair is fine.
  if (state.connSubMode === 'established' && NETWORK_EDGES.length > 0) {
    const e = NETWORK_EDGES[Math.floor(Math.random() * NETWORK_EDGES.length)];
    state.connGeneA = e.from; state.connGeneB = e.to;
    const aSel = $('#conn-gene-a');
    const bSel = $('#conn-gene-b');
    // Ensure the picker has options for both endpoints — older saved
    // panels may be missing newer Round-5 genes, so inject on the fly.
    ensurePickerHasOption(aSel, e.from);
    ensurePickerHasOption(bSel, e.to);
    aSel.value = e.from;
    bSel.value = e.to;
    return;
  }
  const all = model.panel.map((p) => p.symbol);
  if (all.length < 2) return;
  const a = all[Math.floor(Math.random() * all.length)];
  let b = all[Math.floor(Math.random() * all.length)];
  let guard = 20;
  while (b === a && guard-- > 0) b = all[Math.floor(Math.random() * all.length)];
  state.connGeneA = a; state.connGeneB = b;
  $('#conn-gene-a').value = a;
  $('#conn-gene-b').value = b;
}

/** Defensive: make sure a `<select>` has an `<option>` for the given symbol,
 *  adding one if it doesn't. Handles the case where the user's saved panel
 *  is older than the current default-panel set. */
function ensurePickerHasOption(selectEl, symbol) {
  for (const opt of selectEl.options) {
    if (opt.value === symbol) return;
  }
  selectEl.appendChild(el('option', { value: symbol }, symbol));
}

function findExistingMockEdge(a, b) {
  return NETWORK_EDGES.find((e) =>
    (e.from === a && e.to === b) || (e.from === b && e.to === a),
  );
}
function randomMockEdge() {
  return NETWORK_EDGES[Math.floor(Math.random() * NETWORK_EDGES.length)];
}

/**
 * Compact "exclude set" of edges the AI shouldn't re-propose — curated graph
 * + already-accepted SME edges. Returned as a compact "A-B" pipe-joined
 * string so the prompt stays small even with hundreds of edges.
 */
function buildExcludeEdgesString() {
  const seen = new Set();
  for (const e of NETWORK_EDGES) {
    const key = [e.from, e.to].sort().join('-');
    seen.add(key);
  }
  for (const e of (model.acceptedEdges || [])) {
    const key = [e.from, e.to].sort().join('-');
    seen.add(key);
  }
  // Keep prompt size reasonable — cap at 500 most-relevant pairs
  return Array.from(seen).slice(0, 500).join(', ');
}

async function generateConnection() {
  const a = state.connGeneA;
  const b = state.connGeneB;
  if (!a || !b) { toast('Pick both genes first.', 'warn'); return; }
  if (a === b) { toast('Pick two different genes.', 'warn'); return; }

  const sub = state.connSubMode || 'established';
  const btn = $('#conn-generate-btn');
  btn.disabled = true;
  btn.textContent = state.mode === 'live' ? 'Asking Claude…' : 'Picking edge…';

  try {
    // Mock-mode behaviour — ALWAYS respects the picked pair (no silent
    // substitution to a random other edge):
    //   - established → curated edge for (A,B) if it exists, else a clear
    //                    "no curated edge — switch tab" message.
    //   - freepair    → editable proposal card: SME fills in kind + note
    //                    by hand (no API key needed) and clicks
    //                    Accept into graph to add it as a new edge.
    if (state.mode === 'mock') {
      const exact = findExistingMockEdge(a, b);
      if (sub === 'freepair') {
        // Editable card — SME authors the edge themselves. Pre-fill with
        // the curated edge if one exists; otherwise blank shared-mechanism
        // placeholder for them to overwrite.
        state.connProposal = exact ? {
          from: exact.from, to: exact.to, kind: exact.kind,
          note: exact.note, pmids: exact.pmids ?? [],
          source: 'mock-editable-existing',
          editable: true,
        } : {
          from: a, to: b, kind: 'shared-mechanism',
          note: '',
          pmids: [],
          source: 'mock-editable-new',
          editable: true,
        };
        resetConnRating();
        renderConnProposal();
        return;
      }
      if (exact) {
        // Established sub-mode with a curated edge — show as-is for rating
        state.connProposal = {
          from: exact.from, to: exact.to, kind: exact.kind,
          note: exact.note, pmids: exact.pmids ?? [],
          source: 'mock-exact',
        };
      } else {
        // Established sub-mode with no curated edge — point SME to Free Pair
        state.connProposal = {
          from: a, to: b, kind: 'shared-mechanism',
          note: `No curated edge exists between ${a} and ${b} in the network. ` +
            `Switch to the "Free pair (new)" sub-tab above to draft and accept this connection yourself — mock mode works fine there, no API key needed.`,
          pmids: [],
          source: 'mock-no-curated-edge',
        };
      }
      resetConnRating();
      renderConnProposal();
      return;
    }

    // Live mode: call Claude with the appropriate JSON-mode prompt
    const apiKey = (loadApiKey() || $('#api-key-input').value).trim();
    if (!apiKey || !looksLikeAnthropicKey(apiKey)) {
      toast('Live mode needs your Anthropic API key in the header.', 'warn', 4200);
      return;
    }
    saveApiKey(apiKey);

    let sys = sub === 'freepair' ? CONNECTION_FREEPAIR_PROMPT : CONNECTION_GENERATOR_PROMPT;
    if (model.avoidPatterns.length > 0) {
      sys += '\n\n## Avoid these patterns previously flagged by the SME:\n';
      for (const av of model.avoidPatterns) sys += `- ${av.pattern}\n`;
    }
    // In free-pair mode, tell Claude explicitly whether the pair is already
    // in the curated graph so it leans toward proposing something new.
    let userMsg = `Gene A: ${a}\nGene B: ${b}`;
    if (sub === 'freepair') {
      const exists = findExistingMockEdge(a, b);
      userMsg += exists
        ? `\n\nNote: this pair (${exists.from}–${exists.to}, kind=${exists.kind}) is already in the curated graph. Propose either a *different* mechanism or refine the existing claim.`
        : `\n\nNote: this pair is NOT currently in the curated graph. Draft a NEW connection (or return kind="none" if no connection exists).`;
    }

    const result = await streamClaude({
      apiKey,
      model: model.settings.anthropicModel,
      system: sys,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 900,
    });

    // Parse JSON from the response, tolerant of stray text/fences
    let parsed = null;
    try {
      const m = result.text.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : JSON.parse(result.text);
    } catch (e) {
      console.warn('JSON parse fail, raw:', result.text);
      toast('Claude did not return parseable JSON. Try again.', 'warn', 4000);
      return;
    }

    state.connProposal = {
      from: a, to: b,
      kind: parsed.kind || 'none',
      note: parsed.note || '',
      pmids: Array.isArray(parsed.pmids) ? parsed.pmids.filter(Boolean) : [],
      strength: typeof parsed.strength === 'number' ? parsed.strength : null,
      novel: parsed.novel === true,
      source: sub === 'freepair' ? 'live-new' : 'live',
      usage: result.usage,
    };
    state.connAcceptedId = null; // reset accept state on each new proposal
    resetConnRating();
    renderConnProposal();
    toast(`Connection proposed (${result.usage?.input_tokens || 0} in / ${result.usage?.output_tokens || 0} out).`, 'ok');
  } catch (err) {
    console.error(err);
    toast(`Generation failed: ${err.message}`, 'danger', 5000);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate connection';
  }
}

/**
 * AI-suggest sub-mode: ask Claude for a list of candidate gene pairs the
 * graph doesn't have yet. Renders into #conn-aisuggest-list; clicking a row
 * pre-fills A/B and switches to free-pair sub-mode so the SME can generate
 * the full proposal.
 */
async function generateAiSuggestions() {
  if (state.mode !== 'live') {
    toast('AI-suggested pairs requires live mode (needs your Anthropic API key).', 'warn', 4200);
    return;
  }
  const apiKey = (loadApiKey() || $('#api-key-input').value).trim();
  if (!apiKey || !looksLikeAnthropicKey(apiKey)) {
    toast('Live mode needs your Anthropic API key in the header.', 'warn', 4200);
    return;
  }
  saveApiKey(apiKey);

  const theme = ($('#conn-aisuggest-theme').value || '').trim();
  const n = Math.max(1, Math.min(10, parseInt($('#conn-aisuggest-count').value, 10) || 5));
  const exclude = buildExcludeEdgesString();
  const panelSyms = model.panel.map((g) => g.symbol).join(', ');

  const btn = $('#conn-aisuggest-btn');
  btn.disabled = true;
  btn.textContent = 'Suggesting…';

  try {
    const userMsg =
      `Suggest ${n} candidate gene pairs from the panel for SME review.\n\n` +
      (theme ? `Theme / cluster the SME is exploring: "${theme}"\n\n` : '') +
      `Panel genes (use only these symbols):\n${panelSyms}\n\n` +
      `Exclude — pairs already in the curated graph or accepted by the SME (each pair given as the two symbols joined by "-", order-insensitive):\n${exclude}`;

    const result = await streamClaude({
      apiKey,
      model: model.settings.anthropicModel,
      system: CONNECTION_AISUGGEST_PROMPT,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 1100,
    });

    let parsed = null;
    try {
      const m = result.text.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : JSON.parse(result.text);
    } catch {
      console.warn('AI-suggest JSON parse fail, raw:', result.text);
      toast('Claude did not return parseable JSON. Try again.', 'warn', 4000);
      return;
    }

    const pairs = Array.isArray(parsed.pairs) ? parsed.pairs : [];
    state.aiSuggestions = pairs
      .map((p) => ({ from: p.from, to: p.to, kind: p.kind || 'shared-mechanism', reason: p.reason || '' }))
      .filter((p) => p.from && p.to && p.from !== p.to);

    renderAiSuggestions();
    toast(`${state.aiSuggestions.length} pair${state.aiSuggestions.length === 1 ? '' : 's'} suggested.`, 'ok');
  } catch (err) {
    console.error(err);
    toast(`Suggestion failed: ${err.message}`, 'danger', 5000);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Suggest pairs';
  }
}

function renderAiSuggestions() {
  const ul = $('#conn-aisuggest-list');
  ul.innerHTML = '';
  if (!state.aiSuggestions.length) { ul.style.display = 'none'; return; }
  ul.style.display = '';
  for (const s of state.aiSuggestions) {
    ul.appendChild(
      el('li', {
        title: `Click to load ${s.from} ↔ ${s.to} into the picker and draft the full proposal`,
        onClick: () => {
          state.connGeneA = s.from;
          state.connGeneB = s.to;
          $('#conn-gene-a').value = s.from;
          $('#conn-gene-b').value = s.to;
          // Drop into free-pair sub-mode so the next Generate drafts a new edge
          state.connSubMode = 'freepair';
          renderConnSubMode();
          generateConnection();
        },
      },
        el('span', { class: 'ais-pair' }, `${s.from} ↔ ${s.to}`),
        el('span', { class: 'ais-reason' }, s.reason),
      ),
    );
  }
}

function renderConnSubMode() {
  $$('.conn-submode button').forEach((b) => b.classList.toggle('active', b.dataset.cmsub === state.connSubMode));
  const isSuggest = state.connSubMode === 'aisuggest';
  $('#conn-pair-controls').style.display = isSuggest ? 'none' : '';
  $('#conn-aisuggest-controls').style.display = isSuggest ? '' : 'none';
  // Mode-specific hint copy
  const hint = $('#conn-submode-hint');
  if (state.connSubMode === 'freepair') {
    hint.innerHTML = 'Pick any two of the 221 genes; in <strong>live mode</strong> Claude drafts a NEW mechanistic connection for you to validate. Mark <em>Real</em> + click <strong>Accept into graph</strong> to add it as a dashed-green edge on the network.';
  } else if (state.connSubMode === 'aisuggest') {
    hint.innerHTML = 'Have Claude propose currently-unconnected pairs likely to share biology. Click a row to load it into the picker and draft the full proposal.';
  } else {
    hint.innerHTML = 'In <strong>live mode</strong>, Claude proposes the strongest documented connection between A and B with PMID citations. In <strong>mock mode</strong>, a random pre-curated edge from the network is shown.';
  }
  // IMPORTANT: do NOT wipe state.connProposal or rewrite #conn-card here.
  // Switching sub-modes is a soft visibility toggle — the user's current
  // proposal stays visible, the rating block stays visible if a proposal
  // exists, and the Accept-into-graph button's eligibility re-evaluates
  // against the new sub-mode. This avoids losing work on a chip click.
  if (state.connProposal) {
    // Re-render in case Accept/save button eligibility changed with the sub-mode
    updateConnSaveEnabled();
  } else {
    // No proposal yet → show the appropriate placeholder for the mode
    $('#conn-rating-block').style.display = 'none';
    $('#conn-card').className = 'brief-frame empty';
    $('#conn-card').innerHTML = isSuggest
      ? 'Click <strong>Suggest pairs</strong> to have Claude propose candidate edges.'
      : 'Pick two genes and click <strong>Generate connection</strong>.';
  }
}

/**
 * SME has marked a fresh proposal as Real → push it into model.acceptedEdges
 * so the network page renders it as a dashed-green overlay.
 */
function acceptConnIntoGraph() {
  if (!state.connProposal) return;
  if (state.connAcceptedId) {
    toast('Already accepted.', 'warn'); return;
  }
  const p = state.connProposal;
  if (p.kind === 'none') {
    toast("Can't accept kind=\"none\" into the graph.", 'warn'); return;
  }
  const stored = model.recordAcceptedEdge({
    from: p.from, to: p.to, kind: p.kind, note: p.note,
    pmids: p.pmids, strength: p.strength ?? (state.connRating.explanation / 5),
    source: p.source,
  });
  state.connAcceptedId = stored.id;
  const note = $('#conn-accepted-note');
  note.style.display = '';
  note.textContent = `Added to the network as a dashed-green edge — open the Network page to see ${stored.from} ↔ ${stored.to} (${stored.kind}). Model bumped to ${model.version}.`;
  $('#conn-accept-btn').disabled = true;
  $('#conn-accept-btn').textContent = '✓ Accepted';
}

function renderConnProposal() {
  const card = $('#conn-card');
  const rate = $('#conn-rating-block');
  // Hide leftover "accepted" badge until a new proposal earns one
  const acceptedNote = $('#conn-accepted-note');
  if (acceptedNote) acceptedNote.style.display = 'none';
  if (!state.connProposal) {
    card.className = 'brief-frame empty';
    card.innerHTML = 'Pick two genes and click <strong>Generate connection</strong>.';
    rate.style.display = 'none';
    return;
  }
  const p = state.connProposal;
  const color = EDGE_COLORS[p.kind] || 'var(--mute)';
  card.className = 'brief-frame';

  // Editable card — Free Pair in mock mode lets the SME author the edge
  // themselves (no API key needed). All EDGE_COLORS kinds are available.
  if (p.editable) {
    const kindOptions = Object.keys(EDGE_COLORS).map((k) =>
      `<option value="${k}"${k === p.kind ? ' selected' : ''}>${k}</option>`
    ).join('');
    card.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom: 12px;">
        <span style="font-family: 'SF Mono', monospace; font-weight: 700; color: var(--accent); font-size: 18px;">${escape(p.from)}</span>
        <span style="color: var(--mute); font-size: 18px;">↔</span>
        <span style="font-family: 'SF Mono', monospace; font-weight: 700; color: var(--accent); font-size: 18px;">${escape(p.to)}</span>
        <span style="margin-left: auto; padding: 4px 10px; font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; background: var(--accent-soft, #fef3c7); color: var(--accent, #92400e); border-radius: 999px;">EDITABLE</span>
      </div>
      <div style="display:flex; align-items:center; gap:10px; margin-bottom: 10px; flex-wrap:wrap;">
        <label style="font-size: 12px; color: var(--mute);">Kind:</label>
        <select id="conn-edit-kind" style="padding: 6px 10px; border:1px solid var(--rule); border-radius: 6px; font-family: 'SF Mono', monospace; font-size: 13px;">${kindOptions}</select>
        <span style="display:inline-block; width:14px; height:14px; border-radius:3px; background:${color};" id="conn-edit-kind-swatch"></span>
        <span style="font-size: 12px; color: var(--mute); margin-left: auto;">Mock-mode manual entry — no API key needed</span>
      </div>
      <label style="display:block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--mute); margin-bottom: 4px;">Mechanism / explanation</label>
      <textarea id="conn-edit-note" rows="5" placeholder="Describe how ${escape(p.from)} and ${escape(p.to)} are connected — 2–4 sentences. e.g. 'VPS35-retromer sorts LAMP2A back from late endosomes for chaperone-mediated autophagy; VPS35 D620N reduces LAMP2A levels and impairs CMA-mediated αSyn clearance.'"
                style="width:100%; box-sizing:border-box; padding: 8px 10px; border:1px solid var(--rule); border-radius: 6px; font-family: inherit; font-size: 13px; line-height: 1.5; resize: vertical; min-height: 90px;">${escape(p.note || '')}</textarea>
      <div style="display:flex; gap:10px; align-items:center; margin-top: 10px; flex-wrap: wrap;">
        <label style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--mute);">PMIDs (optional)</label>
        <input id="conn-edit-pmids" type="text" placeholder="e.g. 21532579, 17220890"
               value="${escape((p.pmids || []).join(', '))}"
               style="flex:1; min-width: 200px; padding: 6px 10px; border:1px solid var(--rule); border-radius: 6px; font-family: 'SF Mono', monospace; font-size: 12px;" />
        <label style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--mute);">Strength</label>
        <input id="conn-edit-strength" type="number" min="0" max="1" step="0.05" value="${typeof p.strength === 'number' ? p.strength : 0.6}"
               style="width: 70px; padding: 6px 10px; border:1px solid var(--rule); border-radius: 6px; font-family: 'SF Mono', monospace; font-size: 12px;" />
      </div>
      <div style="margin-top: 10px; font-size: 11px; color: var(--mute);">Mark <em>Real</em> below + click <strong>Accept into graph</strong> to add this as a dashed-green edge on the network page.</div>
    `;
    // Wire live updates so state.connProposal mirrors the form fields
    $('#conn-edit-kind').addEventListener('change', (e) => {
      state.connProposal.kind = e.target.value;
      $('#conn-edit-kind-swatch').style.background = EDGE_COLORS[e.target.value] || 'var(--mute)';
    });
    $('#conn-edit-note').addEventListener('input', (e) => {
      state.connProposal.note = e.target.value;
      updateConnSaveEnabled(); // re-evaluate Accept-into-graph eligibility live
    });
    $('#conn-edit-pmids').addEventListener('input', (e) => {
      state.connProposal.pmids = e.target.value.split(/[,\s]+/).filter(Boolean);
    });
    $('#conn-edit-strength').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      state.connProposal.strength = isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.6;
    });
    rate.style.display = '';
    renderConnRatingControls();
    return;
  }

  // Read-only card (mock-exact, live, etc.)
  card.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom: 10px;">
      <span style="font-family: 'SF Mono', monospace; font-weight: 700; color: var(--accent); font-size: 18px;">${escape(p.from)}</span>
      <span style="color: var(--mute); font-size: 18px;">↔</span>
      <span style="font-family: 'SF Mono', monospace; font-weight: 700; color: var(--accent); font-size: 18px;">${escape(p.to)}</span>
      <span style="margin-left: auto; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; background: ${color}22; color: ${color};">${escape(p.kind)}</span>
    </div>
    <p style="margin: 0 0 12px; color: var(--ink-soft);">${escape(p.note) || '<em>(no description)</em>'}</p>
    <div style="border-top: 1px solid var(--rule); padding-top: 8px; margin-top: 8px;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--mute); margin-bottom: 4px;">Sources</div>
      <div style="font-size: 12px; color: var(--mute); margin-bottom: 4px;">Per-claim PMIDs need SME validation — for now, verify gene identity on NCBI:</div>
      <ul style="margin: 0; padding-left: 18px;">
        <li style="font-size: 12.5px;"><a href="https://www.ncbi.nlm.nih.gov/gene/?term=${encodeURIComponent(p.from)}%5BGene+Symbol%5D+AND+human%5BOrganism%5D" target="_blank" rel="noopener" style="font-family: 'SF Mono', monospace;">NCBI Gene: ${escape(p.from)}</a></li>
        <li style="font-size: 12.5px;"><a href="https://www.ncbi.nlm.nih.gov/gene/?term=${encodeURIComponent(p.to)}%5BGene+Symbol%5D+AND+human%5BOrganism%5D" target="_blank" rel="noopener" style="font-family: 'SF Mono', monospace;">NCBI Gene: ${escape(p.to)}</a></li>
      </ul>
    </div>
    <div style="margin-top: 10px; font-size: 11px; color: var(--mute);">Source: ${escape(p.source)}${p.usage ? ` · ${p.usage.input_tokens || 0}/${p.usage.output_tokens || 0} tokens` : ''}</div>
  `;
  rate.style.display = '';
  renderConnRatingControls();
}

function renderConnRatingControls() {
  // Validity selection
  $$('#connection-pane [data-validity]').forEach((b) => {
    const sel = b.dataset.validity === state.connRating.validity;
    b.classList.toggle('primary', sel);
    b.style.background = sel
      ? (b.dataset.validity === 'yes' ? 'var(--ok-soft)'
        : b.dataset.validity === 'no' ? 'var(--danger-soft)'
        : 'var(--warn-soft)')
      : '';
    b.style.color = sel
      ? (b.dataset.validity === 'yes' ? 'var(--ok)'
        : b.dataset.validity === 'no' ? 'var(--danger)'
        : 'var(--warn)')
      : '';
    b.style.borderColor = sel ? 'transparent' : '';
  });

  // Stars
  const grid = $('#conn-dim-grid');
  grid.innerHTML = '';
  const dims = [
    ['explanation', 'Explanation', 'How accurate / specific is the mechanism?'],
    ['citation',    'Citation',    'How relevant are the PMIDs?'],
  ];
  for (const [key, label, hint] of dims) {
    grid.appendChild(
      el('div', { class: 'dim-name' },
        el('span', {}, label),
        el('span', { class: 'hint' }, hint),
      ),
    );
    const stars = el('div', { class: 'stars' });
    for (let i = 1; i <= 5; i++) {
      const cur = state.connRating[key];
      stars.appendChild(
        el('div', {
          class: `star ${cur >= i ? 'selected' : ''}`,
          'data-value': i,
          onClick: () => {
            state.connRating[key] = i;
            renderConnRatingControls();
            updateConnSaveEnabled();
          },
        }, '★'),
      );
    }
    grid.appendChild(stars);
    grid.appendChild(el('div', { class: 'dim-val' }, state.connRating[key] || '–'));
  }
  updateConnSaveEnabled();
}

function updateConnSaveEnabled() {
  const r = state.connRating;
  $('#conn-save-btn').disabled = !(r.validity && r.explanation > 0 && r.citation > 0);
  // Accept-into-graph: meaningful for freepair/aisuggest sub-modes.
  //   - In LIVE mode (Claude drafted the proposal) we additionally require
  //     SME to have marked it Real so we don't accept fabrications.
  //   - In MOCK mode the SME *is* the author (editable card) so we only
  //     require a non-empty note + a real kind. Rating is optional but
  //     still gated by validity ≠ "no" so SME can't accidentally accept
  //     something they just marked as Not Real.
  const acceptBtn = $('#conn-accept-btn');
  const p = state.connProposal;
  const inAuthoringMode = state.connSubMode === 'freepair' || state.connSubMode === 'aisuggest';
  let eligible = false;
  if (p && p.kind !== 'none' && inAuthoringMode) {
    if (p.editable) {
      // Mock editable: SME authored the text → require a note + not-marked-Not-Real
      eligible = (p.note || '').trim().length > 0 && r.validity !== 'no';
    } else {
      // Live proposal: require SME confirmation
      eligible = r.validity === 'yes';
    }
  }
  acceptBtn.style.display = eligible ? '' : 'none';
  acceptBtn.disabled = !eligible || !!state.connAcceptedId;
  acceptBtn.textContent = state.connAcceptedId ? '✓ Accepted' : '+ Accept into graph';
}

function resetConnRating() {
  state.connRating = { validity: null, explanation: 0, citation: 0, feedback: '' };
  $('#conn-feedback').value = '';
}

function saveConnRating() {
  if (!state.connProposal) return;
  const r = state.connRating;
  const p = state.connProposal;
  const entry = model.recordEdgeRating({
    edgeId: `${p.from}→${p.to}|${p.kind}`,
    from: p.from, to: p.to, kind: p.kind,
    proposedNote: p.note,
    proposedPmids: p.pmids,
    validity: r.validity,
    explanationQuality: r.explanation,
    citationQuality: r.citation,
    feedback: ($('#conn-feedback').value || '').trim(),
  });
  if (r.validity === 'no') {
    toast(`Marked ${p.from}↔${p.to} as not real. Avoid pattern added; model now ${model.version}.`, 'warn', 4000);
  } else if (r.validity === 'yes' && r.explanation >= 4) {
    toast(`Confirmed ${p.from}↔${p.to}. Promoted to few-shot; model now ${model.version}.`, 'bump', 4000);
  } else {
    toast('Judgement saved.', 'ok');
  }
  // Auto-load the next pair to keep flow going
  state.connProposal = null;
  resetConnRating();
  renderConnProposal();
  if (state.mode === 'mock') {
    setTimeout(() => { pickRandomConnPair(); generateConnection(); }, 500);
  }
}

// =============================================================================
// Helpers
// =============================================================================
function snippet(s, n) {
  s = s.replace(/\s+/g, ' ').trim();
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}
function humanTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return d.toISOString().slice(0, 10);
}
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// =============================================================================
// Boot
// =============================================================================
function boot() {
  // Mount static structure listeners
  $$('.mode-toggle button').forEach((b) =>
    b.addEventListener('click', () => {
      state.mode = b.dataset.mode;
      renderHeader();
      toast(`Mode: ${state.mode === 'mock' ? 'mock briefs' : 'live · Claude'}`, 'ok', 1500);
    }),
  );
  $$('.center-mode button').forEach((b) =>
    b.addEventListener('click', () => {
      state.centerMode = b.dataset.cmode;
      renderCenterMode();
    }),
  );
  $('#api-key-input').addEventListener('input', () => {
    const v = $('#api-key-input').value.trim();
    saveApiKey(v || null);
    renderKeyField();
  });
  $('#api-model').addEventListener('change', (e) => {
    model.updateSettings({ anthropicModel: e.target.value });
  });
  $('#gene-picker').addEventListener('change', (e) => {
    state.currentGene = e.target.value;
    state.currentBrief = null;
    state.abPair = null;
    renderBrief();
    renderABPane();
  });
  $('#generate-btn').addEventListener('click', generateBrief);
  $('#ab-generate-btn').addEventListener('click', generateABPair);
  $('#ab-a').parentElement.addEventListener('click', () => pickABWinner('A'));
  $('#ab-b').parentElement.addEventListener('click', () => pickABWinner('B'));
  $('#ab-tie').addEventListener('click', () => pickABWinner('tie'));
  $('#save-rating').addEventListener('click', saveRating);
  $('#save-gold').addEventListener('click', saveAsGoldStandard);
  $('#skip-rating').addEventListener('click', () => {
    resetRating();
    generateBrief();
  });
  $('#comment-input').addEventListener('input', (e) => { state.currentComment = e.target.value; });
  $('#system-prompt').addEventListener('change', (e) => model.updateSystemPrompt(e.target.value));
  $('#reset-prompt').addEventListener('click', () => {
    if (!confirm('Reset system prompt to the default? This bumps the model version.')) return;
    model.updateSystemPrompt(DEFAULT_SYSTEM_PROMPT);
  });
  $('#add-gene').addEventListener('click', () => openGeneEditor(null));
  $('#gm-save').addEventListener('click', saveGeneFromModal);
  $('#gm-cancel').addEventListener('click', closeGeneEditor);
  $('#exports-toggle').addEventListener('click', (e) => {
    e.stopPropagation();
    $('#exports-toggle').parentElement.classList.toggle('open');
  });
  $('#export-json').addEventListener('click', exportFullState);
  $('#export-dpo').addEventListener('click', exportDpoJsonl);
  $('#export-sft').addEventListener('click', exportSftJsonl);
  $('#export-csv').addEventListener('click', exportRatingsCsv);
  $('#import-json').addEventListener('click', importStateFromFile);
  $('#reset-model').addEventListener('click', () => {
    if (!confirm('Wipe all model state? This is not reversible (export first if you want a backup).')) return;
    model.reset();
    toast('Model reset to v0.1.', 'warn');
  });
  document.addEventListener('click', () => $$('.dropdown.open').forEach((d) => d.classList.remove('open')));

  // Populate model picker
  const sel = $('#api-model');
  sel.innerHTML = '';
  for (const m of ANTHROPIC_MODELS) sel.appendChild(el('option', { value: m.id }, m.label));
  sel.value = model.settings.anthropicModel;

  // Connection-training wiring
  populateConnPickers();
  $('#conn-gene-a').addEventListener('change', (e) => { state.connGeneA = e.target.value; });
  $('#conn-gene-b').addEventListener('change', (e) => { state.connGeneB = e.target.value; });
  $('#conn-random-btn').addEventListener('click', () => { pickRandomConnPair(); });
  $('#conn-generate-btn').addEventListener('click', generateConnection);
  $$('#connection-pane [data-validity]').forEach((btn) =>
    btn.addEventListener('click', () => {
      state.connRating.validity = btn.dataset.validity;
      renderConnRatingControls();
    }),
  );
  $('#conn-save-btn').addEventListener('click', saveConnRating);
  $('#conn-feedback').addEventListener('input', (e) => { state.connRating.feedback = e.target.value; });

  // Sub-mode chips inside Train-connection pane
  $$('.conn-submode button').forEach((b) =>
    b.addEventListener('click', () => {
      state.connSubMode = b.dataset.cmsub;
      renderConnSubMode();
    }),
  );
  // AI-suggest button
  $('#conn-aisuggest-btn').addEventListener('click', generateAiSuggestions);
  // Accept-into-graph button
  $('#conn-accept-btn').addEventListener('click', acceptConnIntoGraph);
  renderConnSubMode();

  // Subscribe to model changes
  model.on('change', () => renderAll());
  model.on('version-bump', (entry) => {
    toast(`Model bumped to ${entry.version} — ${summariseVersion(entry)}`, 'bump', 4500);
  });

  renderAll();
}

function renderAll() {
  renderHeader();
  renderSystemPrompt();
  renderExamplesList();
  renderAvoidList();
  renderRubric();
  renderGenePicker();
  renderCenterMode();
  renderBrief();
  renderRatingStars();
  renderPanelTable();
  renderMetrics();
  renderABPane();
}

document.addEventListener('DOMContentLoaded', boot);
