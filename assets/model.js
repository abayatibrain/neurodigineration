// neurodigineration training mode — BioscopeModel
//
// The "model" the SME trains is a JSON object held in localStorage.
// It has no neural weights of its own; instead, it parametrises every
// brief-generation request through three knobs that the learning loop
// updates from preference data:
//
//   1. systemPrompt    — instructions handed to Claude (or the mock template)
//   2. fewShotExamples — high-rated past briefs, included as in-context examples
//   3. avoidPatterns   — concrete instructions distilled from low-rated briefs
//
// The fourth knob, rubricWeights, biases how the overall rating is computed
// (and surfaces in the metrics dashboard) so the SME sees which dimensions
// they've effectively prioritised.
//
// Versioning: the model bumps a semver-ish minor whenever the learning loop
// fires. Every bump is logged in versionHistory with the change reason and
// the diff. This is the artifact the SME exports and (eventually) hands to
// the GUI-2 end-user tool.
//
// Persistence: BioscopeModel reads/writes a single localStorage key
// (default: "nd-train-v1"). import()/export() round-trip the same JSON
// shape so an SME can move state between machines or share with a teammate.

const STORAGE_KEY = 'nd-train-v1';
const MAX_FEW_SHOT = 5;
const MAX_AVOID = 8;
const LEARNING_LOOP_EVERY = 3; // fire after every N new ratings

const DEFAULT_SYSTEM_PROMPT = `You are neurodigineration, a research-grade cell-biology brief generator.

For each gene the user names, you produce a single markdown brief with these sections, in order:

1. **Identity** — gene symbol (italic), protein product, UniProt accession, length, chromosomal locus, aliases.
2. **Function** — what the protein does, drawn from UniProt SwissProt FUNCTION annotation. Keep it dense; cite the accession.
3. **Pathways** — Reactome stable IDs and pathway names that map to this protein's UniProt accession.
4. **Clinical relevance** — known disease associations, mode of inheritance where relevant, key variants.
5. **Recent literature** — 3–5 PubMed citations (PMID, title, journal, year), sorted by date.
6. **TL;DR** — two sentences max; identity + main biological role + leading disease association.

Hard rules:
- Cite every identifier verbatim (UniProt accessions, Reactome stable IDs, PMIDs).
- Italicise gene symbols, do not italicise protein names.
- Never fabricate identifiers — if a fact is not supplied in the input data, say so.
- Avoid hedging language ("may", "is thought to") unless the underlying source itself hedges.
- Keep the brief under 350 words.`;

const DEFAULT_RUBRIC_WEIGHTS = {
  factuality: 1,
  completeness: 1,
  citation: 1,
  clarity: 1,
};

