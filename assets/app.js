// bioscope-web training mode — main app wiring.
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

const model = new BioscopeModel();

const state = {
  mode: 'mock', // 'mock' | 'live'
  centerMode: 'single', // 'single' | 'ab'
  currentGene: model.panel[0]?.symbol ?? 'SNCA',
  currentBrief: null, // { gene, brief, source, variant }
  currentRating: { factuality: 0, completeness: 0, citation: 0, clarity: 0 },
  currentComment: '',
  abPair: null, // { gene, A, B }
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
      messages.push({ role: 'user', content: `Produce a bioscope brief for the gene ${ex.gene}.` });
      messages.push({ role: 'assistant', content: ex.brief });
    }
    messages.push({ role: 'user', content: `Produce a bioscope brief for the gene ${gene}. Follow every rule in the system prompt.` });

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
      messages: [{ role: 'user', content: `Produce a bioscope brief for the gene ${gene}.` }],
      maxTokens: model.settings.anthropicMaxTokens,
    });
    const trainedMessages = [];
    for (const ex of model.fewShotExamples.slice(-3)) {
      trainedMessages.push({ role: 'user', content: `Produce a bioscope brief for the gene ${ex.gene}.` });
      trainedMessages.push({ role: 'assistant', content: ex.brief });
    }
    trainedMessages.push({ role: 'user', content: `Produce a bioscope brief for the gene ${gene}.` });
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
  download('bioscope-model.json', model.export(), 'application/json');
}

function exportDpoJsonl() {
  if (model.preferences.length === 0) { toast('No preference data yet.', 'warn'); return; }
  const lines = model.preferences
    .filter((p) => p.winner !== 'tie')
    .map((p) => {
      const chosen = p.winner === 'A' ? p.briefA.full : p.briefB.full;
      const rejected = p.winner === 'A' ? p.briefB.full : p.briefA.full;
      return JSON.stringify({
        prompt: `Produce a bioscope brief for the gene ${p.gene}.`,
        chosen,
        rejected,
        metadata: { gene: p.gene, model_version: model.version, reason: p.reason },
      });
    });
  if (lines.length === 0) { toast('All preferences were ties.', 'warn'); return; }
  download('bioscope-preferences.jsonl', lines.join('\n'), 'application/jsonl');
}

function exportSftJsonl() {
  if (model.goldStandards.length === 0) { toast('No gold-standard briefs yet.', 'warn'); return; }
  const lines = model.goldStandards.map((g) =>
    JSON.stringify({
      messages: [
        { role: 'system', content: model.systemPrompt },
        { role: 'user', content: `Produce a bioscope brief for the gene ${g.gene}.` },
        { role: 'assistant', content: g.brief },
      ],
      metadata: { gene: g.gene, model_version: model.version, notes: g.notes },
    }),
  );
  download('bioscope-gold-standards.jsonl', lines.join('\n'), 'application/jsonl');
}

function exportRatingsCsv() {
  if (model.ratingsLog.length === 0) { toast('No ratings yet.', 'warn'); return; }
  const head = 'id,gene,source,variant,factuality,completeness,citation,clarity,overall,comment,rated_at\n';
  const rows = model.ratingsLog.map((r) =>
    [r.id, r.gene, r.briefSource, r.briefVariant ?? '',
     r.ratings.factuality, r.ratings.completeness, r.ratings.citation, r.ratings.clarity,
     r.overall, JSON.stringify(r.comment || ''), r.ratedAt].join(','),
  );
  download('bioscope-ratings.csv', head + rows.join('\n'), 'text/csv');
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
