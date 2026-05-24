// Cross-disease neurodegeneration network — curated relationship graph.
//
// Each node represents a gene/protein from the bioscope panel. `prevalence`
// (0–1) drives the visual box size — it encodes how prominent the gene is
// in its primary disease, accounting for both monogenic cause-prevalence
// and risk-modifier strength. The intent is: the boxes you see biggest
// are the names a clinician thinks of first when the disease is mentioned.
//
// Each edge represents a real biological relationship between two genes:
// either a direct molecular interaction (kinase/substrate, receptor/ligand,
// complex partners) or a shared-mechanism / shared-disease co-implication.
// The `kind` field colours the edge so the viewer can read "this is a
// substrate relationship" vs "this is a cross-disease coincidence."
//
// Coverage: ~50 most-iconic genes from the 99-gene panel + the most
// pedagogically important ~60 edges. Designed to be readable at one glance,
// not to enumerate every interaction in the literature.

export const DISEASES = {
  PD:    { name: "Parkinson's",     short: 'PD',    color: '#0b3b5a', soft: '#e6eef5' },
  AD:    { name: "Alzheimer's",     short: 'AD',    color: '#7c3aed', soft: '#f3eaff' },
  ALS:   { name: 'ALS / FTD',       short: 'ALS',   color: '#dc2626', soft: '#fee2e2' },
  HD:    { name: 'Huntington/polyQ',short: 'HD',    color: '#b45309', soft: '#fff7d6' },
  PRION: { name: 'Prion',           short: 'PRP',   color: '#0891b2', soft: '#cffafe' },
  LSD:   { name: 'Lysosomal storage', short: 'LSD', color: '#15803d', soft: '#dcfce7' },
  NBIA:  { name: 'NBIA',            short: 'NBIA',  color: '#6b21a8', soft: '#ede9fe' },
  SHARED:{ name: 'Shared core',     short: '·',     color: '#6a7787', soft: '#f0f4f8' },
};

/**
 * Node: { id, label, protein, disease, prevalence, role, secondary[] }
 * - id: HGNC symbol (matches panel)
 * - prevalence: 0..1, drives box size
 * - role: short noun phrase shown on hover
 * - secondary: additional diseases the gene crosses over to (drives edge layout)
 * - col: explicit disease-column placement; defaults to disease
 */