const DEFAULT_GENE_PANEL = [
  // ===== Parkinson disease — original + recessive juvenile + risk modifiers =====
  {
    symbol: 'SNCA',
    aliases: ['NACP', 'PARK1', 'PARK4'],
    notes: 'Parkinson disease — alpha-synuclein, synaptic vesicle, amyloid fibers.',
    expectTokens: ['alpha-synuclein', 'P37840', 'parkinson', 'synaptic'],
  },
  {
    symbol: 'LRRK2',
    aliases: ['PARK8', 'DARDARIN'],
    notes: 'Parkinson disease — leucine-rich repeat kinase, Rab phosphorylation.',
    expectTokens: ['leucine-rich repeat', 'Q5S007', 'parkinson', 'kinase'],
  },
  {
    symbol: 'GBA',
    aliases: ['GBA1', 'GCASE'],
    notes: 'Gaucher disease & PD risk — lysosomal glucocerebrosidase.',
    expectTokens: ['glucocerebrosidase', 'P04062', 'gaucher', 'lysosom'],
  },
  {
    symbol: 'PRKN',
    aliases: ['PARK2', 'PARKIN'],
    notes: 'Autosomal-recessive juvenile PD — E3 ubiquitin ligase, downstream of PINK1 in mitophagy.',
    expectTokens: ['parkin', 'O60260', 'mitophagy', 'ubiquitin', 'parkinson'],
  },
  {
    symbol: 'PINK1',
    aliases: ['PARK6'],
    notes: 'Recessive PD — PTEN-induced kinase 1, mitochondrial-membrane sensor that recruits PRKN to depolarised mitochondria.',
    expectTokens: ['PINK1', 'Q9BXM7', 'mitophagy', 'kinase', 'parkinson'],
  },
  {
    symbol: 'PARK7',
    aliases: ['DJ-1', 'DJ1'],
    notes: 'Recessive PD — oxidative-stress sensor, redox-regulated chaperone, glyoxalase.',
    expectTokens: ['DJ-1', 'Q99497', 'oxidative', 'parkinson', 'chaperone'],
  },
  {
    symbol: 'VPS35',
    aliases: ['PARK17'],
    notes: 'Autosomal-dominant late-onset PD — retromer complex; D620N is the recurrent pathogenic variant.',
    expectTokens: ['retromer', 'Q96QK1', 'vps35', 'parkinson', 'endosom'],
  },
  {
    symbol: 'ATP13A2',
    aliases: ['PARK9', 'CLN12'],
    notes: 'Kufor-Rakeb syndrome & atypical PD — lysosomal P-type ATPase; polyamine transport; PD ↔ lysosomal-storage crossover.',
    expectTokens: ['ATP13A2', 'Q9NQ11', 'lysosom', 'parkinson', 'kufor'],
  },

  // ===== Alzheimer disease — familial cause + late-onset risk =====
  {
    symbol: 'APP',
    aliases: ['AD1', 'CVAP'],
    notes: 'Alzheimer disease — amyloid precursor, Aβ generation.',
    expectTokens: ['amyloid', 'P05067', 'alzheimer', 'beta'],
  },
  {
    symbol: 'MAPT',
    aliases: ['TAU', 'FTDP-17'],
    notes: 'Tauopathies — microtubule-associated protein tau, neurofibrillary tangles.',
    expectTokens: ['tau', 'P10636', 'microtubule', 'alzheimer'],
  },
  {
    symbol: 'APOE',
    aliases: ['AD2', 'LPG'],
    notes: 'Late-onset AD — apolipoprotein E; the ε4 allele is the strongest common genetic risk factor for AD.',
    expectTokens: ['apolipoprotein', 'P02649', 'alzheimer', 'epsilon', 'lipid'],
  },
  {
    symbol: 'PSEN1',
    aliases: ['AD3', 'PS1'],
    notes: 'Early-onset familial AD — catalytic subunit of γ-secretase; >300 pathogenic missense mutations.',
    expectTokens: ['presenilin', 'P49768', 'gamma-secretase', 'alzheimer', 'familial'],
  },
  {
    symbol: 'PSEN2',
    aliases: ['AD4', 'PS2'],
    notes: 'Rarer early-onset familial AD — γ-secretase catalytic subunit (paralog of PSEN1).',
    expectTokens: ['presenilin', 'P49810', 'gamma-secretase', 'alzheimer'],
  },
  {
    symbol: 'TREM2',
    aliases: ['PLOSL2'],
    notes: 'Late-onset AD risk — microglial receptor; R47H increases AD risk ~3-fold; loss causes Nasu-Hakola disease.',
    expectTokens: ['TREM2', 'Q9NZC2', 'microglia', 'alzheimer', 'R47H'],
  },
  {
    symbol: 'BIN1',
    aliases: ['AMPHL', 'CNM2'],
    notes: 'Late-onset AD — second-strongest LOAD GWAS hit after APOE; amphiphysin family; endocytosis / membrane curvature.',
    expectTokens: ['BIN1', 'O00499', 'alzheimer', 'endocyt', 'amphiphysin'],
  },

  // ===== ALS / FTD =====
  {
    symbol: 'C9orf72',
    aliases: ['ALSFTD', 'C9ORF72'],
    notes: 'ALS / FTD — GGGGCC hexanucleotide repeat expansion; the most common monogenic ALS and FTD cause.',
    expectTokens: ['C9orf72', 'Q96LT7', 'ALS', 'FTD', 'expansion'],
  },
  {
    symbol: 'SOD1',
    aliases: ['ALS1', 'IPOA'],
    notes: 'Familial ALS — Cu/Zn superoxide dismutase; the original ALS gene; tofersen is approved for SOD1-ALS.',
    expectTokens: ['superoxide', 'P00441', 'ALS', 'motor neuron', 'tofersen'],
  },
  {
    symbol: 'TARDBP',
    aliases: ['TDP-43', 'ALS10'],
    notes: 'ALS / FTD — TDP-43; defining proteinopathy of >90% of sporadic ALS and most FTD-TDP cases.',
    expectTokens: ['TDP-43', 'Q13148', 'ALS', 'FTD', 'RNA-binding'],
  },
  {
    symbol: 'FUS',
    aliases: ['ALS6', 'TLS'],
    notes: 'Juvenile / adult ALS — fused-in-sarcoma; RNA-binding protein; phase-separation poster child.',
    expectTokens: ['FUS', 'P35637', 'ALS', 'RNA-binding', 'phase separation'],
  },
  {
    symbol: 'GRN',
    aliases: ['PGRN', 'GP88', 'FTD'],
    notes: 'Frontotemporal dementia — progranulin haploinsufficiency causes FTD-TDP; lysosomal homeostasis.',
    expectTokens: ['progranulin', 'P28799', 'FTD', 'TDP-43', 'haploinsufficiency'],
  },

  // ===== Huntington & prion =====
  {
    symbol: 'HTT',
    aliases: ['HD', 'IT15'],
    notes: 'Huntington disease — huntingtin; CAG repeat expansion; the canonical polyQ disease.',
    expectTokens: ['huntingtin', 'P42858', 'huntington', 'CAG', 'polyQ'],
  },
  {
    symbol: 'PRNP',
    aliases: ['PRP', 'CJD', 'GSS'],
    notes: 'Prion disease — prion protein (PrP); CJD, GSS, FFI; the entire prion paradigm.',
    expectTokens: ['prion', 'P04156', 'CJD', 'PrP', 'misfolding'],
  },

  // ===== Spinocerebellar ataxias / polyQ =====
  {
    symbol: 'ATXN2',
    aliases: ['SCA2', 'ATX2'],
    notes: 'SCA2 — polyQ cerebellar ataxia; intermediate-length expansions are an ALS risk factor.',
    expectTokens: ['ataxin-2', 'Q99700', 'SCA2', 'ataxia', 'polyQ'],
  },
  {
    symbol: 'ATXN3',
    aliases: ['SCA3', 'MJD'],
    notes: 'SCA3 / Machado-Joseph — most common dominant ataxia worldwide; polyQ deubiquitinase.',
    expectTokens: ['ataxin-3', 'P54252', 'SCA3', 'Machado-Joseph', 'polyQ'],
  },

  // ===== Cancer canon (kept from v0.1 for cross-domain comparison) =====
  {
    symbol: 'TP53',
    aliases: ['P53', 'LFS1', 'TRP53'],
    notes: 'Cancer — tumor suppressor, DNA damage response.',
    expectTokens: ['tumor suppressor', 'P04637', 'apoptosis', 'dna damage'],
  },

  // ===== Shared proteostasis / mitochondrial / autophagy machinery =====
  {
    symbol: 'TFEB',
    aliases: ['BHLHE35'],
    notes: 'Master transcriptional regulator of autophagy + lysosomal biogenesis (CLEAR network); therapeutic target across PD/AD/lysosomal storage.',
    expectTokens: ['TFEB', 'P19484', 'lysosom', 'autophagy', 'CLEAR'],
  },
  {
    symbol: 'TOMM20',
    aliases: ['TOM20'],
    notes: 'Mitochondrial outer-membrane translocase receptor — substrate of PRKN-mediated ubiquitination during mitophagy.',
    expectTokens: ['TOMM20', 'Q15388', 'mitochondri', 'outer membrane', 'mitophagy'],
  },
  {
    symbol: 'MAP1LC3B',
    aliases: ['LC3', 'LC3B', 'ATG8F'],
    notes: 'Autophagosome marker — Atg8 family; lipidated form (LC3-II) decorates autophagosome membranes and binds autophagy adaptors.',
    expectTokens: ['LC3', 'Q9GZQ8', 'autophagy', 'autophagosome', 'Atg8'],
  },

  // ===== Group A — Mitophagy effectors & opponents =====
  {
    symbol: 'USP30',
    aliases: [],
    notes: 'Mitochondrial outer-membrane deubiquitinase; opposes PRKN-mediated ubiquitination; active small-molecule drug target for PD.',
    expectTokens: ['USP30', 'Q70CQ3', 'deubiquitinase', 'mitochondri', 'mitophagy'],
  },
  {
    symbol: 'RHOT1',
    aliases: ['MIRO1', 'ARHT1'],
    notes: 'Mitochondrial Rho GTPase; PRKN substrate; arrests mitochondrial transport on damaged organelles before mitophagy.',
    expectTokens: ['Miro1', 'Q8IXI2', 'mitochondri', 'transport', 'parkin'],
  },
  {
    symbol: 'MFN2',
    aliases: ['CMT2A2', 'CPRP1'],
    notes: 'Mitofusin 2; PRKN substrate; mitochondrial fusion; mutations cause Charcot-Marie-Tooth type 2A.',
    expectTokens: ['mitofusin', 'O95140', 'fusion', 'CMT2A', 'mitochondri'],
  },
  {
    symbol: 'MFN1',
    aliases: [],
    notes: 'Mitofusin 1; paralog of MFN2; required for outer-mitochondrial-membrane fusion.',
    expectTokens: ['mitofusin', 'Q8IWA4', 'fusion', 'mitochondri'],
  },
  {
    symbol: 'DNM1L',
    aliases: ['DRP1', 'DLP1'],
    notes: 'Dynamin-related protein 1; mitochondrial and peroxisomal fission; encephalopathy when mutated.',
    expectTokens: ['DRP1', 'O00429', 'fission', 'mitochondri', 'dynamin'],
  },
  {
    symbol: 'BNIP3L',
    aliases: ['NIX'],
    notes: 'Receptor-mediated (ubiquitin-independent) mitophagy via direct LC3 binding; developmental and erythroid mitochondrial clearance.',
    expectTokens: ['NIX', 'O60238', 'mitophagy', 'LC3', 'receptor'],
  },
  {
    symbol: 'FUNDC1',
    aliases: [],
    notes: 'Hypoxia-induced mitophagy receptor; binds LC3 via its LIR motif; regulated by ULK1-mediated phosphorylation.',
    expectTokens: ['FUNDC1', 'Q8IVP5', 'mitophagy', 'hypoxia', 'LC3'],
  },
  {
    symbol: 'FBXO7',
    aliases: ['PARK15'],
    notes: 'Early-onset PD; F-box-only 7; PRKN cofactor for mitophagy; SCF E3 ligase substrate adaptor.',
    expectTokens: ['FBXO7', 'Q9Y3I1', 'PARK15', 'parkin', 'mitophagy'],
  },
  {
    symbol: 'CHCHD2',
    aliases: ['PARK22'],
    notes: 'Autosomal-dominant late-onset PD; coiled-coil-helix mitochondrial intermembrane-space protein; respiratory chain.',
    expectTokens: ['CHCHD2', 'Q9Y6H1', 'PARK22', 'mitochondri', 'intermembrane'],
  },
  {
    symbol: 'HTRA2',
    aliases: ['PARK13', 'OMI'],
    notes: 'Mitochondrial serine protease; candidate PD gene; substrate of PINK1; released into cytosol triggers apoptosis.',
    expectTokens: ['HTRA2', 'O43464', 'PARK13', 'protease', 'mitochondri'],
  },

  // ===== Group B — Autophagy core & selective autophagy adaptors =====
  {
    symbol: 'SQSTM1',
    aliases: ['p62', 'PDB3'],
    notes: 'Canonical autophagy adaptor (p62); mutations cause ALS / FTD / Paget disease of bone; binds ubiquitinated cargo and LC3.',
    expectTokens: ['p62', 'Q13501', 'autophagy', 'ubiquitin', 'ALS'],
  },
  {
    symbol: 'OPTN',
    aliases: ['NRP', 'FIP2', 'GLC1E'],
    notes: 'Optineurin; selective autophagy receptor; ALS gene; primary open-angle glaucoma; phosphorylated by TBK1.',
    expectTokens: ['optineurin', 'Q96CV9', 'ALS', 'autophagy', 'TBK1'],
  },
  {
    symbol: 'TBK1',
    aliases: ['NAK'],
    notes: 'TANK-binding kinase 1; ALS / FTD gene; phosphorylates OPTN, p62, SMCR8; innate-immunity kinase.',
    expectTokens: ['TBK1', 'Q9UHD2', 'kinase', 'ALS', 'FTD'],
  },
  {
    symbol: 'NBR1',
    aliases: [],
    notes: 'Neighbor of BRCA1 gene 1; autophagy receptor; paralog of p62; ubiquitin-binding via UBA domain.',
    expectTokens: ['NBR1', 'Q14596', 'autophagy', 'ubiquitin', 'receptor'],
  },
  {
    symbol: 'CALCOCO2',
    aliases: ['NDP52'],
    notes: 'Autophagy receptor NDP52; xenophagy (Salmonella) and mitophagy; binds LC3 via CLIR motif.',
    expectTokens: ['NDP52', 'Q13137', 'autophagy', 'xenophagy', 'mitophagy'],
  },
  {
    symbol: 'BECN1',
    aliases: ['ATG6', 'VPS30'],
    notes: 'Beclin-1; autophagy initiator within the class-III PI3K complex; reduced expression observed in AD brains.',
    expectTokens: ['Beclin', 'Q14457', 'autophagy', 'PI3K', 'alzheimer'],
  },
  {
    symbol: 'ATG7',
    aliases: [],
    notes: 'E1-like activating enzyme for the ATG12 and LC3 conjugation systems; autophagy is dead without it.',
    expectTokens: ['ATG7', 'O95352', 'autophagy', 'LC3', 'conjugation'],
  },
  {
    symbol: 'ATG5',
    aliases: [],
    notes: 'ATG12–ATG5 conjugate; required for LC3-II generation; essential for autophagosome formation.',
    expectTokens: ['ATG5', 'Q9H1Y0', 'autophagy', 'conjugation', 'autophagosome'],
  },
  {
    symbol: 'ULK1',
    aliases: ['ATG1'],
    notes: 'Unc-51-like kinase 1; autophagy initiator; mTORC1 substrate; phosphorylates ATG13, FIP200, BECN1.',
    expectTokens: ['ULK1', 'O75385', 'kinase', 'autophagy', 'mTOR'],
  },
  {
    symbol: 'WDR45',
    aliases: ['WIPI4', 'BPAN'],
    notes: 'Beta-propeller protein autophagy-linked; X-linked BPAN — childhood neurodegeneration with brain iron accumulation.',
    expectTokens: ['WDR45', 'Q9Y484', 'BPAN', 'iron', 'autophagy'],
  },

  // ===== Group C — APP processing: secretases & Aβ clearance =====
  {
    symbol: 'BACE1',
    aliases: ['BACE', 'MEMAPSIN-2'],
    notes: 'β-site APP cleaving enzyme 1; rate-limiting step in Aβ generation; major AD drug target.',
    expectTokens: ['BACE1', 'P56817', 'secretase', 'amyloid', 'alzheimer'],
  },
  {
    symbol: 'ADAM10',
    aliases: ['CD156C', 'MADM'],
    notes: 'α-secretase; non-amyloidogenic APP cleavage; cleaves Notch; loss-of-function variants raise AD risk.',
    expectTokens: ['ADAM10', 'O14672', 'secretase', 'amyloid', 'alzheimer'],
  },
  {
    symbol: 'NCSTN',
    aliases: ['Nicastrin'],
    notes: 'γ-secretase substrate-recognition subunit; required for complex assembly; hidradenitis suppurativa when mutated.',
    expectTokens: ['nicastrin', 'Q92542', 'gamma-secretase', 'amyloid'],
  },
  {
    symbol: 'APH1A',
    aliases: ['APH-1A'],
    notes: 'γ-secretase subunit; required for complex stability and presenilin maturation.',
    expectTokens: ['APH1A', 'Q96BI3', 'gamma-secretase', 'amyloid'],
  },
  {
    symbol: 'PSENEN',
    aliases: ['PEN-2', 'PEN2'],
    notes: 'γ-secretase regulatory subunit (PEN-2); required for PSEN1 endoproteolysis and complex activation.',
    expectTokens: ['PEN-2', 'Q9NZ42', 'gamma-secretase', 'presenilin'],
  },
  {
    symbol: 'IDE',
    aliases: ['INSULYSIN'],
    notes: 'Insulin-degrading enzyme; major proteolytic Aβ-clearance route; links AD risk to insulin resistance.',
    expectTokens: ['IDE', 'P14735', 'amyloid', 'alzheimer', 'insulin'],
  },
  {
    symbol: 'MME',
    aliases: ['NEP', 'NEPRILYSIN', 'CD10'],
    notes: 'Neprilysin; zinc metallopeptidase; major Aβ-degrading protease; declines with normal aging.',
    expectTokens: ['neprilysin', 'P08473', 'amyloid', 'alzheimer', 'protease'],
  },

  // ===== Group D — Tau-modifying kinases & chaperones =====
  {
    symbol: 'GSK3B',
    aliases: ['GSK-3β'],
    notes: 'Glycogen synthase kinase-3β; dominant tau kinase in vivo; inhibited by lithium; AD therapeutic target.',
    expectTokens: ['GSK3B', 'P49841', 'tau', 'kinase', 'alzheimer'],
  },
  {
    symbol: 'CDK5',
    aliases: [],
    notes: 'Cyclin-dependent kinase-5; activated by p35/p25 (cleaved by calpain); tau hyperphosphorylation in AD.',
    expectTokens: ['CDK5', 'Q00535', 'tau', 'kinase', 'alzheimer'],
  },
  {
    symbol: 'PIN1',
    aliases: ['DOD'],
    notes: 'Peptidyl-prolyl cis-trans isomerase NIMA-interacting 1; tau conformation regulator; expression decreased in AD brain.',
    expectTokens: ['PIN1', 'Q13526', 'tau', 'isomerase', 'alzheimer'],
  },
  {
    symbol: 'MARK2',
    aliases: ['PAR-1B', 'EMK1'],
    notes: 'MAP/microtubule affinity-regulating kinase 2; phosphorylates tau Ser262 in the KXGS motif; destabilises microtubule binding.',
    expectTokens: ['MARK2', 'Q7KZI7', 'tau', 'kinase', 'microtubule'],
  },
  {
    symbol: 'BAG3',
    aliases: ['CAIR-1', 'BIS'],
    notes: 'Hsp70 cochaperone; tau aggregate clearance via chaperone-assisted selective autophagy; myofibrillar myopathy.',
    expectTokens: ['BAG3', 'O95817', 'chaperone', 'tau', 'autophagy'],
  },

  // ===== Group E — Lysosomal storage & sphingolipid metabolism =====
  {
    symbol: 'SCARB2',
    aliases: ['LIMP-2', 'CD36L2'],
    notes: 'Lysosomal integral membrane protein 2; mannose-6-phosphate-independent receptor that delivers GBA to lysosomes.',
    expectTokens: ['LIMP-2', 'Q14108', 'lysosom', 'GBA', 'gaucher'],
  },
  {
    symbol: 'SMPD1',
    aliases: ['ASM', 'NPDA', 'NPDB'],
    notes: 'Acid sphingomyelinase; Niemann-Pick disease types A and B; sphingomyelin → ceramide + phosphocholine.',
    expectTokens: ['sphingomyelinase', 'P17405', 'Niemann-Pick', 'lysosom'],
  },
  {
    symbol: 'NPC1',
    aliases: ['NPC'],
    notes: 'Niemann-Pick disease type C1; cholesterol egress from late endosomes/lysosomes; PD risk modifier.',
    expectTokens: ['NPC1', 'O15118', 'Niemann-Pick', 'cholesterol', 'lysosom'],
  },
  {
    symbol: 'NPC2',
    aliases: ['HE1'],
    notes: 'Niemann-Pick disease type C2; soluble cholesterol-binding partner of NPC1.',
    expectTokens: ['NPC2', 'P61916', 'Niemann-Pick', 'cholesterol', 'lysosom'],
  },
  {
    symbol: 'HEXA',
    aliases: ['TSD'],
    notes: 'β-hexosaminidase α-subunit; Tay-Sachs disease; GM2 ganglioside hydrolysis.',
    expectTokens: ['HEXA', 'P06865', 'Tay-Sachs', 'lysosom', 'GM2'],
  },
  {
    symbol: 'GALC',
    aliases: ['GCRB'],
    notes: 'Galactosylceramidase; Krabbe disease (globoid cell leukodystrophy); galactosylceramide / psychosine catabolism.',
    expectTokens: ['galactosylceramidase', 'P54803', 'Krabbe', 'lysosom', 'leukodystrophy'],
  },
  {
    symbol: 'GAA',
    aliases: ['LYAG'],
    notes: 'Acid α-glucosidase; Pompe disease; lysosomal glycogen breakdown; first lysosomal storage disorder with enzyme replacement.',
    expectTokens: ['GAA', 'P10253', 'Pompe', 'lysosom', 'glycogen'],
  },
  {
    symbol: 'ASAH1',
    aliases: ['AC', 'PHP', 'PHP32'],
    notes: 'Acid ceramidase; Farber disease & SMA with progressive myoclonic epilepsy; ceramide → sphingosine + fatty acid.',
    expectTokens: ['ASAH1', 'Q13510', 'Farber', 'lysosom', 'ceramide'],
  },

  // ===== Group F — LRRK2 substrates & retromer =====
  {
    symbol: 'RAB8A',
    aliases: ['MEL'],
    notes: 'LRRK2 phospho-substrate at Switch-II Thr72; required for primary ciliogenesis in dopamine-receptive neurons.',
    expectTokens: ['RAB8A', 'P61006', 'LRRK2', 'cilia', 'parkinson'],
  },
  {
    symbol: 'RAB10',
    aliases: [],
    notes: 'LRRK2 phospho-substrate at Thr73; phospho-Rab10 is the leading peripheral biomarker of LRRK2 activity in vivo.',
    expectTokens: ['RAB10', 'P61026', 'LRRK2', 'biomarker', 'parkinson'],
  },
  {
    symbol: 'RAB29',
    aliases: ['PARK16', 'RAB7L1'],
    notes: 'PARK16 locus; LRRK2 activator at the trans-Golgi network; small GTPase.',
    expectTokens: ['RAB29', 'O14966', 'LRRK2', 'PARK16', 'Golgi'],
  },
  {
    symbol: 'VPS13C',
    aliases: ['PARK23'],
    notes: 'Late-onset autosomal-recessive PD; lipid transfer at mitochondria–ER contact sites; loss impairs mitochondrial quality control.',
    expectTokens: ['VPS13C', 'Q709C8', 'PARK23', 'parkinson', 'mitochondri'],
  },
  {
    symbol: 'VPS26A',
    aliases: ['PEP8A'],
    notes: 'Retromer cargo-recognition subunit; required for VPS35 function in endosome-to-Golgi retrieval.',
    expectTokens: ['VPS26A', 'O75436', 'retromer', 'endosom'],
  },
  {
    symbol: 'VPS29',
    aliases: [],
    notes: 'Retromer cargo-recognition subunit; trimerises with VPS35 and VPS26 to form the core retromer.',
    expectTokens: ['VPS29', 'Q9UBQ0', 'retromer', 'endosom'],
  },
  {
    symbol: 'SNX27',
    aliases: [],
    notes: 'Sorting nexin 27; PDZ-domain retromer cargo adaptor; downregulated in Down syndrome — proposed AD contributor.',
    expectTokens: ['SNX27', 'Q96L92', 'retromer', 'endosom', 'alzheimer'],
  },

  // ===== Group G — ALS/FTD RNA-binding proteins & multisystem proteinopathy =====
  {
    symbol: 'HNRNPA1',
    aliases: [],
    notes: 'Heterogeneous nuclear ribonucleoprotein A1; multisystem proteinopathy type 1 (ALS + IBM + FTD + Paget); prion-like LCD.',
    expectTokens: ['hnRNPA1', 'P09651', 'ALS', 'RNA-binding', 'multisystem'],
  },
  {
    symbol: 'HNRNPA2B1',
    aliases: ['HNRPA2B1'],
    notes: 'hnRNP A2/B1; multisystem proteinopathy type 2; prion-like low-complexity domain; same biology as HNRNPA1.',
    expectTokens: ['hnRNPA2B1', 'P22626', 'ALS', 'RNA-binding', 'multisystem'],
  },
  {
    symbol: 'MATR3',
    aliases: [],
    notes: 'Matrin-3; distal hereditary motor neuropathy / ALS21; nuclear-matrix RNA-binding protein.',
    expectTokens: ['matrin', 'P43243', 'ALS', 'RNA-binding'],
  },
  {
    symbol: 'EWSR1',
    aliases: ['EWS'],
    notes: 'Ewing sarcoma breakpoint region 1; FET family with FUS/TAF15; ALS candidate; sarcoma fusion gene.',
    expectTokens: ['EWSR1', 'Q01844', 'ALS', 'FET', 'RNA-binding'],
  },
  {
    symbol: 'TAF15',
    aliases: [],
    notes: 'TATA-box binding protein-associated factor 15; FET family; ALS candidate; RNA-binding.',
    expectTokens: ['TAF15', 'Q92804', 'ALS', 'FET', 'RNA-binding'],
  },

  // ===== Group H — AD risk loci: microglia & lipoproteins =====
  {
    symbol: 'TYROBP',
    aliases: ['DAP12', 'KARAP'],
    notes: 'TYRO protein tyrosine kinase-binding protein (DAP12); TREM2 ITAM-bearing signalling partner; loss causes Nasu-Hakola disease.',
    expectTokens: ['DAP12', 'O43914', 'TREM2', 'microglia', 'Nasu-Hakola'],
  },
  {
    symbol: 'CLU',
    aliases: ['APOJ', 'CLI'],
    notes: 'Clusterin / apolipoprotein J; late-onset AD GWAS hit; lipid chaperone; binds and clears soluble Aβ.',
    expectTokens: ['clusterin', 'P10909', 'alzheimer', 'APOJ', 'lipid'],
  },
  {
    symbol: 'ABCA7',
    aliases: ['ABCA-SSN'],
    notes: 'ATP-binding cassette transporter A7; LOAD GWAS hit; lipid transport; loss-of-function variants raise AD risk markedly.',
    expectTokens: ['ABCA7', 'Q8IZY2', 'alzheimer', 'lipid', 'transporter'],
  },
  {
    symbol: 'SORL1',
    aliases: ['LR11', 'SORLA'],
    notes: 'Sortilin-related receptor 1; LOAD and EOAD gene; regulates APP intracellular trafficking and Aβ generation.',
    expectTokens: ['SORL1', 'Q92673', 'alzheimer', 'sortilin', 'APP'],
  },
  {
    symbol: 'CD33',
    aliases: ['SIGLEC3'],
    notes: 'Sialic-acid-binding immunoglobulin-like lectin 3; LOAD GWAS hit; microglial inhibitory receptor.',
    expectTokens: ['CD33', 'P20138', 'alzheimer', 'microglia', 'siglec'],
  },
  {
    symbol: 'PLCG2',
    aliases: ['PLC-gamma-2'],
    notes: 'Phospholipase Cγ2; P522R variant is protective for AD; downstream of TREM2 in microglial signalling.',
    expectTokens: ['PLCG2', 'P16885', 'alzheimer', 'microglia', 'TREM2'],
  },

  // ===== Group I — PolyQ family & HD modifiers =====
  {
    symbol: 'ATXN1',
    aliases: ['SCA1'],
    notes: 'Spinocerebellar ataxia type 1; polyQ expansion in ataxin-1.',
    expectTokens: ['ataxin-1', 'P54253', 'SCA1', 'ataxia', 'polyQ'],
  },
  {
    symbol: 'ATXN7',
    aliases: ['SCA7'],
    notes: 'Spinocerebellar ataxia type 7; polyQ expansion in ataxin-7; SAGA transcription complex subunit; retinal degeneration.',
    expectTokens: ['ataxin-7', 'O15265', 'SCA7', 'ataxia', 'polyQ'],
  },
  {
    symbol: 'CACNA1A',
    aliases: ['SCA6', 'EA2', 'FHM1'],
    notes: 'Cav2.1 P/Q-type calcium channel α1A; polyQ expansion causes SCA6; missense causes familial hemiplegic migraine / EA2.',
    expectTokens: ['CACNA1A', 'O00555', 'SCA6', 'calcium channel', 'polyQ'],
  },
  {
    symbol: 'ATN1',
    aliases: ['DRPLA', 'B37'],
    notes: 'Atrophin-1; polyQ expansion causes dentatorubropallidoluysian atrophy (DRPLA).',
    expectTokens: ['atrophin', 'P54259', 'DRPLA', 'polyQ', 'ataxia'],
  },
  {
    symbol: 'TBP',
    aliases: ['SCA17', 'GTF2D'],
    notes: 'TATA-binding protein; polyQ expansion causes SCA17; rare dominant ataxia.',
    expectTokens: ['TBP', 'P20226', 'SCA17', 'polyQ', 'ataxia'],
  },
  {
    symbol: 'AR',
    aliases: ['SBMA', 'KENNEDY', 'HUMARA'],
    notes: 'Androgen receptor; polyQ expansion causes spinal-bulbar muscular atrophy (Kennedy disease).',
    expectTokens: ['androgen', 'P10275', 'Kennedy', 'SBMA', 'polyQ'],
  },
  {
    symbol: 'MSH3',
    aliases: ['MRP1', 'FAP4'],
    notes: 'MutS homolog 3; mismatch-repair component; somatic CAG-tract instability driver; HD age-of-onset modifier.',
    expectTokens: ['MSH3', 'P20585', 'huntington', 'mismatch repair', 'CAG'],
  },
  {
    symbol: 'FAN1',
    aliases: ['MTMR15'],
    notes: 'FANCD2/FANCI-associated nuclease 1; DNA-repair; identified as a HD age-of-onset modifier in GWAS.',
    expectTokens: ['FAN1', 'Q9Y2M0', 'huntington', 'DNA repair', 'modifier'],
  },

  // ===== Lysosomal storage / homeostasis (expanded round) =====
  { symbol: 'LAMP1',  aliases: ['CD107a'], notes: 'Lysosomal membrane glycoprotein 1 — abundant marker; CLEAR-network TFEB target.',
    expectTokens: ['LAMP1', 'P11279', 'lysosom', 'membrane'] },
  { symbol: 'LAMP2',  aliases: ['CD107b', 'LAMP-2A'], notes: 'Lysosomal membrane glycoprotein 2 — Danon disease (X-linked); LAMP2A is the CMA receptor.',
    expectTokens: ['LAMP2', 'P13473', 'Danon', 'chaperone-mediated autophagy', 'lysosom'] },
  { symbol: 'CTSD',   aliases: ['CLN10'], notes: 'Cathepsin D — major lysosomal aspartyl protease; clears α-synuclein and processes APP; CLN10 (congenital NCL).',
    expectTokens: ['cathepsin', 'P07339', 'lysosom', 'NCL', 'alzheimer'] },
  { symbol: 'CTSB',   aliases: [], notes: 'Cathepsin B — lysosomal cysteine protease; cleaves tau to aggregation-prone fragments.',
    expectTokens: ['cathepsin', 'P07858', 'tau', 'lysosom'] },
  { symbol: 'TPP1',   aliases: ['CLN2'], notes: 'Tripeptidyl peptidase 1 — late-infantile neuronal ceroid lipofuscinosis (Batten CLN2); cerliponase alfa ERT approved.',
    expectTokens: ['TPP1', 'O14773', 'CLN2', 'Batten', 'NCL'] },
  { symbol: 'CLN3',   aliases: ['BATTEN'], notes: 'Juvenile NCL (classic Batten disease) — endolysosomal membrane protein involved in autophagic flux.',
    expectTokens: ['CLN3', 'Q13286', 'Batten', 'NCL', 'lysosom'] },
  { symbol: 'IDUA',   aliases: ['MPS1', 'HURLER'], notes: 'α-L-iduronidase — Hurler/Scheie syndromes (mucopolysaccharidosis type I); GAG degradation.',
    expectTokens: ['iduronidase', 'P35475', 'Hurler', 'MPS', 'lysosom'] },
  { symbol: 'CTNS',   aliases: ['CYSTINOSIS'], notes: 'Cystinosin — lysosomal cystine transporter; loss causes cystinosis; TFEB target.',
    expectTokens: ['cystinosin', 'O60931', 'cystinosis', 'lysosom'] },

  // ===== Mitochondrial machinery (expanded round) =====
  { symbol: 'VDAC1',  aliases: ['PORIN'], notes: 'Voltage-dependent anion channel 1 — major OMM porin; abundant PRKN ubiquitination substrate during mitophagy.',
    expectTokens: ['VDAC1', 'P21796', 'mitochondri', 'outer membrane', 'mitophagy'] },
  { symbol: 'OPA1',   aliases: ['NPG', 'NTG'], notes: 'OPA1 GTPase — inner mitochondrial membrane fusion and cristae shaping; loss causes autosomal-dominant optic atrophy.',
    expectTokens: ['OPA1', 'O60313', 'mitochondri', 'fusion', 'optic'] },
  { symbol: 'PARL',   aliases: ['PSARL'], notes: 'PARL rhomboid intramembrane protease — cleaves PINK1 to set its mitophagy threshold.',
    expectTokens: ['PARL', 'Q9H300', 'rhomboid', 'mitochondri', 'PINK1'] },
  { symbol: 'TFAM',   aliases: [], notes: 'Mitochondrial transcription factor A — packages mtDNA and drives transcription; mtDNA copy-number maintenance.',
    expectTokens: ['TFAM', 'Q00059', 'mitochondri', 'mtDNA'] },
  { symbol: 'POLG',   aliases: ['POLGA', 'PEO'], notes: 'Mitochondrial DNA polymerase γ — Alpers syndrome, PEO; mtDNA depletion/deletion disorders.',
    expectTokens: ['POLG', 'P54098', 'mitochondri', 'mtDNA', 'Alpers'] },
  { symbol: 'SPG7',   aliases: ['PARAPLEGIN'], notes: 'Paraplegin — m-AAA inner-membrane protease subunit; hereditary spastic paraplegia type 7; processes OPA1.',
    expectTokens: ['SPG7', 'Q9UQ90', 'paraplegin', 'hereditary spastic', 'mitochondri'] },
  { symbol: 'TOMM70', aliases: ['TOM70'], notes: 'Outer-mitochondrial-membrane import receptor — recognises C-terminal targeting signals; brings PINK1 to the TOM complex.',
    expectTokens: ['TOMM70', 'O94826', 'mitochondri', 'TOM complex', 'import'] },
  { symbol: 'NDUFS1', aliases: ['CI-75kD'], notes: 'Core subunit of mitochondrial Complex I — Leigh syndrome when lost; Complex I deficiency is a defining feature of PD substantia nigra.',
    expectTokens: ['NDUFS1', 'P28331', 'Complex I', 'mitochondri', 'Leigh'] },

  // ===== Round 3 — from Bayati & Chen review =====
  { symbol: 'CD63',   aliases: ['LAMP3', 'TSPAN30'], notes: 'Tetraspanin lysosomal/late-endosomal membrane protein; LAMP family; trafficking and PD-relevant lysosomal biology.',
    expectTokens: ['CD63', 'P08962', 'lysosom', 'tetraspanin', 'parkinson'] },
  { symbol: 'TMEM175', aliases: [], notes: 'Lysosomal K+ channel; loss reduces lysosomal enzymatic activity; GWAS-identified PD risk locus that intersects with GBA biology.',
    expectTokens: ['TMEM175', 'Q9BSA9', 'lysosom', 'parkinson', 'potassium'] },
  { symbol: 'UBE3A', aliases: ['E6-AP', 'AS'], notes: 'E3 ubiquitin ligase; loss-of-function causes Angelman syndrome; central to synaptic protein turnover and UPS.',
    expectTokens: ['UBE3A', 'Q05086', 'Angelman', 'ubiquitin', 'synaptic'] },
  { symbol: 'ATG9A', aliases: ['APG9L1'], notes: 'Autophagy-related 9A; the only multi-spanning membrane ATG protein; lipid scramblase that seeds the autophagosome; mislocalised when αSyn aggregates.',
    expectTokens: ['ATG9A', 'Q7Z3C6', 'autophagy', 'autophagosome'] },
  { symbol: 'RAB1A', aliases: ['YPT1'], notes: 'Small GTPase regulating ER-Golgi trafficking and autophagosome biogenesis; mislocalisation by αSyn impairs autophagy initiation.',
    expectTokens: ['RAB1A', 'P62820', 'autophagy', 'trafficking', 'parkinson'] },
  { symbol: 'C1QA',  aliases: ['C1Q'],  notes: 'Complement C1q subunit A; tags synapses for microglial phagocytosis; upregulated on AD synapses and drives complement-mediated synaptic pruning.',
    expectTokens: ['C1QA', 'P02745', 'complement', 'microglia', 'synaptic pruning'] },
  { symbol: 'C3',    aliases: [], notes: 'Complement C3; downstream of C1q in classical pathway; tags synapses for microglial removal; AD and frontotemporal pathology.',
    expectTokens: ['C3', 'P01024', 'complement', 'microglia', 'synaptic pruning'] },
  { symbol: 'ATP6V0A1', aliases: ['VPP1', 'ATP6N1'], notes: 'V-ATPase V0 a1 subunit; lysosomal acidification; PSEN1 mutations impair its assembly, disrupting lysosomal pH in familial AD.',
    expectTokens: ['ATP6V0A1', 'Q93050', 'v-ATPase', 'lysosom', 'alzheimer'] },
  { symbol: 'SLC1A2', aliases: ['EAAT2', 'GLT-1'], notes: 'Glial glutamate transporter 1 (EAAT2/GLT-1); clears synaptic glutamate; mHTT in astrocytes reduces SLC1A2, driving excitotoxic striatal degeneration in HD.',
    expectTokens: ['EAAT2', 'P43004', 'GLT-1', 'glutamate', 'huntington'] },

  // ===== Round 4 — tangential expansion (synaptic vesicles, PSD, DA neurons,
  //                 mitochondrial fission, AD GWAS hits, ALS, autophagy core).
  //                 Connected to core nodes via dotted edges — SME to validate. =====

  // Synaptic vesicle / SNARE
  { symbol: 'SYT1',     aliases: ['SYNAPTOTAGMIN-1'], notes: 'Synaptotagmin-1 — calcium sensor for synaptic vesicle fusion; interacts with αSyn and the SNARE complex.',
    expectTokens: ['synaptotagmin', 'P21579', 'synaptic vesicle', 'calcium'] },
  { symbol: 'STX1A',    aliases: ['SYNTAXIN-1A'], notes: 'Syntaxin-1A — t-SNARE on presynaptic membrane; assembles with VAMP2 and SNAP25 for vesicle fusion.',
    expectTokens: ['syntaxin', 'Q16623', 'SNARE', 'synaptic vesicle'] },
  { symbol: 'SNAP25',   aliases: [], notes: 'Synaptosomal-associated protein 25 — t-SNARE; reduced in AD presynapses; Aβ disrupts assembly.',
    expectTokens: ['SNAP25', 'P60880', 'SNARE', 'alzheimer', 'synaptic'] },
  { symbol: 'VAMP2',    aliases: ['SYNAPTOBREVIN-2'], notes: 'Synaptobrevin-2 — v-SNARE on synaptic vesicles; αSyn binds and clusters VAMP2.',
    expectTokens: ['VAMP2', 'P63027', 'synaptobrevin', 'SNARE', 'synaptic vesicle'] },
  { symbol: 'SYP',      aliases: ['SYNAPTOPHYSIN'], notes: 'Synaptophysin — abundant SV protein; one of the earliest presynaptic markers lost in AD.',
    expectTokens: ['synaptophysin', 'P08247', 'synaptic vesicle', 'alzheimer'] },
  { symbol: 'SV2A',     aliases: [], notes: 'Synaptic vesicle glycoprotein 2A — universal SV marker; levetiracetam target; in vivo PET biomarker of synaptic density.',
    expectTokens: ['SV2A', 'Q7L0J3', 'synaptic vesicle', 'PET'] },

  // PSD scaffolds + glutamate receptors
  { symbol: 'DLG4',     aliases: ['PSD-95', 'PSD95'], notes: 'PSD-95 — postsynaptic density scaffold; anchors NMDA/AMPA receptors; reduced by TDP-43 mislocalisation in ALS.',
    expectTokens: ['PSD-95', 'P78352', 'postsynaptic', 'scaffold'] },
  { symbol: 'GRIN1',    aliases: ['NMDAR1', 'NR1'], notes: 'NMDA receptor obligate subunit GluN1; Aβ-driven endocytosis reduces postsynaptic density.',
    expectTokens: ['NMDA', 'Q05586', 'glutamate', 'postsynaptic'] },
  { symbol: 'GRIA1',    aliases: ['GLUR1'], notes: 'AMPA receptor subunit GluA1; trafficking and endocytosis regulated by Aβ-PrPc-Fyn signalling.',
    expectTokens: ['AMPA', 'P42261', 'glutamate', 'postsynaptic'] },
  { symbol: 'HOMER1',   aliases: [], notes: 'Homer-1 — PSD scaffold linking mGluRs to IP3 receptors; activity-dependent expression.',
    expectTokens: ['HOMER1', 'Q86YM7', 'postsynaptic', 'scaffold'] },

  // Mitochondrial fission machinery (DRP1 receptors)
  { symbol: 'FIS1',     aliases: ['TTC11'], notes: 'Fission protein 1 — outer mitochondrial membrane DRP1 receptor; recruited by Aβ in AD.',
    expectTokens: ['FIS1', 'Q9Y3D6', 'mitochondri', 'fission'] },
  { symbol: 'MFF',      aliases: [], notes: 'Mitochondrial fission factor — primary DRP1 receptor on the OMM; phosphoregulated by AMPK.',
    expectTokens: ['MFF', 'Q9GZY8', 'mitochondri', 'fission'] },
  { symbol: 'MIEF1',    aliases: ['MID49'], notes: 'Mitochondrial elongation factor 1 (MID49) — DRP1 receptor; co-recruits MFF for fission.',
    expectTokens: ['MID49', 'Q9NQG6', 'mitochondri', 'fission'] },

  // DA-neuron-specific (PD vulnerability axis)
  { symbol: 'TH',       aliases: ['TYROSINE HYDROXYLASE'], notes: 'Rate-limiting enzyme of dopamine synthesis; loss in substantia nigra is the biochemical signature of PD.',
    expectTokens: ['tyrosine hydroxylase', 'P07101', 'dopamine', 'parkinson'] },
  { symbol: 'SLC6A3',   aliases: ['DAT', 'DAT1'], notes: 'Dopamine transporter — presynaptic dopamine reuptake; the DAT-SPECT imaging target in PD diagnosis.',
    expectTokens: ['DAT', 'Q01959', 'dopamine', 'parkinson', 'transporter'] },
  { symbol: 'SLC18A2',  aliases: ['VMAT2'], notes: 'Vesicular monoamine transporter 2 — loads monoamines into synaptic vesicles; reduced in PD.',
    expectTokens: ['VMAT2', 'Q05940', 'dopamine', 'synaptic vesicle', 'parkinson'] },

  // Additional AD LOAD GWAS hits
  { symbol: 'PICALM',   aliases: ['CALM'], notes: 'Phosphatidylinositol-binding clathrin assembly protein — endocytosis; consistent LOAD GWAS hit.',
    expectTokens: ['PICALM', 'Q13492', 'alzheimer', 'endocyt'] },
  { symbol: 'CD2AP',    aliases: [], notes: 'CD2-associated protein — endocytic adaptor; LOAD GWAS hit; AD risk via APP processing.',
    expectTokens: ['CD2AP', 'Q9Y5K6', 'alzheimer', 'endocyt'] },
  { symbol: 'TOMM40',   aliases: [], notes: 'TOM40 — outer mitochondrial membrane channel; gene sits adjacent to APOE on chr19, with confounded AD-risk signal.',
    expectTokens: ['TOMM40', 'O96008', 'mitochondri', 'alzheimer'] },

  // ALS expansion
  { symbol: 'UBQLN2',   aliases: ['UBIQUILIN-2'], notes: 'Ubiquilin-2 — X-linked ALS/FTD; shuttles ubiquitinated cargo to the proteasome and autophagy.',
    expectTokens: ['ubiquilin', 'Q9UHD9', 'ALS', 'FTD', 'ubiquitin'] },
  { symbol: 'KIF5A',    aliases: [], notes: 'Kinesin family member 5A — anterograde axonal transport motor; ALS25; also hereditary spastic paraplegia 10.',
    expectTokens: ['KIF5A', 'Q12840', 'kinesin', 'axonal transport', 'ALS'] },
  { symbol: 'ANG',      aliases: ['ANGIOGENIN'], notes: 'Angiogenin — RNase A family; ALS9; tRNA-derived fragments in neuronal stress response.',
    expectTokens: ['angiogenin', 'P03950', 'ALS', 'RNase'] },
  { symbol: 'CHCHD10',  aliases: [], notes: 'Mitochondrial coiled-coil-helix protein 10 — ALS22/FTD; paralog of CHCHD2; intermembrane-space.',
    expectTokens: ['CHCHD10', 'Q8WYQ3', 'mitochondri', 'ALS', 'FTD'] },

  // Autophagy core extensions
  { symbol: 'RB1CC1',   aliases: ['FIP200'], notes: 'FIP200 — scaffold subunit of the ULK1 autophagy-initiation complex; loss abolishes neuronal autophagy.',
    expectTokens: ['FIP200', 'Q8TDY2', 'autophagy', 'ULK1'] },
  { symbol: 'ATG12',    aliases: [], notes: 'ATG12 — ubiquitin-like protein that conjugates with ATG5; the conjugate is the E3-like for LC3 lipidation.',
    expectTokens: ['ATG12', 'O94817', 'autophagy', 'conjugation'] },
  { symbol: 'ATG16L1',  aliases: [], notes: 'ATG16L1 — recruits ATG12-ATG5 to phagophore; Crohn-disease risk allele T300A; required for LC3 lipidation.',
    expectTokens: ['ATG16L1', 'Q676U5', 'autophagy', 'phagophore'] },
  { symbol: 'STX17',    aliases: ['SYNTAXIN-17'], notes: 'Syntaxin-17 — autophagosome SNARE; mediates fusion with LAMP1+ lysosomes via SNAP29 and VAMP8.',
    expectTokens: ['STX17', 'P56962', 'autophagy', 'SNARE', 'fusion'] },

  // Inflammation
  { symbol: 'NLRP3',    aliases: ['NALP3'], notes: 'NLR family pyrin domain containing 3 — inflammasome sensor; activated by Aβ, αSyn fibrils; drives IL-1β in chronic neuroinflammation.',
    expectTokens: ['NLRP3', 'Q96P20', 'inflammasome', 'microglia', 'neuroinflammation'] },

  // Iron / NBIA-adjacent
  { symbol: 'FTL',      aliases: ['FERRITIN-LIGHT'], notes: 'Ferritin light chain — iron storage; pathogenic mutations cause neuroferritinopathy (an NBIA subtype).',
    expectTokens: ['ferritin', 'P02792', 'iron', 'NBIA'] },

  // ===== Group J — FTD modifiers & brain-iron accumulation =====
  {
    symbol: 'TMEM106B',
    aliases: [],
    notes: 'Lysosomal membrane protein; major FTD-TDP risk-modifier locus; recently identified as forming its own amyloid filaments in aging.',
    expectTokens: ['TMEM106B', 'Q9NUM4', 'FTD', 'lysosom', 'TDP-43'],
  },
  {
    symbol: 'SORT1',
    aliases: ['SORTILIN', 'NT3'],
    notes: 'Sortilin; progranulin receptor for lysosomal delivery; cholesterol metabolism; LDL receptor partner.',
    expectTokens: ['sortilin', 'Q99523', 'progranulin', 'FTD', 'lysosom'],
  },
  {
    symbol: 'PLA2G6',
    aliases: ['PARK14', 'iPLA2', 'INAD1'],
    notes: 'PARK14 — phospholipase A2 group VI; infantile neuroaxonal dystrophy; one of the NBIA (neurodegeneration with brain iron accumulation) syndromes.',
    expectTokens: ['PLA2G6', 'O60733', 'PARK14', 'NBIA', 'iron'],
  },
  {
    symbol: 'PANK2',
    aliases: ['HARP', 'PKAN', 'NBIA1'],
    notes: 'Pantothenate kinase 2; pantothenate-kinase-associated neurodegeneration (PKAN) — the most common NBIA subtype.',
    expectTokens: ['PANK2', 'Q8TE04', 'PKAN', 'NBIA', 'iron'],
  },
  {
    symbol: 'C19orf12',
    aliases: ['MPAN', 'NBIA4'],
    notes: 'Mitochondrial-membrane protein-associated NBIA (MPAN); fourth of the NBIA syndromes; mitochondrial outer-membrane protein.',
    expectTokens: ['C19orf12', 'Q9NSK7', 'MPAN', 'NBIA', 'mitochondri'],
  },
];

