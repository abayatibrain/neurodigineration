# bioscope-web

A research-grade gene brief, composed live in the browser from four public bioinformatics APIs.

Type a human gene symbol. **bioscope-web** queries [UniProt](https://www.uniprot.org/),
[NCBI E-utilities](https://www.ncbi.nlm.nih.gov/home/develop/api/),
[Ensembl REST](https://rest.ensembl.org/), and
[Reactome ContentService](https://reactome.org/ContentService/) in parallel and renders a
structured brief — protein function, gene metadata, pathway membership, and the five most
recent PubMed citations — in the time it takes you to read this sentence.

![bioscope-web showing a brief for SNCA](docs/screenshot-snca-full.png)

## Live demo

Once deployed to GitHub Pages, the app lives at the root of this repository's Pages URL.
Deep links work: append `?gene=SNCA` (or any symbol) to share a specific brief.

## What it is

This is the browser-native sibling of [bioscope](https://github.com/abayatibrain/bioscope) — a TypeScript CLI that
wraps the same four public bioinformatics APIs in a Model Context Protocol (MCP) server for
Claude Code, with custom slash commands, scoped sub-agents, pre/post tool-use hooks, and a
Claude Agent SDK headless build.

`bioscope-web` is deliberately the minimum demonstration of that pipeline that an employer
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

## Local development

It's a static page. Open it directly, or serve it for the deep-link `?gene=…` routing:

```bash
python3 -m http.server 8765
# then open http://127.0.0.1:8765/
```

## Project structure

```
bioscope-web/
├── index.html                  # the whole app — HTML, CSS, vanilla JS
├── preview.png                 # Handshake AI Showcase tile (SNCA brief above the fold)
├── docs/
│   ├── screenshot-snca-full.png
│   └── screenshot-snca-brief.png
├── .github/workflows/pages.yml # deploys to GitHub Pages on push to main
├── .nojekyll                   # serve as-is, skip Jekyll processing
├── LICENSE
└── README.md
```

## Built with

bioscope-web was built with [Claude Code](https://docs.claude.com/claude-code) using the
same `bioscope` design that exposes these four APIs to Claude as MCP tools. The browser
version drops the agent layer and goes straight to the APIs — the minimum thing an employer
can click on and instantly see what subject-matter expertise looks like in code.

## License

[MIT](LICENSE) — see `LICENSE`.

## Author

Made by [Armin Bayati](https://arminbayati.com).