export const NODES = [
  // ===== Parkinson's =====
  { id: 'SNCA',    protein: 'α-synuclein',           disease: 'PD',  prevalence: 1.00, role: 'Lewy body core; dominant familial PD; PARK1/4' },
  { id: 'LRRK2',   protein: 'LRRK2 kinase',          disease: 'PD',  prevalence: 0.95, role: 'most common monogenic PD; G2019S; PARK8' },
  { id: 'GBA',     protein: 'glucocerebrosidase',    disease: 'PD',  prevalence: 0.95, role: 'strongest common genetic PD risk factor', secondary: ['LSD'] },
  { id: 'PRKN',    protein: 'parkin (E3 ligase)',    disease: 'PD',  prevalence: 0.80, role: 'AR juvenile PD; mitophagy; PARK2' },
  { id: 'PINK1',   protein: 'PINK1 kinase',          disease: 'PD',  prevalence: 0.75, role: 'recessive PD; mitochondrial damage sensor; PARK6' },
  { id: 'PARK7',   protein: 'DJ-1',                  disease: 'PD',  prevalence: 0.45, role: 'recessive PD; redox-regulated chaperone' },
  { id: 'VPS35',   protein: 'VPS35 (retromer)',      disease: 'PD',  prevalence: 0.45, role: 'AD-onset PD; D620N; PARK17' },
  { id: 'ATP13A2', protein: 'ATP13A2 (lyso ATPase)', disease: 'PD',  prevalence: 0.35, role: 'Kufor-Rakeb / atypical PD; PARK9', secondary: ['LSD'] },

  // ===== Alzheimer's =====
  { id: 'APP',     protein: 'amyloid precursor',     disease: 'AD',  prevalence: 1.00, role: 'plaque source; familial AD; trisomy 21 dosage' },
  { id: 'MAPT',    protein: 'tau',                   disease: 'AD',  prevalence: 1.00, role: 'NFT core; tauopathies; FTDP-17', secondary: ['PD', 'ALS'] },
  { id: 'APOE',    protein: 'apolipoprotein E',      disease: 'AD',  prevalence: 1.00, role: 'ε4 = strongest LOAD risk; lipid carrier' },
  { id: 'PSEN1',   protein: 'presenilin 1',          disease: 'AD',  prevalence: 0.80, role: 'γ-secretase catalytic; >300 EOFAD mutations' },
  { id: 'PSEN2',   protein: 'presenilin 2',          disease: 'AD',  prevalence: 0.45, role: 'rarer EOFAD; γ-secretase paralog' },
  { id: 'TREM2',   protein: 'TREM2 (microglia)',     disease: 'AD',  prevalence: 0.65, role: 'R47H raises LOAD risk ~3x; microglial activation' },
  { id: 'BIN1',    protein: 'bridging integrator 1', disease: 'AD',  prevalence: 0.50, role: '#2 LOAD GWAS hit after APOE; endocytosis' },
  { id: 'CLU',     protein: 'clusterin / APOJ',      disease: 'AD',  prevalence: 0.40, role: 'LOAD risk; Aβ chaperone' },
  { id: 'SORL1',   protein: 'sortilin-rel. receptor',disease: 'AD',  prevalence: 0.40, role: 'LOAD + EOAD; APP trafficking' },

  // ===== ALS / FTD =====
  { id: 'C9orf72', protein: 'C9orf72',               disease: 'ALS', prevalence: 1.00, role: 'GGGGCC expansion; most common monogenic ALS + FTD' },
  { id: 'SOD1',    protein: 'SOD1',                  disease: 'ALS', prevalence: 0.95, role: 'original familial ALS; tofersen approved' },
  { id: 'TARDBP',  protein: 'TDP-43',                disease: 'ALS', prevalence: 0.95, role: 'pathology in >90% sporadic ALS + FTD-TDP' },
  { id: 'FUS',     protein: 'fused-in-sarcoma',      disease: 'ALS', prevalence: 0.65, role: 'juvenile / adult ALS; phase separation' },
  { id: 'GRN',     protein: 'progranulin',           disease: 'ALS', prevalence: 0.60, role: 'FTD-TDP via haploinsufficiency' },
  { id: 'TBK1',    protein: 'TBK1 kinase',           disease: 'ALS', prevalence: 0.40, role: 'ALS/FTD; phosphorylates OPTN, p62' },
  { id: 'OPTN',    protein: 'optineurin',            disease: 'ALS', prevalence: 0.35, role: 'ALS; selective autophagy receptor' },
  { id: 'SQSTM1',  protein: 'p62',                   disease: 'ALS', prevalence: 0.40, role: 'ALS / FTD / Paget; autophagy adaptor' },

  // ===== Huntington / polyQ =====
  { id: 'HTT',     protein: 'huntingtin',            disease: 'HD',  prevalence: 1.00, role: 'CAG expansion; canonical polyQ disease' },
  { id: 'ATXN1',   protein: 'ataxin-1',              disease: 'HD',  prevalence: 0.55, role: 'SCA1; polyQ' },
  { id: 'ATXN2',   protein: 'ataxin-2',              disease: 'HD',  prevalence: 0.65, role: 'SCA2 polyQ; intermediate alleles raise ALS risk', secondary: ['ALS'] },
  { id: 'ATXN3',   protein: 'ataxin-3',              disease: 'HD',  prevalence: 0.65, role: 'SCA3 / Machado-Joseph; commonest dominant ataxia' },
  { id: 'AR',      protein: 'androgen receptor',     disease: 'HD',  prevalence: 0.40, role: 'SBMA (Kennedy disease); polyQ' },
  { id: 'MSH3',    protein: 'MutSβ component',       disease: 'HD',  prevalence: 0.40, role: 'somatic CAG instability; HD age-of-onset modifier' },
  { id: 'FAN1',    protein: 'FAN1 nuclease',         disease: 'HD',  prevalence: 0.35, role: 'DNA repair; HD onset modifier' },

  // ===== Prion =====
  { id: 'PRNP',    protein: 'prion protein PrP',     disease: 'PRION', prevalence: 1.00, role: 'CJD / GSS / FFI; misfolding paradigm' },

  // ===== Lysosomal storage =====
  { id: 'SCARB2',  protein: 'LIMP-2',                disease: 'LSD', prevalence: 0.70, role: 'GBA lysosomal-delivery receptor', secondary: ['PD'] },
  { id: 'NPC1',    protein: 'NPC1',                  disease: 'LSD', prevalence: 0.85, role: 'Niemann-Pick C; lysosomal cholesterol egress' },
  { id: 'NPC2',    protein: 'NPC2',                  disease: 'LSD', prevalence: 0.40, role: 'NPC partner; soluble cholesterol binder' },
  { id: 'HEXA',    protein: 'β-hexosaminidase α',    disease: 'LSD', prevalence: 0.60, role: 'Tay-Sachs; GM2 gangliosidosis' },
  { id: 'GALC',    protein: 'galactosylceramidase',  disease: 'LSD', prevalence: 0.55, role: 'Krabbe disease; psychosine' },
  { id: 'GAA',     protein: 'acid α-glucosidase',    disease: 'LSD', prevalence: 0.60, role: 'Pompe disease; first lysosomal ERT' },
  { id: 'SMPD1',   protein: 'acid sphingomyelinase', disease: 'LSD', prevalence: 0.55, role: 'Niemann-Pick A/B' },

  // ===== NBIA =====
  { id: 'WDR45',   protein: 'WIPI4 / WDR45',         disease: 'NBIA',prevalence: 0.70, role: 'BPAN; X-linked; autophagy + iron' },
  { id: 'PLA2G6',  protein: 'iPLA2-VI',              disease: 'NBIA',prevalence: 0.60, role: 'PARK14 / INAD; phospholipase A2' },
  { id: 'PANK2',   protein: 'pantothenate kinase 2', disease: 'NBIA',prevalence: 0.85, role: 'PKAN — commonest NBIA' },
  { id: 'C19orf12',protein: 'C19orf12',              disease: 'NBIA',prevalence: 0.45, role: 'MPAN; mitochondrial-membrane NBIA' },

  // ===== Shared core (between columns) =====
  { id: 'TFEB',      protein: 'TFEB (CLEAR network)',  disease: 'SHARED', prevalence: 0.90, role: 'master regulator of autophagy + lysosomal biogenesis', secondary: ['PD','AD','LSD'] },
  { id: 'MAP1LC3B',  protein: 'LC3',                   disease: 'SHARED', prevalence: 0.85, role: 'autophagosome marker; binds all selective autophagy receptors', secondary: ['PD','AD','ALS'] },
  { id: 'BECN1',     protein: 'Beclin-1',              disease: 'SHARED', prevalence: 0.55, role: 'autophagy initiator; decreased in AD', secondary: ['AD'] },
  { id: 'ATG7',      protein: 'ATG7 (E1)',             disease: 'SHARED', prevalence: 0.55, role: 'E1 for LC3 lipidation; required for autophagy' },
  { id: 'ULK1',      protein: 'ULK1 kinase',           disease: 'SHARED', prevalence: 0.50, role: 'autophagy initiator kinase; mTOR substrate' },
  // Mitophagy machinery, drawn near PD
  { id: 'TOMM20',    protein: 'TOMM20',                disease: 'SHARED', prevalence: 0.55, role: 'mitochondrial outer-membrane; PRKN ubiquitination substrate', secondary: ['PD'] },
  { id: 'USP30',     protein: 'USP30 (DUB)',           disease: 'SHARED', prevalence: 0.55, role: 'opposes PRKN; small-molecule PD target', secondary: ['PD'] },
  { id: 'MFN2',      protein: 'mitofusin 2',           disease: 'SHARED', prevalence: 0.55, role: 'PRKN substrate; CMT2A; mitochondrial fusion', secondary: ['PD'] },
  // Tau kinases, near MAPT
  { id: 'GSK3B',     protein: 'GSK3β',                 disease: 'SHARED', prevalence: 0.55, role: 'dominant tau kinase; lithium target', secondary: ['AD'] },
  { id: 'CDK5',      protein: 'CDK5',                  disease: 'SHARED', prevalence: 0.45, role: 'tau hyperphosphorylation; p25/p35', secondary: ['AD'] },
  // Secretases, near APP
  { id: 'BACE1',     protein: 'β-secretase',           disease: 'SHARED', prevalence: 0.65, role: 'rate-limiting Aβ generation', secondary: ['AD'] },
  { id: 'ADAM10',    protein: 'α-secretase',           disease: 'SHARED', prevalence: 0.50, role: 'non-amyloidogenic APP cleavage', secondary: ['AD'] },
  // LRRK2 substrates, near LRRK2
  { id: 'RAB10',     protein: 'Rab10',                 disease: 'SHARED', prevalence: 0.40, role: 'LRRK2 substrate; biomarker', secondary: ['PD'] },
  { id: 'RAB29',     protein: 'Rab29',                 disease: 'SHARED', prevalence: 0.35, role: 'PARK16; LRRK2 activator at Golgi', secondary: ['PD'] },
  // Microglia/AD risk
  { id: 'TYROBP',    protein: 'DAP12',                 disease: 'SHARED', prevalence: 0.40, role: 'TREM2 signalling partner', secondary: ['AD'] },
  { id: 'PLCG2',     protein: 'PLCγ2',                 disease: 'SHARED', prevalence: 0.40, role: 'P522R is AD-protective; downstream of TREM2', secondary: ['AD'] },
  // FTD modifiers
  { id: 'TMEM106B',  protein: 'TMEM106B',              disease: 'SHARED', prevalence: 0.45, role: 'FTD-TDP risk modifier; lysosomal', secondary: ['ALS','LSD'] },
];