/** Default model state — what a fresh install sees. */
export function defaultModelState() {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    version: 'v0.1',
    createdAt: now,
    updatedAt: now,
    versionHistory: [
      {
        version: 'v0.1',
        at: now,
        change: 'initial',
        reason: 'fresh model — no preference data yet',
        delta: { addedExamples: 0, addedAvoidPatterns: 0, rubricShift: null },
      },
    ],
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    fewShotExamples: [],
    avoidPatterns: [],
    rubricWeights: { ...DEFAULT_RUBRIC_WEIGHTS },
    ratingsLog: [],
    preferences: [],
    goldStandards: [],
    edgeRatings: [], // see recordEdgeRating — SME judgements on network edges
    panel: DEFAULT_GENE_PANEL.map((g) => ({ ...g })),
    settings: {
      learningLoopEvery: LEARNING_LOOP_EVERY,
      maxFewShot: MAX_FEW_SHOT,
      maxAvoid: MAX_AVOID,
      anthropicModel: 'claude-sonnet-4-6',
      anthropicMaxTokens: 2048,
    },
  };
}

/** Tiny event emitter. */
class Emitter {
  constructor() {
    this._h = new Map();
  }
  on(evt, fn) {
    if (!this._h.has(evt)) this._h.set(evt, new Set());
    this._h.get(evt).add(fn);
    return () => this._h.get(evt).delete(fn);
  }
  emit(evt, payload) {
    const set = this._h.get(evt);
    if (!set) return;
    for (const fn of set) {
      try { fn(payload); } catch (e) { console.error(`emitter handler for ${evt} threw:`, e); }
    }
  }
}

