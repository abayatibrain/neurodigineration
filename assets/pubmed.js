// Minimal PubMed client for the network page — NCBI E-utilities, called
// straight from the browser (they send Access-Control-Allow-Origin: *).
//
// Two jobs:
//   1. resolve a list of PMIDs to title / journal / year, and flag the ones
//      PubMed does not know (the classic LLM-invented citation);
//   2. count and sample papers that mention both genes in title/abstract,
//      as a quick literature-density check on an edge.
//
// Anonymous E-utilities traffic is capped at 3 requests/second, so every
// call goes through one queue spaced ~350 ms apart, with a single backoff
// retry on 429. Results are memoised for the session.

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
const MIN_GAP_MS = 350;
const cache = new Map();
let chain = Promise.resolve();
let last = 0;

function throttled(url) {
  const run = async () => {
    const wait = Math.max(0, last + MIN_GAP_MS - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    let res = await fetch(url);
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1500));
      last = Date.now();
      res = await fetch(url);
    }
    if (!res.ok) throw new Error(`PubMed HTTP ${res.status}`);
    return res.json();
  };
  const p = chain.then(run, run);
  chain = p.catch(() => {});
  return p;
}

function memo(key, fn) {
  if (!cache.has(key)) {
    const p = fn();
    cache.set(key, p);
    p.catch(() => cache.delete(key));
  }
  return cache.get(key);
}

const qs = (o) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

/**
 * Resolve PMIDs. Returns an array in input order:
 *   { pmid, found: true, title, journal, year, firstAuthor } | { pmid, found: false }
 */
export async function pubmedSummaries(pmids) {
  const ids = [...new Set((pmids || []).map((p) => String(p).trim()).filter((p) => /^\d{1,9}$/.test(p)))];
  const bad = (pmids || []).map(String).filter((p) => !/^\d{1,9}$/.test(p.trim()));
  if (!ids.length) return bad.map((pmid) => ({ pmid, found: false }));
  const json = await memo(`sum:${ids.join(',')}`, () =>
    throttled(`${EUTILS}esummary.fcgi?${qs({ db: 'pubmed', id: ids.join(','), retmode: 'json', tool: 'neurodigineration' })}`));
  const r = json?.result || {};
  return [
    ...ids.map((pmid) => {
      const d = r[pmid];
      if (!d || d.error) return { pmid, found: false };
      return {
        pmid,
        found: true,
        title: (d.title || '').replace(/\.$/, ''),
        journal: d.source || d.fulljournalname || '',
        year: (d.pubdate || '').slice(0, 4),
        firstAuthor: d.authors?.[0]?.name || '',
      };
    }),
    ...bad.map((pmid) => ({ pmid, found: false })),
  ];
}

/** Build a title/abstract clause matching any of a gene's names. */
function tiabClause(names) {
  const uniq = [...new Set(names.filter(Boolean).map((n) => n.trim()).filter((n) => n.length >= 2))];
  return '(' + uniq.map((n) => `"${n.replace(/"/g, '')}"[tiab]`).join(' OR ') + ')';
}

/**
 * Papers mentioning both genes (any listed name) in title or abstract.
 * @returns {{ count:number, term:string, url:string, top:Array }}
 */
export async function pubmedCoMention(namesA, namesB, { retmax = 5 } = {}) {
  const term = `${tiabClause(namesA)} AND ${tiabClause(namesB)}`;
  return memo(`co:${term}:${retmax}`, async () => {
    const s = await throttled(`${EUTILS}esearch.fcgi?${qs({ db: 'pubmed', term, retmode: 'json', retmax, sort: 'relevance', tool: 'neurodigineration' })}`);
    const count = Number(s?.esearchresult?.count || 0);
    const ids = s?.esearchresult?.idlist || [];
    const top = ids.length ? (await pubmedSummaries(ids)).filter((x) => x.found) : [];
    return { count, term, url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(term)}`, top };
  });
}
