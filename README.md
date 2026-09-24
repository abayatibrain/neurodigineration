# neurodigineration-web

A research-grade gene brief, composed live in the browser from four public bioinformatics APIs.

Type a human gene symbol. **neurodigineration** queries [UniProt](https://www.uniprot.org/),
[NCBI E-utilities](https://www.ncbi.nlm.nih.gov/home/develop/api/),
[Ensembl REST](https://rest.ensembl.org/), and
[Reactome ContentService](https://reactome.org/ContentService/) in parallel and renders a
structured brief — protein function, gene metadata, pathway membership, and the five most
recent PubMed citations — in the time it takes you to read this sentence.

![neurodigineration showing a brief for SNCA](docs/screenshot-snca-full.png)

## Live demo

Once deployed to GitHub Pages, the app lives at the root of this repository's Pages URL.
Deep links work: append `?gene=SNCA` (or any symbol) to share a specific brief.

## What it is

This is the browser-native sibling of [neurodigineration](https://github.com/abayatibrain/neurodigineration) — a TypeScript CLI that
wraps the same four public bioinformatics APIs in a Model Context Protocol (MCP) server for
Claude Code, with custom slash commands, scoped sub-agents, pre/post tool-use hooks, and a
Claude Agent SDK headless build.

`neurodigineration` is deliberately the minimum demonstration of that pipeline that an employer
can try in a single click. It has:

- No backend.
- No build step.
- No dependencies — `index.html` is the whole app.
- No tracking, no analytics.
- No cached results — every brief is composed live from primary sources.

The four APIs all serve `Access-Control-Allow-Origin: *`, so the page calls them directly
from the browser. The only client-side smarts are a small per-host request queue (to respect
NCBI's 3-requests-per-second limit for anonymous traffic) and a 429/503 retry with backoff.

## How a brief is composed

```
User types a symbol
        │
        ▼
┌───────────────────────────── parallel (4 requests) ─────────────────────────────┐
│  UniProt search        NCBI esearch (gene)     Ensembl lookup     PubMed esearch │
│  → accession, function → Entrez gene UID       → Ensembl gene ID  → top 5 PMIDs  │
└────────────────────────────────────────────────────────────────────────────────┘
        │                       │                       │                  │
        │                       ▼                       │                  ▼
        │           NCBI esummary (gene)                │      PubMed esummary
        │           → name, summary, locus              │      → titles, journals, dates
        ▼                       │                       │                  │
Reactome mapping                │                       │                  │
(UniProt → pathways)            │                       │                  │
        │                       │                       │                  │
        ▼                       ▼                       ▼                  ▼
                              Rendered brief
```

Failures in any one source degrade gracefully — the other sections still render with their
own data.

## Training mode (`/train.html`) — human-in-the-loop SME GUI

`neurodigineration` ships a second page, **[train.html](train.html)**, that turns the brief
viewer into a labelling and prompt-engineering workbench. It's the GUI a subject-matter
expert uses to teach the brief generator what "good" looks like.

![neurodigineration training mode](docs/screenshot-train.png)

**The "model" is a JSON object in your browser.** It has no neural weights of its own;
instead it parameterises every brief request through four knobs the learning loop updates
from your preference data:

- `systemPrompt` — instructions handed to Claude (or the mock template).
- `fewShotExamples` — briefs you rated ≥ 4/5 get promoted into Claude's in-context example pool.
- `avoidPatterns` — failure modes distilled from briefs you rated ≤ 2/5 are appended to the system prompt as explicit "don't do this" rules.
- `rubricWeights` — dimensions you tend to rate harshly get more weight in the overall score, so the rubric reflects what you care about, not a uniform average.

The model bumps its version (v0.1 → v0.2 → …) every time the learning loop fires (default: every 3 ratings), and every bump is logged in a version timeline with the diff. State persists in `localStorage`; you can import/export the whole model as JSON, and you can export your accumulated labels in three industry-standard formats: full state JSON, preference pairs as DPO JSONL (chosen/rejected), gold-standard briefs as SFT JSONL (prompt/completion).

**Two run modes:**

| Mode | What it does | When to use it |
| --- | --- | --- |
| **Mock** (default) | Uses a bundled pool of 18 hand-crafted briefs (6 neurodegen + cancer-canon genes × 3 quality variants each: complete-and-cited, partial, hedging-and-vague). Zero API key, fully offline after the page loads. | Demo to employers, practise labelling, or build up enough preference data to be worth running against a real model. |
| **Live** | Calls Claude directly from the browser using your Anthropic API key (`anthropic-dangerous-direct-browser-access` header). Key is stored only in `localStorage`, sent only to `api.anthropic.com`. Streaming via SSE. Defaults to Claude Opus 5 (with the server-side refusal fallback on); Sonnet 5, Haiku 4.5 and the 4.6 models are in the dropdown. | Real RLHF-style training: every rating you make actually shifts the next generation, because the model state shapes the next prompt sent to Claude. |

**Three labelling workflows:**

1. **Rate one brief on four dimensions** — Factuality, Completeness, Citation, Clarity. Each 1–5. Optional comment becomes the distilled avoid-pattern if you rate ≤ 2. Saves a `Rating` to the log.
2. **A/B preference** — two briefs side-by-side, pick the winner (or Tie). In live mode, A vs B is *current trained model* vs *bare baseline prompt*, so your preferences become directly DPO-trainable data. In mock mode, A vs B is *high-quality variant* vs *low-quality variant*.
3. **Save as gold standard** — when a brief is good enough to use as an exemplar, save it as an SFT example. Exports as a JSONL with `{messages: [system, user, assistant]}` ready for OpenAI/Anthropic fine-tuning APIs.

**Gene panel CRUD.** The right column lists the genes available in the picker. You can add new symbols (live mode supports any HGNC symbol; mock mode is limited to the bundled six). Each entry stores aliases, free-text notes, and "expected tokens" used by future eval extensions.

**Metrics dashboard.** Counters (ratings, preferences, gold standards, examples, avoid patterns), a rating-distribution histogram, per-dimension trend over the last 12 ratings, and the full version-bump timeline.

### Network verdicts and the compiled prompt

Edge ratings (from the network page or train-page connection mode) don't go into the brief
pools anymore. Up to v1.2.x they were pushed into `avoidPatterns` and `fewShotExamples`,
which had two bad side effects: eight edge rejections would evict every brief-derived avoid
pattern (the pool is capped at 8), and one-line edge notes got replayed to Claude as if they
were example briefs.

Now each verdict is pooled per gene pair into a consensus (`model.edgeConsensus(a, b)`):
confirmed, rejected, contested or uncertain, plus a Beta(1,1) posterior for P(real).
`model.compilePrompt({ genes })` is the one place a request's system prompt and few-shot turns
get assembled. It appends the SME's confirmed and rejected pairs that touch the genes in play,
and deliberately leaves contested pairs out, because "the expert isn't sure" is noise to a
model. The train, ask and network pages all call it. Saved states migrate on load and on
import (schema v2); nothing the SME taught is dropped, since every verdict still lives in
`edgeRatings`.

### File structure for training mode

```
neurodigineration-web/
├── train.html              # the training-mode page
├── assets/
│   ├── train.css           # all training-mode styles
│   ├── model.js            # BioscopeModel class — state + learning loop
│   ├── mock-briefs.js      # the 18-brief bundled pool
│   ├── anthropic.js        # direct-from-browser Anthropic adapter
│   └── app.js              # main wiring, UI handlers, rendering
```

### Roadmap: GUI 2

Once you've trained the model to your satisfaction (and exported the state), a second GUI
(`use.html`, planned) will load any model export and act as a clean end-user tool: pick a
gene, get a brief, no labelling controls, no model state visible. The training GUI produces
the artifact; the use GUI consumes it.

## Network page (`/network.html`)

A force-directed map of 324 genes and 510 curated edges across 11 disease groups, built so an
SME can audit the graph edge by edge and teach the model as they go.

![neurodigineration network, path tracer](docs/screenshot-network-path.png)

- **Search** by symbol, alias or protein name (`/` focuses it). "krox" finds EGR2.
- **Path tracer** (⇢): up to three cheapest routes between any two genes. Costs favour strong,
  curated, mechanistic edges and your confirmations; shared-disease links are penalised
  (co-implication isn't a mechanism) and edges you rejected are never used. Routes that lean
  on tentative or shared-disease steps are flagged as hypotheses.
- **Live PubMed evidence** per edge, straight from E-utilities in the browser: listed PMIDs
  are resolved to title/journal/year, and any PMID PubMed doesn't know is flagged in red
  (which is exactly how an invented citation from the ✦ suggest box shows up). There's also
  a title/abstract co-mention count with the top hits. Short symbols (APP, HTT, CP) inflate
  that count, and the panel says so.
- **Triage** (◎): walks unrated edges one at a time, tentative and uncited first. `N` skips.
- **Verdict styling**: pairs you confirmed turn solid (even if curated as tentative), rejected
  ones go red-dotted, contested ones gold. Toggle it in *Legend & filters*, where each edge
  kind can also be hidden.
- **Shareable links**: `?gene=SNCA`, `?edge=GBA~SNCA`, `?path=GBA~MAPT`.
- Rating a Claude-suggested edge *Real* persists it as an SME-accepted edge.

### Round 7 data changes

The Round 7 pass was mostly hygiene, and it found more than expected:

- **The graph was in 8 pieces.** SOD1, the gene most people associate with familial ALS, had
  zero edges. So did EPHA1, CLN6 and CLN8. A 14-gene lysosomal-enzyme cluster, the CMT myelin
  trio (PMP22/MPZ/GJB1) and GIGYF2/EIF4G1 were islands. It's now one component, with SOD1
  wired to CCS, C9orf72, TARDBP (as the notable *exception* to TDP-43 pathology), VDAC1 and p62.
- **`kinase-substrate` was a catch-all.** Of 77 edges, 22 were actually kinases. The rest
  were secretases, cathepsins, E3 ligases, phosphatases, CLEAR-network TFs, IRE1's RNase and
  SUMF1's formylglycine chemistry. Two new kinds, `enzyme-substrate` and `transcriptional`,
  take those, and edges that pointed substrate → enzyme (APP → BACE1, MAPT → GSK3B, …) were
  flipped so directional kinds always read actor → target. Parkin → α-synuclein
  ubiquitination is now marked tentative; it's contested in the literature.
- 3 duplicate edges removed, 13 genes added (Doppel, Shadoo, mGluR5, ceruloplasmin, COASY,
  FA2H, spastizin, AP5Z1, PNPLA6, EGR2, GDAP1, CCS, GFAP) and mirrored in the trainable panel.
- New edges ship with `pmids: []`. PMIDs that couldn't be verified were left out rather than
  guessed; the evidence panel is the intended way to back-fill them.

`tests/` checks those invariants (one component, no dangling or duplicate edges, known kinds,
graph and panel 1:1) plus the model's consensus, prompt compilation and migration:

```bash
node --test tests/*.test.mjs
```

## Local development

It's a static page. Open it directly, or serve it for the deep-link `?gene=…` routing:

```bash
python3 -m http.server 8765
# then open http://127.0.0.1:8765/
```

## Project structure

```
neurodigineration-web/
├── index.html                  # public brief viewer (no training controls)
├── train.html                  # human-in-the-loop SME training GUI
├── ask.html                    # free-form Q&A using the trained model
├── network.html                # interactive cross-disease gene network
├── validation.html             # how the model is validated and benchmarked
├── assets/
│   ├── train.css               # styles for train.html
│   ├── model.js                # BioscopeModel: state, learning loop, edge consensus, compilePrompt
│   ├── mock-briefs.js          # bundled 18-brief pool for mock mode
│   ├── anthropic.js            # direct-from-browser Anthropic adapter
│   ├── app.js                  # main wiring for train.html
│   ├── ask.js / ask.css        # ask page
│   ├── network.js / .css       # network page (D3 v7 from CDN)
│   ├── network-data.js         # curated nodes, edges and edge-kind definitions
│   └── pubmed.js               # rate-limited E-utilities client for live evidence
├── tests/                      # node --test: graph integrity + model behaviour
├── preview.png                 # Handshake AI Showcase tile (SNCA brief above the fold)
├── docs/
│   ├── screenshot-snca-full.png
│   ├── screenshot-snca-brief.png
│   └── screenshot-train.png    # training-mode hero shot for the README
├── .github/workflows/pages.yml # deploys to GitHub Pages on push to main
├── .nojekyll                   # serve as-is, skip Jekyll processing
├── LICENSE
└── README.md
```

## Built with

neurodigineration was built with [Claude Code](https://docs.claude.com/claude-code) using the
same `neurodigineration` design that exposes these four APIs to Claude as MCP tools. The browser
version drops the agent layer and goes straight to the APIs — the minimum thing an employer
can click on and instantly see what subject-matter expertise looks like in code.

## License

[MIT](LICENSE) — see `LICENSE`.

## Author

Made by [Armin Bayati](https://arminbayati.com).