/** Compute version bump (v0.N → v0.(N+1), wraps to v1.0 at 9, etc.) */
function bumpVersionString(v) {
  const m = /^v(\d+)\.(\d+)$/.exec(v);
  if (!m) return 'v0.2';
  const [maj, min] = [Number(m[1]), Number(m[2])];
  if (min >= 9) return `v${maj + 1}.0`;
  return `v${maj}.${min + 1}`;
}

/** Pull short "do not" phrases out of a comment + bottom-rated brief. */
function distilAvoidPattern(brief, comment, ratings) {
  // Identify the worst dimension.
  const dims = Object.entries(ratings).sort((a, b) => a[1] - b[1]);
  const worstDim = dims[0]?.[0] ?? 'overall';
  const worstScore = dims[0]?.[1] ?? 0;
  // Trim user comment to a short phrase if present.
  const tail = (comment || '').trim();
  const phrase = tail
    ? tail.slice(0, 160)
    : `low-scored on ${worstDim} (${worstScore}/5)`;
  return {
    pattern: `Avoid the failure mode flagged on ${worstDim}: ${phrase}`,
    sourceDimension: worstDim,
    addedAt: new Date().toISOString(),
  };
}

/**
 * BioscopeModel — wraps the model state with persistence, mutation methods,
 * and the learning loop.
 */