/**
 * Edges encode real biological relationships.
 * kind: 'kinase-substrate' | 'receptor-ligand' | 'complex' | 'modifier' |
 *       'shared-mechanism' | 'shared-disease' | 'opposes'
 * Lines colour-encode `kind`; line weight encodes `strength` (0–1).
 */
export const EDGES = [
  // --- PD intra-cluster: mitophagy pathway ---
  { from: 'PINK1', to: 'PRKN', kind: 'kinase-substrate', strength: 1.0,
    note: 'PINK1 stabilises on the outer mitochondrial membrane of depolarised mitochondria and phosphorylates both ubiquitin (Ser65) and Parkin (Ser65 of UBL domain), recruiting and activating Parkin for mitophagy.',
    pmids: ['18957282', '20126261', '24784582'] },
  { from: 'PRKN', to: 'TOMM20', kind: 'kinase-substrate', strength: 0.9,
    note: 'Parkin ubiquitinates outer-mitochondrial-membrane proteins including TOMM20 (and TOMM70, MFN1/2, MIRO, VDAC) to flag damaged mitochondria for selective autophagy.',
    pmids: ['23478623', '25527291'] },
  { from: 'PRKN', to: 'MFN2', kind: 'kinase-substrate', strength: 0.8,
    note: 'Parkin ubiquitinates mitofusin 2, promoting its proteasomal degradation and preventing fusion of damaged mitochondria with the healthy network.',
    pmids: ['20194754', '22441075'] },
  { from: 'USP30', to: 'PRKN', kind: 'opposes', strength: 0.8,
    note: 'USP30 is a mitochondrial-anchored deubiquitinase that removes Parkin-deposited ubiquitin from outer-membrane substrates, antagonising mitophagy; small-molecule USP30 inhibitors are in clinical development for PD.',
    pmids: ['24784582', '32641836'] },
  { from: 'PINK1', to: 'TOMM20', kind: 'complex', strength: 0.6,
    note: 'PINK1 is imported through the TOM (translocase of outer membrane) complex; loss of mitochondrial potential arrests PINK1 import, leaving it stabilised on the OMM in association with TOM.',
    pmids: ['23620051'] },

  // --- PD ↔ Lysosomal axis ---
  { from: 'GBA', to: 'SNCA', kind: 'shared-mechanism', strength: 1.0,
    note: 'GBA deficiency raises glucosylceramide and glucosylsphingosine in the lysosome, which promotes α-synuclein aggregation; conversely, α-synuclein impairs lysosomal trafficking of GBA — a bidirectional positive-feedback loop central to GBA-PD.',
    pmids: ['21376232', '22995991'] },
  { from: 'GBA', to: 'SCARB2', kind: 'receptor-ligand', strength: 0.9,
    note: 'SCARB2 (LIMP-2) binds GBA in the ER and traffics it to the lysosome through a mannose-6-phosphate-independent route; loss of SCARB2 phenocopies GBA deficiency.',
    pmids: ['17576406'] },
  { from: 'ATP13A2', to: 'GBA', kind: 'shared-mechanism', strength: 0.6,
    note: 'Both ATP13A2 and GBA reside in the lysosomal membrane and link PD to lysosomal-storage biology; ATP13A2 loss perturbs lysosomal function and α-synuclein clearance.',
    pmids: ['19297385'] },
  { from: 'NPC1', to: 'SNCA', kind: 'shared-mechanism', strength: 0.5,
    note: 'NPC1 deficiency disturbs cholesterol-cholesterol egress from late endosomes/lysosomes and accelerates α-synuclein accumulation; NPC1 variants modify PD risk.',
    pmids: ['28391999'] },

  // --- AD intra-cluster: APP processing & tau ---
  { from: 'APP', to: 'PSEN1', kind: 'kinase-substrate', strength: 1.0,
    note: 'PSEN1 forms the catalytic core of γ-secretase, which cleaves APP-CTFβ (and APP-CTFα) within the transmembrane domain to liberate Aβ; >300 EOFAD mutations skew Aβ42:Aβ40 ratio.',
    pmids: ['8589722', '10380829'] },
  { from: 'APP', to: 'PSEN2', kind: 'kinase-substrate', strength: 0.7,
    note: 'PSEN2 is the paralog of PSEN1 in γ-secretase; loss of PSEN1 + PSEN2 abolishes Aβ generation; PSEN2 variants cause rarer EOFAD.',
    pmids: ['7651536'] },
  { from: 'APP', to: 'BACE1', kind: 'kinase-substrate', strength: 1.0,
    note: 'BACE1 (β-secretase) cleaves APP at the N-terminus of the Aβ peptide — the rate-limiting step of Aβ generation and a major AD drug target (although BACE1 inhibitors have struggled clinically).',
    pmids: ['10550054', '10440912'] },
  { from: 'APP', to: 'ADAM10', kind: 'kinase-substrate', strength: 0.8,
    note: 'ADAM10 is the principal α-secretase, cleaving APP within the Aβ domain and precluding amyloidogenic processing; ADAM10 loss-of-function variants raise late-onset AD risk.',
    pmids: ['20805557'] },
  { from: 'APP', to: 'MAPT', kind: 'shared-mechanism', strength: 1.0,
    note: 'Aβ accumulation upstream triggers tau hyperphosphorylation and tangle formation downstream — the "amyloid cascade hypothesis"; mouse models show Aβ-induced deficits require tau.',
    pmids: ['1346171', '17110625'] },
  { from: 'MAPT', to: 'GSK3B', kind: 'kinase-substrate', strength: 0.9,
    note: 'GSK3β is the dominant in vivo tau kinase, phosphorylating Ser199/Ser202/Thr205 (AT8 epitope), Thr231, Ser396/404 (PHF1 epitope); lithium (GSK3 inhibitor) was tested as AD therapy.',
    pmids: ['1370478', '12473658'] },
  { from: 'MAPT', to: 'CDK5', kind: 'kinase-substrate', strength: 0.75,
    note: 'CDK5 phosphorylates tau at multiple sites and is itself deregulated in AD by calpain-mediated cleavage of its activator p35 to the longer-lived p25.',
    pmids: ['10440919'] },
  { from: 'APOE', to: 'MAPT', kind: 'modifier', strength: 0.8,
    note: 'ApoE4 markedly exacerbates tau-mediated neurodegeneration independent of Aβ in P301S tauopathy mice; ApoE2 is protective. APOE genotype modifies tau biology at the level of microglial response.',
    pmids: ['28902845'] },
  { from: 'APOE', to: 'CLU', kind: 'shared-mechanism', strength: 0.6,
    note: 'APOE and clusterin (APOJ) are both lipoprotein-pathway AD risk genes; both bind soluble Aβ and modulate clearance.',
    pmids: ['19734903'] },
  { from: 'APOE', to: 'TREM2', kind: 'shared-mechanism', strength: 0.7,
    note: 'ApoE is a TREM2 ligand; TREM2-ApoE signalling drives the disease-associated microglia (DAM) transcriptional state observed in AD models.',
    pmids: ['29795258'] },
  { from: 'TREM2', to: 'TYROBP', kind: 'complex', strength: 0.95,
    note: 'TREM2 lacks a cytoplasmic signalling tail and pairs with TYROBP (DAP12), an ITAM-bearing adaptor; loss of either causes Nasu-Hakola disease; AD-risk variants disrupt the TREM2-DAP12 partnership.',
    pmids: ['9438864', '23150934'] },
  { from: 'TREM2', to: 'PLCG2', kind: 'kinase-substrate', strength: 0.7,
    note: 'PLCγ2 lies downstream of TREM2-DAP12 in microglia; the P522R variant is hyperactive and protective for AD.',
    pmids: ['28855639'] },
  { from: 'SORL1', to: 'APP', kind: 'complex', strength: 0.7,
    note: 'SORL1 binds APP and retains it in the trans-Golgi network, reducing β-secretase access; loss-of-function SORL1 variants raise AD risk by increasing APP-BACE1 encounters.',
    pmids: ['17220890'] },
  { from: 'BIN1', to: 'APP', kind: 'shared-mechanism', strength: 0.5,
    note: 'BIN1 modulates APP via endocytic trafficking; the AD-risk allele increases BIN1 expression in microglia.',
    pmids: ['21532579'] },

  // --- ALS/FTD intra-cluster ---
  { from: 'TARDBP', to: 'FUS', kind: 'shared-mechanism', strength: 0.9,
    note: 'TDP-43 and FUS are both nuclear RNA-binding proteins with prion-like low-complexity domains; both undergo aberrant phase separation, cytoplasmic mislocalisation, and aggregation in ALS/FTD; mutations cluster in their LCDs.',
    pmids: ['18309045', '19251627', '19251628'] },
  { from: 'TBK1', to: 'OPTN', kind: 'kinase-substrate', strength: 1.0,
    note: 'TBK1 phosphorylates optineurin at Ser177 to promote LC3 binding and selective autophagy; loss-of-function TBK1 mutations cause ALS/FTD by impairing this axis.',
    pmids: ['21862730', '26077916'] },
  { from: 'TBK1', to: 'SQSTM1', kind: 'kinase-substrate', strength: 0.85,
    note: 'TBK1 phosphorylates p62/SQSTM1 at Ser403 to enhance ubiquitin-chain affinity and drive selective autophagy of ubiquitinated cargo.',
    pmids: ['22980326'] },
  { from: 'GRN', to: 'TMEM106B', kind: 'modifier', strength: 0.8,
    note: 'TMEM106B variants modify FTD-TDP risk in GRN mutation carriers; TMEM106B is itself a lysosomal membrane protein that recently was shown to form amyloid filaments in aging brain.',
    pmids: ['20154673', '35344984'] },
  { from: 'C9orf72', to: 'ATXN2', kind: 'shared-mechanism', strength: 0.7,
    note: 'Repeat-expansion biology connects C9orf72 and ATXN2; intermediate-length ATXN2 expansions raise ALS risk and modify C9-ALS clinical course.',
    pmids: ['20740007'] },

  // --- HD / polyQ intra-cluster ---
  { from: 'HTT', to: 'MSH3', kind: 'modifier', strength: 0.9,
    note: 'MSH3 (a component of MutSβ mismatch-repair) drives somatic CAG expansion in HTT in vulnerable striatal neurons; HD age-of-onset GWAS identified MSH3 as a top modifier locus.',
    pmids: ['26073603', '31398342'] },
  { from: 'HTT', to: 'FAN1', kind: 'modifier', strength: 0.8,
    note: 'FAN1 nuclease activity suppresses somatic CAG-repeat instability in HTT; FAN1 protein-coding variants are HD age-of-onset modifiers.',
    pmids: ['31279304'] },
  { from: 'ATXN1', to: 'ATXN3', kind: 'shared-mechanism', strength: 0.7,
    note: 'Spinocerebellar ataxia polyQ family — same disease mechanism (toxic polyglutamine expansion), different host protein, different brain-region vulnerability.',
    pmids: ['8589716'] },
  { from: 'ATXN2', to: 'ATXN3', kind: 'shared-mechanism', strength: 0.7,
    note: 'polyQ ataxia family.',
    pmids: ['8896560'] },
  { from: 'AR', to: 'HTT', kind: 'shared-mechanism', strength: 0.55,
    note: 'Both diseases (Kennedy disease and Huntington disease) caused by polyQ-expansion gain-of-function; share aggregation biology and transcriptional dysregulation.',
    pmids: ['1671351'] },

  // --- Cross-disease bridges ---
  { from: 'SNCA', to: 'MAPT', kind: 'shared-disease', strength: 0.9,
    note: 'α-synuclein and tau form co-pathology in Lewy body dementia and AD with Lewy bodies; α-syn cross-seeds tau aggregation in vitro; MAPT H1 haplotype is a GWAS-confirmed PD risk factor.',
    pmids: ['12700288', '24336809'] },
  { from: 'LRRK2', to: 'MAPT', kind: 'shared-disease', strength: 0.5,
    note: 'LRRK2 G2019S PD shows variable tau pathology at autopsy; LRRK2 phosphorylates tau in vitro; MAPT H1 may further modify LRRK2 penetrance.',
    pmids: ['20186829'] },
  { from: 'ATXN2', to: 'TARDBP', kind: 'modifier', strength: 0.85,
    note: 'ATXN2 intermediate-length polyQ expansions (27-33 Q) are an established ALS risk factor; ATXN2 modifies TDP-43 toxicity in flies and mice.',
    pmids: ['20740007', '23878411'] },
  { from: 'C9orf72', to: 'MAPT', kind: 'shared-disease', strength: 0.3,
    note: 'Rare C9orf72-FTD cases show tau co-pathology; primarily a TDP-43 proteinopathy.',
    pmids: ['22154671'] },
  { from: 'GRN', to: 'MAPT', kind: 'shared-disease', strength: 0.55,
    note: 'GRN and MAPT mutations both cause familial frontotemporal dementia but with different proteinopathies (TDP-43 vs tau); they cluster at chr17 and were initially thought to be the same locus.',
    pmids: ['16862115'] },

  // --- TFEB hub: connects PD, AD, LSD ---
  { from: 'TFEB', to: 'SNCA', kind: 'shared-mechanism', strength: 0.7,
    note: 'TFEB activation by mTOR inhibition enhances autophagic clearance of α-synuclein; TFEB overexpression rescues α-syn-induced neurodegeneration in rodent PD models.',
    pmids: ['23396324'] },
  { from: 'TFEB', to: 'APP', kind: 'shared-mechanism', strength: 0.7,
    note: 'TFEB activation reduces Aβ accumulation by inducing lysosomal/autophagic clearance and the Aβ-degrading enzyme neprilysin.',
    pmids: ['23633420'] },
  { from: 'TFEB', to: 'MAPT', kind: 'shared-mechanism', strength: 0.6,
    note: 'TFEB activation promotes clearance of phosphorylated tau via lysosomal autophagy; tested as a tauopathy strategy.',
    pmids: ['25025643'] },
  { from: 'TFEB', to: 'GBA', kind: 'shared-mechanism', strength: 0.7,
    note: 'GBA is a direct CLEAR-network target of TFEB; TFEB activation raises GBA expression and rescues GBA-deficient phenotypes — a therapeutic angle for GBA-PD.',
    pmids: ['19556463', '29117437'] },
  { from: 'TFEB', to: 'HTT', kind: 'shared-mechanism', strength: 0.5,
    note: 'PGC-1α / TFEB axis activation clears mutant huntingtin aggregates in cells and HD mouse models.',
    pmids: ['22610505'] },
  { from: 'TFEB', to: 'NPC1', kind: 'shared-mechanism', strength: 0.6,
    note: 'TFEB induction rescues cholesterol accumulation and other lysosomal-storage phenotypes in NPC1-deficient cells.',
    pmids: ['21646416'] },

  // --- LC3 hub ---
  { from: 'MAP1LC3B', to: 'SQSTM1', kind: 'receptor-ligand', strength: 0.9,
    note: 'p62/SQSTM1 binds LC3 via its LIR (LC3-interacting region) and ubiquitinated cargo via its UBA domain — the canonical selective-autophagy receptor.',
    pmids: ['17580304'] },
  { from: 'MAP1LC3B', to: 'OPTN', kind: 'receptor-ligand', strength: 0.9,
    note: 'OPTN binds LC3 via its LIR; binding is enhanced by TBK1-mediated Ser177 phosphorylation; mediates selective autophagy of damaged mitochondria (mitophagy) and ubiquitinated bacteria (xenophagy).',
    pmids: ['21862730', '26365380'] },
  { from: 'MAP1LC3B', to: 'TOMM20', kind: 'shared-mechanism', strength: 0.6,
    note: 'LC3 is recruited to ubiquitinated outer-mitochondrial-membrane proteins (including TOMM20) via autophagy adaptors p62, OPTN, NDP52, NBR1 during mitophagy.',
    pmids: ['25527291'] },
  { from: 'MAP1LC3B', to: 'ATG7', kind: 'kinase-substrate', strength: 1.0,
    note: 'ATG7 is the E1-like activating enzyme for the ubiquitin-like LC3 conjugation system; loss of ATG7 abolishes LC3 lipidation and autophagy.',
    pmids: ['16625204'] },
  { from: 'MAP1LC3B', to: 'BECN1', kind: 'shared-mechanism', strength: 0.7,
    note: 'BECN1 (Beclin-1) within the class-III PI3K complex initiates autophagosome biogenesis upstream of LC3 conjugation.',
    pmids: ['15525642'] },
  { from: 'MAP1LC3B', to: 'ULK1', kind: 'shared-mechanism', strength: 0.6,
    note: 'ULK1 kinase complex initiates autophagy under mTOR inhibition; LC3 lipidation is downstream.',
    pmids: ['19258318'] },
  { from: 'WDR45', to: 'MAP1LC3B', kind: 'complex', strength: 0.6,
    note: 'WDR45 (WIPI4) binds PI3P generated by class-III PI3K and recruits the LC3 conjugation machinery; WDR45 loss-of-function causes BPAN.',
    pmids: ['23435086'] },

  // --- LRRK2 substrate edges ---
  { from: 'LRRK2', to: 'RAB10', kind: 'kinase-substrate', strength: 1.0,
    note: 'LRRK2 phosphorylates a subset of Rab GTPases (Rab8A, Rab10, Rab12, Rab29) at the Switch-II threonine; phospho-Rab10 is the leading peripheral biomarker of LRRK2 activity.',
    pmids: ['26824392'] },
  { from: 'LRRK2', to: 'RAB29', kind: 'shared-mechanism', strength: 0.8,
    note: 'Rab29 recruits and activates LRRK2 at the trans-Golgi network; PARK16 locus harbours Rab29.',
    pmids: ['27353408'] },

  // --- NBIA cluster ---
  { from: 'WDR45', to: 'PLA2G6', kind: 'shared-disease', strength: 0.6,
    note: 'Both NBIA (neurodegeneration with brain iron accumulation) subtypes — BPAN and PLAN respectively.',
    pmids: ['23435086'] },
  { from: 'PANK2', to: 'PLA2G6', kind: 'shared-disease', strength: 0.6,
    note: 'PKAN (PANK2) and PLAN (PLA2G6) — the two best-characterised NBIA subtypes.',
    pmids: ['11528394'] },
  { from: 'C19orf12', to: 'PANK2', kind: 'shared-disease', strength: 0.5,
    note: 'MPAN (C19orf12) and PKAN (PANK2) — both NBIA syndromes with distinctive MRI iron-accumulation patterns.',
    pmids: ['21981780'] },

  // --- Lysosomal cluster ---
  { from: 'NPC1', to: 'NPC2', kind: 'complex', strength: 0.9,
    note: 'NPC2 is the soluble cholesterol-binding partner that hands off unesterified cholesterol to NPC1 for egress from late endosomes/lysosomes; mutations in either cause Niemann-Pick disease type C.',
    pmids: ['18599788'] },
  { from: 'HEXA', to: 'GALC', kind: 'shared-mechanism', strength: 0.5,
    note: 'Both lysosomal glycosphingolipid hydrolases; deficiency causes Tay-Sachs and Krabbe respectively; both can present with progressive motor regression.',
    pmids: ['12601565'] },
];

export const EDGE_COLORS = {
  'kinase-substrate':  '#0b3b5a',
  'receptor-ligand':   '#7c3aed',
  'complex':           '#15803d',
  'modifier':          '#b45309',
  'shared-mechanism':  '#6a7787',
  'shared-disease':    '#dc2626',
  'opposes':           '#b91c1c',
};

export const EDGE_LEGEND = [
  { kind: 'kinase-substrate', label: 'kinase / substrate' },
  { kind: 'receptor-ligand',  label: 'receptor / ligand' },
  { kind: 'complex',          label: 'complex partner' },
  { kind: 'modifier',         label: 'genetic modifier' },
  { kind: 'shared-mechanism', label: 'shared mechanism' },
  { kind: 'shared-disease',   label: 'shared disease pathology' },
  { kind: 'opposes',          label: 'opposes / antagonist' },
];
