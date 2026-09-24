// Graph integrity checks for network-data.js. These are the invariants
// Round 7 restored; run before shipping any new data round.
// Run: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DISEASES, NODES, EDGES, EDGE_COLORS, EDGE_LEGEND, EDGE_KIND_DEFS } from '../assets/network-data.js';
import { defaultModelState } from '../assets/model.js';

const ids = new Set(NODES.map((n) => n.id));

test('node ids are unique and diseases are known', () => {
  assert.equal(ids.size, NODES.length);
  for (const n of NODES) {
    assert.ok(DISEASES[n.disease], `${n.id}: unknown disease ${n.disease}`);
    for (const s of n.secondary || []) assert.ok(DISEASES[s], `${n.id}: unknown secondary ${s}`);
    assert.ok(n.prevalence >= 0 && n.prevalence <= 1, `${n.id}: prevalence out of range`);
  }
});

test('edges reference real nodes, known kinds, no self-loops or duplicate pairs', () => {
  const seen = new Map();
  for (const e of EDGES) {
    assert.ok(ids.has(e.from) && ids.has(e.to), `dangling ${e.from}-${e.to}`);
    assert.notEqual(e.from, e.to, `self-loop ${e.from}`);
    assert.ok(EDGE_COLORS[e.kind] && EDGE_KIND_DEFS[e.kind], `unknown kind ${e.kind}`);
    const k = [e.from, e.to].sort().join('~') + '|' + e.kind;
    assert.ok(!seen.has(k), `duplicate edge ${k}`);
    seen.set(k, true);
    assert.ok(Array.isArray(e.pmids ?? []), `${k}: pmids must be an array`);
    for (const p of e.pmids || []) assert.match(String(p), /^\d{1,9}$/, `${k}: malformed PMID ${p}`);
  }
});

test('graph is one connected component with no isolated nodes', () => {
  const adj = new Map(NODES.map((n) => [n.id, []]));
  for (const e of EDGES) { adj.get(e.from).push(e.to); adj.get(e.to).push(e.from); }
  const isolated = [...adj].filter(([, v]) => !v.length).map(([k]) => k);
  assert.deepEqual(isolated, []);
  const seen = new Set([NODES[0].id]);
  const stack = [NODES[0].id];
  while (stack.length) for (const y of adj.get(stack.pop())) if (!seen.has(y)) { seen.add(y); stack.push(y); }
  assert.equal(seen.size, NODES.length, `unreachable: ${[...ids].filter((x) => !seen.has(x)).slice(0, 10).join(', ')}`);
});

test('legend and colour table cover the same kinds', () => {
  assert.deepEqual(new Set(EDGE_LEGEND.map((x) => x.kind)), new Set(Object.keys(EDGE_COLORS)));
});

test('graph nodes and the trainable panel are 1:1', () => {
  const panel = new Set(defaultModelState().panel.map((g) => g.symbol));
  assert.deepEqual([...ids].filter((x) => !panel.has(x)), []);
  assert.deepEqual([...panel].filter((x) => !ids.has(x)), []);
});