export class BioscopeModel extends Emitter {
  constructor(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
    super();
    this.storage = storage;
    this.state = this._load();
  }

  _load() {
    if (!this.storage) return defaultModelState();
    try {
      // Backward-compat: pull from the old bioscope-train-v1 key if the
      // new nd-train-v1 key is empty (one-time migration on first load).
      let raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) {
        const legacy = this.storage.getItem('bioscope-train-v1');
        if (legacy) {
          raw = legacy;
          try { this.storage.setItem(STORAGE_KEY, legacy); } catch { /* noop */ }
          console.log('Migrated training state from bioscope-train-v1 → ' + STORAGE_KEY);
        }
      }
      if (!raw) return defaultModelState();
      const parsed = JSON.parse(raw);
      // Light migration / shape check
      const merged = { ...defaultModelState(), ...parsed };
      merged.settings = { ...defaultModelState().settings, ...(parsed.settings ?? {}) };
      merged.rubricWeights = { ...DEFAULT_RUBRIC_WEIGHTS, ...(parsed.rubricWeights ?? {}) };
      if (!Array.isArray(merged.panel) || merged.panel.length === 0) {
        merged.panel = defaultModelState().panel;
      }
      // Migration for v0.1 → v0.2: edgeRatings array added in this round
      if (!Array.isArray(merged.edgeRatings)) merged.edgeRatings = [];
      return merged;
    } catch (e) {
      console.warn('BioscopeModel: failed to parse stored state, starting fresh', e);
      return defaultModelState();
    }
  }

  _save() {
    if (!this.storage) return;
    this.state.updatedAt = new Date().toISOString();
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('BioscopeModel: failed to persist state', e);
    }
    this.emit('change', this.state);
  }

  // ---- Reads ----

  get version() { return this.state.version; }
  get systemPrompt() { return this.state.systemPrompt; }
  get fewShotExamples() { return this.state.fewShotExamples; }
  get avoidPatterns() { return this.state.avoidPatterns; }
  get rubricWeights() { return this.state.rubricWeights; }
  get panel() { return this.state.panel; }
  get ratingsLog() { return this.state.ratingsLog; }
  get preferences() { return this.state.preferences; }
  get goldStandards() { return this.state.goldStandards; }
  get edgeRatings() { return this.state.edgeRatings ?? []; }
  get settings() { return this.state.settings; }

  /** Weighted overall score for a rating, 0..5. */
  overall(rating) {
    const w = this.state.rubricWeights;
    const sumW = w.factuality + w.completeness + w.citation + w.clarity;
    if (sumW === 0) return 0;
    return (
      (rating.factuality * w.factuality +
        rating.completeness * w.completeness +
        rating.citation * w.citation +
        rating.clarity * w.clarity) /
      sumW
    );
  }

  // ---- Mutations ----

  updateSystemPrompt(text) {
    if (text === this.state.systemPrompt) return;
    const previous = this.state.systemPrompt;
    this.state.systemPrompt = text;
    this._appendVersionEntry({
      change: 'system-prompt-edit',
      reason: 'manual edit by SME',
      delta: { systemPromptBefore: previous, systemPromptAfter: text },
    });
    this._bumpVersion();
    this._save();
  }

  updateRubricWeights(weights) {
    this.state.rubricWeights = { ...this.state.rubricWeights, ...weights };
    this._save();
  }

  updateSettings(patch) {
    this.state.settings = { ...this.state.settings, ...patch };
    this._save();
  }

  addOrUpdateGene(g) {
    const idx = this.state.panel.findIndex((p) => p.symbol === g.symbol);
    if (idx === -1) this.state.panel.push(g);
    else this.state.panel[idx] = { ...this.state.panel[idx], ...g };
    this._save();
  }

  removeGene(symbol) {
    this.state.panel = this.state.panel.filter((p) => p.symbol !== symbol);
    this._save();
  }

  recordRating({ gene, brief, briefSource, briefVariant, ratings, comment }) {
    const entry = {
      id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      gene,
      briefSource,
      briefVariant: briefVariant ?? null,
      ratings,
      overall: Number(this.overall(ratings).toFixed(2)),
      comment: comment ?? '',
      briefSnippet: brief.slice(0, 280),
      briefLength: brief.length,
      ratedAt: new Date().toISOString(),
    };
    this.state.ratingsLog.push(entry);
    this._save();
    this.emit('rating', entry);

    // Capture brief content alongside the rating for the learning loop
    // (we don't put it in the log to keep the log small).
    this._lastBriefs = this._lastBriefs ?? new Map();
    this._lastBriefs.set(entry.id, brief);

    const newSinceLoop = this._countNewRatingsSinceLoop();
    if (newSinceLoop >= this.state.settings.learningLoopEvery) {
      this.applyLearningLoop();
    }
    return entry;
  }

  recordPreference({ gene, briefA, briefB, winner, reason }) {
    const entry = {
      id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      gene,
      briefA: { snippet: briefA.slice(0, 280), full: briefA },
      briefB: { snippet: briefB.slice(0, 280), full: briefB },
      winner, // 'A' | 'B' | 'tie'
      reason: reason ?? '',
      at: new Date().toISOString(),
    };
    this.state.preferences.push(entry);
    this._save();
    this.emit('preference', entry);
    return entry;
  }

  recordGoldStandard({ gene, brief, basedOnRatingId, notes }) {
    const entry = {
      id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      gene,
      brief,
      basedOnRatingId: basedOnRatingId ?? null,
      notes: notes ?? '',
      at: new Date().toISOString(),
    };
    this.state.goldStandards.push(entry);
    this._save();
    this.emit('gold-standard', entry);
    return entry;
  }

  /**
   * Record an SME judgement on a network edge — the connection neurodigineration
   * proposed between two genes/proteins. Drives the network-training
   * feedback loop: invalid edges become avoid patterns, well-explained
   * valid edges become few-shot examples.
   *
   * @param {object} arg
   * @param {string} arg.edgeId          stable key, e.g. "PINK1→PRKN"
   * @param {string} arg.from
   * @param {string} arg.to
   * @param {string} arg.kind            edge category (kinase-substrate, etc.)
   * @param {string} arg.proposedNote    neurodigineration's explanation as shown
   * @param {string[]} arg.proposedPmids citations as shown
   * @param {'yes'|'no'|'uncertain'} arg.validity is the connection real?
   * @param {number} arg.explanationQuality 1..5 (how good is the explanation)
   * @param {number} arg.citationQuality    1..5 (how relevant are the PMIDs)
   * @param {string} [arg.feedback]      SME free-text correction
   */
  recordEdgeRating({
    edgeId, from, to, kind, proposedNote, proposedPmids,
    validity, explanationQuality, citationQuality, feedback,
  }) {
    const entry = {
      id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      edgeId, from, to, kind,
      proposedNote: (proposedNote || '').slice(0, 1000),
      proposedPmids: Array.isArray(proposedPmids) ? proposedPmids.slice(0, 10) : [],
      validity,
      explanationQuality,
      citationQuality,
      feedback: (feedback || '').slice(0, 600),
      ratedAt: new Date().toISOString(),
    };
    this.state.edgeRatings.push(entry);

    // Network-rating learning loop (separate from brief loop):
    // - validity=no → add concrete avoid pattern citing the wrong link
    // - validity=yes AND explanationQuality>=4 → save as positive example
    if (validity === 'no') {
      this.state.avoidPatterns.push({
        pattern: `Do not assert a "${kind}" relationship between ${from} and ${to}` +
          (feedback ? ` — SME notes: "${feedback}"` : '') +
          '. The connection was flagged as not real.',
        sourceDimension: 'network-edge-validity',
        addedAt: new Date().toISOString(),
      });
      if (this.state.avoidPatterns.length > this.state.settings.maxAvoid) {
        this.state.avoidPatterns.shift();
      }
      this._appendVersionEntry({
        change: 'network-correction',
        reason: `SME rejected ${from} → ${to} (${kind})`,
        delta: { rejected: edgeId, feedback: feedback || null },
      });
      this._bumpVersion();
    } else if (validity === 'yes' && explanationQuality >= 4) {
      // Promote the explanation as a positive example anchored to the gene
      this.state.fewShotExamples.push({
        gene: from,
        brief: `${from} ↔ ${to} (${kind}): ${proposedNote}` +
          (proposedPmids.length ? `\n\nCitations: ${proposedPmids.map((p) => `PMID:${p}`).join(', ')}` : ''),
        rating: {
          factuality: explanationQuality,
          completeness: explanationQuality,
          citation: citationQuality,
          clarity: explanationQuality,
        },
        overall: (explanationQuality * 3 + citationQuality) / 4,
        savedAt: new Date().toISOString(),
      });
      if (this.state.fewShotExamples.length > this.state.settings.maxFewShot) {
        this.state.fewShotExamples.shift();
      }
      this._appendVersionEntry({
        change: 'network-confirmation',
        reason: `SME confirmed ${from} → ${to} (${kind}) with quality ${explanationQuality}/5`,
        delta: { confirmed: edgeId, quality: explanationQuality },
      });
      this._bumpVersion();
    }

    this._save();
    this.emit('edge-rating', entry);
    return entry;
  }

  // ---- Learning loop ----

  _countNewRatingsSinceLoop() {
    // Count ratings logged after the last `learning-loop` versionHistory entry.
    const lastLoop = [...this.state.versionHistory].reverse().find((v) => v.change === 'learning-loop');
    const since = lastLoop ? new Date(lastLoop.at).getTime() : 0;
    return this.state.ratingsLog.filter((r) => new Date(r.ratedAt).getTime() > since).length;
  }

  applyLearningLoop() {
    const since = this._lastLoopTime();
    const newRatings = this.state.ratingsLog.filter(
      (r) => new Date(r.ratedAt).getTime() > since,
    );
    if (newRatings.length === 0) return null;

    const briefs = this._lastBriefs ?? new Map();
    let addedExamples = 0;
    let addedAvoidPatterns = 0;

    // 1) Promote the top-rated NEW brief into the few-shot example pool.
    const topRated = [...newRatings].sort((a, b) => b.overall - a.overall)[0];
    if (topRated && topRated.overall >= 4) {
      const full = briefs.get(topRated.id) ?? topRated.briefSnippet;
      this.state.fewShotExamples.push({
        gene: topRated.gene,
        brief: full,
        rating: topRated.ratings,
        overall: topRated.overall,
        savedAt: new Date().toISOString(),
      });
      if (this.state.fewShotExamples.length > this.state.settings.maxFewShot) {
        this.state.fewShotExamples.shift();
      }
      addedExamples += 1;
    }

    // 2) Distil avoid patterns from the bottom-rated brief.
    const worst = [...newRatings].sort((a, b) => a.overall - b.overall)[0];
    if (worst && worst.overall <= 2.5) {
      const full = briefs.get(worst.id) ?? worst.briefSnippet;
      this.state.avoidPatterns.push(
        distilAvoidPattern(full, worst.comment, worst.ratings),
      );
      if (this.state.avoidPatterns.length > this.state.settings.maxAvoid) {
        this.state.avoidPatterns.shift();
      }
      addedAvoidPatterns += 1;
    }

    // 3) Shift rubric weights: dimensions where the SME tends to rate
    //    BELOW the mean get MORE weight (the SME is signalling that those
    //    dimensions matter more — they're being tougher there).
    const dims = ['factuality', 'completeness', 'citation', 'clarity'];
    const dimMeans = Object.fromEntries(dims.map((d) => [d, mean(newRatings.map((r) => r.ratings[d]))]));
    const grand = mean(Object.values(dimMeans));
    const oldW = { ...this.state.rubricWeights };
    const newW = {};
    for (const d of dims) {
      const shift = grand === 0 ? 0 : (grand - dimMeans[d]) / grand; // -1..+1
      // Damped update: 70% old, 30% nudge based on shift
      newW[d] = clamp(oldW[d] * (1 + 0.3 * shift), 0.3, 2.0);
    }
    // Re-normalise so they sum to 4 (so the rubric stays interpretable).
    const newSum = Object.values(newW).reduce((a, b) => a + b, 0);
    if (newSum > 0) {
      for (const d of dims) newW[d] = +(newW[d] * (4 / newSum)).toFixed(3);
    }
    this.state.rubricWeights = newW;

    // 4) Bump version + log it.
    this._appendVersionEntry({
      change: 'learning-loop',
      reason: `processed ${newRatings.length} new ratings`,
      delta: {
        addedExamples,
        addedAvoidPatterns,
        rubricBefore: oldW,
        rubricAfter: newW,
        ratingMeans: dimMeans,
      },
    });
    this._bumpVersion();
    this._save();
    this.emit('version-bump', this.state.versionHistory.at(-1));
    return this.state.versionHistory.at(-1);
  }

  _lastLoopTime() {
    const lastLoop = [...this.state.versionHistory].reverse().find((v) => v.change === 'learning-loop');
    return lastLoop ? new Date(lastLoop.at).getTime() : 0;
  }

  _appendVersionEntry(partial) {
    this.state.versionHistory.push({
      version: bumpVersionString(this.state.version),
      at: new Date().toISOString(),
      ...partial,
    });
  }

  _bumpVersion() {
    this.state.version = bumpVersionString(this.state.version);
  }

  // ---- Reset / import / export ----

  reset() {
    this.state = defaultModelState();
    this._lastBriefs = new Map();
    this._save();
    this.emit('reset', this.state);
  }

  export() {
    return JSON.stringify(this.state, null, 2);
  }

  import(json) {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json;
    // Light validation — must look like a model state
    if (!parsed || typeof parsed !== 'object' || !parsed.version || !Array.isArray(parsed.versionHistory)) {
      throw new Error('Imported JSON does not look like a neurodigineration model state');
    }
    this.state = { ...defaultModelState(), ...parsed };
    this._save();
    this.emit('imported', this.state);
  }
}

// ---- Helpers (exported for tests) ----

export function mean(xs) {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

export { STORAGE_KEY, DEFAULT_SYSTEM_PROMPT };
