// Model tests: consensus, prompt compilation, schema migration.
// Run: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BioscopeModel, pairKey, defaultModelState } from '../assets/model.js';

test('BioscopeModel network knowledge + migration', () => {
  const log = console.log; console.log = () => {}; // silence migration notes
  const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };

  // fresh
  let st = mem(); let m = new BioscopeModel(st);
  assert.equal(m.state.schemaVersion, 2);
  assert.equal(m.settings.anthropicModel, 'claude-opus-5');
  assert.equal(pairKey('snca', 'GBA'), pairKey('GBA', 'SNCA'));
  assert.equal(m.edgeConsensus('A', 'B').status, 'unrated');

  // ratings → consensus, pooled across direction and kind
  const rate = (from, to, validity, kind = 'complex', q = 4) => m.recordEdgeRating({ edgeId: `${from}→${to}|${kind}`, from, to, kind, proposedNote: 'n', proposedPmids: [], validity, explanationQuality: q, citationQuality: 3, feedback: validity === 'no' ? 'wrong direction' : '' });
  const v0 = m.version;
  rate('SNCA', 'GBA', 'yes');
  assert.equal(m.edgeConsensus('GBA', 'SNCA').status, 'confirmed');
  assert.notEqual(m.version, v0, 'confirmation bumps');
  rate('GBA', 'SNCA', 'no', 'opposes');
  const c = m.edgeConsensus('SNCA', 'GBA');
  assert.equal(c.status, 'contested'); assert.equal(c.n, 2);
  assert.ok(Math.abs(c.pReal - 0.5) < 1e-9);
  rate('PINK1', 'PRKN', 'no');
  rate('X1', 'Y1', 'uncertain', 'complex', 2);
  assert.equal(m.edgeConsensus('X1', 'Y1').status, 'uncertain');
  // brief pools untouched
  assert.equal(m.avoidPatterns.length, 0); assert.equal(m.fewShotExamples.length, 0);

  // compiled prompt: scoped + contested left out
  let p = m.compilePrompt({ genes: ['PINK1'] });
  assert.match(p.system, /Rejected, do not assert these:\n- PINK1 – PRKN as complex \[SME: wrong direction\]/);
  assert.doesNotMatch(p.system, /SNCA/);
  p = m.compilePrompt({ genes: ['TP53'] });
  assert.doesNotMatch(p.system, /network knowledge/);
  m.recordAcceptedEdge({ from: 'TFEB', to: 'GAA', kind: 'shared-mechanism', note: 'glycogen', source: 'manual' });
  p = m.compilePrompt({ genes: ['GAA'] });
  assert.match(p.system, /Confirmed connections:\n- TFEB – GAA \(shared-mechanism\): glycogen/);

  // budget split
  const m2 = new BioscopeModel(mem());
  for (let i = 0; i < 30; i++) m2.recordEdgeRating({ from: 'A' + i, to: 'B', kind: 'complex', validity: 'no', explanationQuality: 1, citationQuality: 1 });
  for (let i = 0; i < 5; i++) m2.recordEdgeRating({ from: 'C' + i, to: 'B', kind: 'complex', validity: 'yes', explanationQuality: 5, citationQuality: 5 });
  const nk = m2.networkKnowledge({ genes: ['B'] });
  assert.equal(nk.confirmed.length, 5); assert.equal(nk.rejected.length, 19);

  // v1 → v2 migration moves legacy edge entries out of brief pools
  const legacy = defaultModelState();
  legacy.schemaVersion = 1;
  legacy.settings.anthropicModel = 'claude-haiku-4-5-20251001';
  legacy.panel = legacy.panel.slice(0, 10);
  legacy.avoidPatterns = [{ pattern: 'Do not assert…', sourceDimension: 'network-edge-validity' }, { pattern: 'hedging', sourceDimension: 'clarity' }];
  legacy.fewShotExamples = [{ gene: 'PINK1', brief: 'PINK1 ↔ PRKN (kinase-substrate): phosphorylates', overall: 4 }, { gene: 'SNCA', brief: '# SNCA brief', overall: 4.5 }];
  delete legacy.edgeRatings;
  const st3 = mem(); st3.setItem('nd-train-v1', JSON.stringify(legacy));
  const m3 = new BioscopeModel(st3);
  assert.equal(m3.avoidPatterns.length, 1); assert.equal(m3.fewShotExamples.length, 1);
  assert.equal(m3.settings.anthropicModel, 'claude-haiku-4-5');
  assert.equal(m3.panel.length, defaultModelState().panel.length);
  assert.ok(Array.isArray(m3.edgeRatings));
  assert.equal(m3.state.versionHistory.at(-1).change, 'schema-migration');
  // import runs the same migration
  const m4 = new BioscopeModel(mem()); m4.import(JSON.stringify(legacy));
  assert.equal(m4.avoidPatterns.length, 1); assert.equal(m4.state.schemaVersion, 2);
  assert.equal(m4.compilePrompt().fewShot.length, 2);
  console.log = log;
});
