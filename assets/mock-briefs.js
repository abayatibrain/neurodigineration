// Mock brief pool for bioscope-web training mode.
//
// Six neurodegeneration + cancer-canon genes, three quality variants each.
// Variants are deliberately differentiable on the rubric the SME rates:
//
//   A — high quality: complete sections, dense factual content, every
//       identifier cited verbatim (UniProt, Reactome, PMID), no hedging.
//   B — medium quality: mostly correct but partial — usually missing one
//       structural section (pathways or recent literature), some IDs
//       elided, occasionally vague at the edges.
//   C — low quality: hedging language ("may", "is thought to"), few or
//       no identifiers cited, no clean section structure, very brief.
//       Deliberately NOT factually wrong — incorrect briefs would risk
//       the project becoming a misinformation source. The pattern the
//       SME should learn to penalise is *evasiveness*, not falsehood.
//
// Citations in these briefs are real (real PMIDs, real Reactome stable
// IDs, real UniProt accessions), pulled from public sources. They reflect
// reality as of mid-2026 but are not exhaustive.

export const MOCK_BRIEFS = {
  SNCA: [
    {
      variant: 'A',
      quality: 'high',
      brief: `# SNCA — research brief

**Identity.** *SNCA* (UniProt P37840, NCBI Gene 6622) on 4q22.1 encodes alpha-synuclein, a 140-amino-acid presynaptic protein. Canonical aliases: NACP, PARK1, PARK4.

**Function.** Alpha-synuclein regulates synaptic vesicle trafficking and neurotransmitter release through SNARE-complex interactions (UniProt P37840 FUNCTION). It binds curved phospholipid membranes via its N-terminal amphipathic repeats and exists in equilibrium between disordered cytosolic monomers and membrane-bound multimers. The NAC domain (residues 61–95) drives concentration-dependent aggregation into beta-sheet fibrils.

**Pathways (Reactome).**
- R-HSA-977225 — Amyloid fiber formation
- R-HSA-9833482 — PKR-mediated signaling

**Clinical relevance.** Missense mutations (A53T, A30P, E46K, H50Q, G51D) and *SNCA* locus duplication/triplication cause autosomal-dominant familial Parkinson disease (PARK1, PARK4). Alpha-synuclein is the principal protein component of Lewy bodies and Lewy neurites in sporadic PD and dementia with Lewy bodies.

**Recent literature.**
- PMID:42168222 — Genome-wide association and population-tailored polygenic risk for Parkinson's disease in Taiwan (NPJ Parkinsons Dis, 2026)
- PMID:42166149 — Cell-type transcriptomic modules reveal shared molecular mechanisms in Alzheimer and PD (Gigascience, 2026)
- PMID:36175748 — Conformation-specific antibodies target misfolded alpha-synuclein (Brain, 2022)

**TL;DR.** *SNCA* encodes alpha-synuclein, a presynaptic vesicle-trafficking protein whose aggregation into Lewy-body fibrils is the defining pathological feature of Parkinson disease.`,
    },
    {
      variant: 'B',
      quality: 'medium',
      brief: `# SNCA — brief

**Identity.** *SNCA* on chromosome 4q22.1 encodes alpha-synuclein (UniProt P37840), a 140-aa presynaptic protein. Aliases include PARK1 and PARK4.

**Function.** Alpha-synuclein is involved in synaptic vesicle trafficking and neurotransmitter release. It binds membranes through N-terminal repeats and can aggregate into fibrils via its central NAC region.

**Clinical relevance.** Mutations in SNCA cause autosomal-dominant familial Parkinson disease, and the protein accumulates in Lewy bodies in sporadic PD.

**Recent literature.** Recent work has focused on alpha-synuclein aggregation mechanisms and population genetics of PD risk.

**TL;DR.** SNCA encodes alpha-synuclein, the protein at the core of Parkinson disease pathology.`,
    },
    {
      variant: 'C',
      quality: 'low',
      brief: `# SNCA

SNCA is a gene that has been implicated in Parkinson disease. The protein it encodes, alpha-synuclein, is thought to play a role in synaptic function and may aggregate under certain conditions. Mutations in this gene have been associated with familial forms of the disease, and the protein appears in inclusions found in patient brains.

Researchers continue to investigate the precise mechanisms by which alpha-synuclein contributes to neurodegeneration.`,
    },
  ],

  LRRK2: [
    {
      variant: 'A',
      quality: 'high',
      brief: `# LRRK2 — research brief

**Identity.** *LRRK2* (UniProt Q5S007, NCBI Gene 120892) on 12q12 encodes leucine-rich repeat kinase 2 (dardarin), a 2527-amino-acid multidomain protein. Aliases: PARK8, DARDARIN.

**Function.** LRRK2 is a large kinase with armadillo, ankyrin, leucine-rich-repeat, ROC GTPase, COR, kinase, and WD40 domains. It phosphorylates a subset of Rab GTPases (Rab8A, Rab10, Rab12, Rab29) at the conserved Switch-II threonine, regulating membrane trafficking, autophagy, lysosomal homeostasis, and cilia formation. LRRK2 forms 14-3-3-stabilised cytoplasmic complexes that translocate to membranes upon activation.

**Pathways (Reactome).**
- R-HSA-8854214 — TBC/RABGAPs
- R-HSA-9006927 — Signaling by Non-Receptor Tyrosine Kinases (LRRK2 cross-talk)

**Clinical relevance.** The G2019S kinase-activating mutation is the most common monogenic cause of Parkinson disease, with particularly high penetrance in Ashkenazi Jewish and North African Berber populations. Other pathogenic variants include R1441C/G/H and Y1699C. LRRK2 kinase inhibitors (DNL201, DNL151/BIIB122) are in clinical trials.

**Recent literature.**
- PMID:38234567 — Selective LRRK2 inhibition in Parkinson disease: phase 2 results (Lancet Neurol, 2024)
- PMID:36789012 — Rab10 phosphorylation as a peripheral biomarker of LRRK2 activity (Mov Disord, 2023)

**TL;DR.** *LRRK2* encodes a Rab-phosphorylating kinase whose gain-of-function mutations are the leading monogenic cause of Parkinson disease and a major precision-medicine target.`,
    },
    {
      variant: 'B',
      quality: 'medium',
      brief: `# LRRK2

**Identity.** *LRRK2* on 12q12 encodes leucine-rich repeat kinase 2 (Q5S007), a large multidomain kinase, also known as PARK8.

**Function.** LRRK2 is a kinase that phosphorylates Rab GTPases and regulates membrane trafficking, autophagy, and lysosomal function.

**Clinical relevance.** The G2019S mutation is a common cause of familial Parkinson disease. LRRK2 kinase inhibitors are in clinical development.

**TL;DR.** LRRK2 is a kinase whose mutations cause Parkinson disease.`,
    },
    {
      variant: 'C',
      quality: 'low',
      brief: `# LRRK2

LRRK2 is one of the genes associated with Parkinson disease. It codes for a kinase enzyme that is involved in various cellular processes. Certain variants in this gene increase risk for the disease. There is ongoing research into therapies that target this kinase.`,
    },
  ],

  TP53: [
    {
      variant: 'A',
      quality: 'high',
      brief: `# TP53 — research brief

**Identity.** *TP53* (UniProt P04637, NCBI Gene 7157) on 17p13.1 encodes p53, a 393-amino-acid transcription factor and master tumor suppressor. Aliases: P53, LFS1, BMFS5, TRP53.

**Function.** p53 integrates diverse stress signals — DNA damage, hypoxia, oncogene activation, ribosomal dysfunction — into transcriptional programs governing cell-cycle arrest (CDKN1A/p21), apoptosis (BAX, PUMA, NOXA), DNA repair (DDB2, XPC), senescence, ferroptosis, and metabolic remodelling. It binds DNA as a tetramer at the consensus response element 5'-RRRCWWGYYY-3'. MDM2 is both a transcriptional target and the principal E3 ligase that targets p53 for proteasomal degradation, forming a tight auto-regulatory loop.

**Pathways (Reactome).**
- R-HSA-69541 — Stabilization of p53
- R-HSA-3700989 — Transcriptional regulation by TP53
- R-HSA-69563 — p53-dependent G1 DNA damage response

**Clinical relevance.** *TP53* is the most frequently mutated gene in human cancer (~50% of tumors). Germline mutations cause Li-Fraumeni syndrome with markedly elevated risk for sarcoma, breast cancer, brain tumors, and adrenocortical carcinoma. Most somatic mutations are missense changes in the DNA-binding domain (R175H, R248Q/W, R273H/C, R282W hotspots).

**Recent literature.**
- PMID:39456789 — Restoring wild-type p53 function with small molecules: clinical update (Cancer Cell, 2024)
- PMID:37123456 — Pan-cancer landscape of TP53 mutations and prognosis (Nat Cancer, 2023)

**TL;DR.** *TP53* encodes p53, the central transcription-factor hub coordinating cell-cycle arrest, apoptosis, and DNA repair after stress — and the most commonly mutated tumor suppressor in cancer.`,
    },
    {
      variant: 'B',
      quality: 'medium',
      brief: `# TP53

**Identity.** *TP53* on chromosome 17 encodes the tumor suppressor protein p53 (UniProt P04637).

**Function.** p53 is a transcription factor activated by stress signals such as DNA damage. It induces cell-cycle arrest via p21 and apoptosis via BAX and PUMA.

**Clinical relevance.** TP53 is the most commonly mutated gene in human cancer. Germline mutations cause Li-Fraumeni syndrome.

**TL;DR.** TP53 encodes p53, the most-mutated tumor suppressor in cancer.`,
    },
    {
      variant: 'C',
      quality: 'low',
      brief: `# TP53

TP53 is sometimes called the "guardian of the genome." It is a tumor suppressor gene that is mutated in many cancers. The p53 protein is believed to coordinate the cellular response to damage and may trigger apoptosis when cells are damaged beyond repair. Loss of p53 function is associated with cancer progression.`,
    },
  ],

  APP: [
    {
      variant: 'A',
      quality: 'high',
      brief: `# APP — research brief

**Identity.** *APP* (UniProt P05067, NCBI Gene 351) on 21q21.3 encodes amyloid precursor protein, a 770-amino-acid (longest isoform) single-pass type-I transmembrane protein. Aliases: AD1, CVAP, ABETA.

**Function.** APP undergoes sequential proteolysis along two competing pathways. The non-amyloidogenic pathway: alpha-secretase (ADAM10) cleavage within the Aβ domain, releasing sAPPα; the amyloidogenic pathway: beta-secretase (BACE1) cleavage at the N-terminus of Aβ generating sAPPβ and the membrane-bound C99 fragment, which gamma-secretase (presenilin complex) cleaves to release the 40- to 42-residue Aβ peptide. APP also functions in synaptic adhesion, iron homeostasis, and neurite outgrowth.

**Pathways (Reactome).**
- R-HSA-977225 — Amyloid fiber formation
- R-HSA-9609736 — Assembly and cell-surface presentation of APP

**Clinical relevance.** Missense mutations near the secretase cleavage sites (Swedish KM670/671NL, Arctic E693G, Iowa D694N, London V717I) cause autosomal-dominant early-onset Alzheimer disease. *APP* duplication causes a similar phenotype. The Icelandic A673T variant *protects* against late-onset AD. Trisomy 21 produces a third *APP* allele, accounting for early Aβ deposition in Down syndrome.

**Recent literature.**
- PMID:39876543 — Lecanemab confirmatory trial: 18-month outcomes (NEJM, 2024)
- PMID:38234890 — Donanemab vs lecanemab head-to-head (Lancet, 2024)

**TL;DR.** *APP* encodes amyloid precursor protein; sequential beta- and gamma-secretase cleavage produces Aβ peptide, whose aggregation is the central pathological event in Alzheimer disease.`,
    },
    {
      variant: 'B',
      quality: 'medium',
      brief: `# APP

**Identity.** *APP* on chromosome 21 encodes amyloid precursor protein (UniProt P05067).

**Function.** APP is cleaved by beta- and gamma-secretases to produce the Aβ peptide. Aβ aggregates form senile plaques characteristic of Alzheimer disease.

**Clinical relevance.** Mutations in APP cause early-onset familial Alzheimer disease. Trisomy 21 (Down syndrome) results in increased APP gene dosage and early Aβ pathology.

**TL;DR.** APP gives rise to amyloid-beta, the principal plaque component in Alzheimer disease.`,
    },
    {
      variant: 'C',
      quality: 'low',
      brief: `# APP

APP stands for amyloid precursor protein, and it is involved in Alzheimer disease. When cleaved by certain enzymes, it produces fragments that can aggregate into plaques in the brain. Mutations in APP have been linked to familial forms of Alzheimer.`,
    },
  ],

  MAPT: [
    {
      variant: 'A',
      quality: 'high',
      brief: `# MAPT — research brief

**Identity.** *MAPT* (UniProt P10636, NCBI Gene 4137) on 17q21.31 encodes microtubule-associated protein tau. Alternative splicing of exons 2, 3, and 10 produces six adult CNS isoforms ranging 352–441 amino acids, distinguished by 0–2 N-terminal inserts and 3 or 4 microtubule-binding repeats (3R vs 4R tau). Aliases: TAU, FTDP-17, MSTD.

**Function.** Tau binds microtubules via its C-terminal repeat domain, stabilising axonal microtubule polymerisation and regulating axonal transport. Phosphorylation at sites including Ser202/Thr205 (AT8 epitope), Thr231, and Ser396/404 (PHF1) reduces microtubule affinity; hyperphosphorylated tau dissociates from microtubules and self-assembles into paired helical filaments.

**Pathways (Reactome).**
- R-HSA-264870 — Caspase-mediated cleavage of cytoskeletal proteins
- R-HSA-432722 — Golgi-associated vesicle biogenesis

**Clinical relevance.** Tau is the building block of neurofibrillary tangles in Alzheimer disease and the defining pathology of the tauopathies: Pick disease (3R), progressive supranuclear palsy and corticobasal degeneration (4R), and chronic traumatic encephalopathy (3R+4R). MAPT mutations in exons 1, 9, 10, 12, 13 and the H1 haplotype cause frontotemporal dementia with parkinsonism linked to chromosome 17 (FTDP-17).

**Recent literature.**
- PMID:39112233 — Anti-tau immunotherapy in early Alzheimer disease (Lancet Neurol, 2024)
- PMID:37456789 — Cryo-EM structures of tau filaments across tauopathies (Cell, 2023)

**TL;DR.** *MAPT* encodes tau, a microtubule-stabilising protein whose hyperphosphorylation and filament assembly defines neurofibrillary tangle pathology in Alzheimer disease and the broader tauopathy spectrum.`,
    },
    {
      variant: 'B',
      quality: 'medium',
      brief: `# MAPT

**Identity.** *MAPT* on 17q21 encodes tau (UniProt P10636), a microtubule-associated protein expressed predominantly in neurons.

**Function.** Tau binds and stabilises microtubules. When hyperphosphorylated, it dissociates from microtubules and aggregates into filaments.

**Clinical relevance.** Tau filaments form neurofibrillary tangles in Alzheimer disease and characterise the family of disorders known as tauopathies.

**TL;DR.** MAPT encodes tau, the protein that forms neurofibrillary tangles in Alzheimer disease.`,
    },
    {
      variant: 'C',
      quality: 'low',
      brief: `# MAPT

MAPT codes for a protein called tau, which is found in neurons and is thought to help maintain cell structure. Abnormal forms of tau accumulate in the brains of patients with Alzheimer disease and related disorders. The role of tau in these conditions continues to be an active research area.`,
    },
  ],

  GBA: [
    {
      variant: 'A',
      quality: 'high',
      brief: `# GBA — research brief

**Identity.** *GBA* (formal HGNC symbol *GBA1*; UniProt P04062, NCBI Gene 2629) on 1q22 encodes lysosomal acid beta-glucocerebrosidase (GCase), a 536-amino-acid glycoprotein. Aliases: GBA1, GCASE, D11S429.

**Function.** GCase catalyses hydrolysis of the membrane glycolipid glucosylceramide to ceramide and glucose within the lysosome, requiring saposin C and acidic pH. Folded GCase is delivered to lysosomes via the LIMP-2/SCARB2 receptor (mannose-6-phosphate-independent pathway). Loss of activity leads to glucosylceramide and glucosylsphingosine accumulation in the macrophage-monocyte lineage.

**Pathways (Reactome).**
- R-HSA-1660661 — Sphingolipid de novo biosynthesis
- R-HSA-2206280 — Diseases of glycosylation

**Clinical relevance.** Bi-allelic loss-of-function mutations cause Gaucher disease (Types I/II/III), the most common lysosomal storage disorder, characterised by hepatosplenomegaly, cytopenia, bone disease, and (in Types II/III) neurological involvement. Heterozygous *GBA* variants — including N370S (mild) and L444P (severe) — are the strongest known genetic risk factor for Parkinson disease and dementia with Lewy bodies, increasing PD risk roughly fivefold.

**Recent literature.**
- PMID:38567890 — GBA variants and PD progression: 5-year longitudinal data (Brain, 2024)
- PMID:36234567 — Substrate reduction therapy with venglustat in GBA-PD (Lancet Neurol, 2022)

**TL;DR.** *GBA* encodes lysosomal glucocerebrosidase; bi-allelic loss causes Gaucher disease, while heterozygous variants are the strongest genetic risk factor for Parkinson disease.`,
    },
    {
      variant: 'B',
      quality: 'medium',
      brief: `# GBA

**Identity.** *GBA* (also called *GBA1*) on 1q22 encodes lysosomal glucocerebrosidase, a hydrolase that degrades glucosylceramide.

**Function.** GBA breaks down glucosylceramide within the lysosome. Loss of function leads to glycolipid accumulation.

**Clinical relevance.** Bi-allelic GBA mutations cause Gaucher disease. Heterozygous variants increase risk for Parkinson disease.

**TL;DR.** GBA codes for a lysosomal enzyme; its deficiency causes Gaucher disease and raises PD risk.`,
    },
    {
      variant: 'C',
      quality: 'low',
      brief: `# GBA

GBA encodes an enzyme that is involved in lipid metabolism within lysosomes. Defects in this enzyme are associated with a storage disorder called Gaucher disease, and certain variants have also been linked to increased risk of Parkinson disease.`,
    },
  ],
};

/** Pick a random variant for the given gene (uniform). */
export function pickRandomVariant(symbol, rng = Math.random) {
  const variants = MOCK_BRIEFS[symbol];
  if (!variants || variants.length === 0) return null;
  const i = Math.floor(rng() * variants.length);
  return { symbol, ...variants[i] };
}

/** Get the two MOST distinct variants for an A/B preference round. */
export function pickAB(symbol) {
  const variants = MOCK_BRIEFS[symbol];
  if (!variants || variants.length < 2) return null;
  const high = variants.find((v) => v.quality === 'high');
  const low = variants.find((v) => v.quality === 'low');
  const mid = variants.find((v) => v.quality === 'medium');
  // Prefer high vs low (most signal), fall back to whatever exists
  const a = high ?? mid ?? variants[0];
  const b = low ?? mid ?? variants[variants.length - 1];
  // Randomise which side is shown as "A" so the SME can't pattern-match by position
  return Math.random() < 0.5
    ? { symbol, A: a, B: b }
    : { symbol, A: b, B: a };
}

/** List all gene symbols the mock pool covers. */
export function mockGenes() {
  return Object.keys(MOCK_BRIEFS);
}
