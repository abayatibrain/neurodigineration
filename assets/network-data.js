// Cross-disease neurodegeneration network — curated relationship graph.
//
// Each node represents a gene/protein from the neurodigineration panel. `prevalence`
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
// Coverage as of Round 5: ~204 nodes and ~273 edges across 11 disease groups
// (PD, AD, ALS/FTD, HD/polyQ, Prion, Lysosomal storage, NBIA, Tauopathy
// PSP/CBD/FTLD-tau, HSP, CMT, and a Shared core for the cross-cutting
// machinery — autophagy, mitophagy, secretases, microglial axis, complement,
// SNARE/SV, stress granules, ER-mitochondria contacts, lipid metabolism).
// Of the 273 edges, ~79 are marked `tentative: true` (rendered dotted) —
// flagged as candidates for SME validation rather than load-bearing claims.

export const DISEASES = {
  PD:    { name: "Parkinson's",      short: 'PD',    color: '#0b3b5a', soft: '#e6eef5' },
  AD:    { name: "Alzheimer's",      short: 'AD',    color: '#7c3aed', soft: '#f3eaff' },
  ALS:   { name: 'ALS / FTD',        short: 'ALS',   color: '#dc2626', soft: '#fee2e2' },
  HD:    { name: 'Huntington/polyQ', short: 'HD',    color: '#b45309', soft: '#fff7d6' },
  PRION: { name: 'Prion',            short: 'PRP',   color: '#0891b2', soft: '#cffafe' },
  LSD:   { name: 'Lysosomal storage',short: 'LSD',   color: '#15803d', soft: '#dcfce7' },
  NBIA:  { name: 'NBIA',             short: 'NBIA',  color: '#6b21a8', soft: '#ede9fe' },
  TAU:   { name: 'Tauopathy (PSP/CBD/FTLD-tau)', short: 'TAU', color: '#4338ca', soft: '#e0e7ff' },
  HSP:   { name: 'Hereditary spastic paraplegia', short: 'HSP', color: '#0e7490', soft: '#cffafe' },
  CMT:   { name: 'Charcot-Marie-Tooth',           short: 'CMT', color: '#9a3412', soft: '#fed7aa' },
  SHARED:{ name: 'Shared core',      short: '·',    color: '#6a7787', soft: '#f0f4f8' },
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

  // ===== Lysosomal storage / lysosomal homeostasis (expanded) =====
  { id: 'LAMP1',  protein: 'LAMP-1',                disease: 'LSD', prevalence: 0.55, role: 'abundant lysosomal membrane glycoprotein; CLEAR target; the canonical lysosomal marker' },
  { id: 'LAMP2',  protein: 'LAMP-2',                disease: 'LSD', prevalence: 0.70, role: 'Danon disease (X-linked) when lost; receptor for chaperone-mediated autophagy (CMA)', secondary: ['SHARED'] },
  { id: 'CTSD',   protein: 'cathepsin D',           disease: 'LSD', prevalence: 0.70, role: 'CLN10 (congenital NCL); processes α-syn, APP; major lysosomal aspartyl protease', secondary: ['PD','AD'] },
  { id: 'CTSB',   protein: 'cathepsin B',           disease: 'LSD', prevalence: 0.55, role: 'lysosomal cysteine protease; tau cleavage to aggregation-prone fragments; Aβ regulation', secondary: ['AD'] },
  { id: 'TPP1',   protein: 'TPP1 / CLN2',           disease: 'LSD', prevalence: 0.65, role: 'tripeptidyl peptidase 1; late-infantile NCL (Batten CLN2); cerliponase alfa is approved ERT' },
  { id: 'CLN3',   protein: 'CLN3 / battenin',       disease: 'LSD', prevalence: 0.60, role: 'juvenile NCL (classic Batten disease); endolysosomal membrane protein' },
  { id: 'IDUA',   protein: 'α-L-iduronidase',       disease: 'LSD', prevalence: 0.55, role: 'mucopolysaccharidosis type I (Hurler/Scheie); glycosaminoglycan degradation' },
  { id: 'CTNS',   protein: 'cystinosin',            disease: 'LSD', prevalence: 0.55, role: 'lysosomal cystine transporter; cystinosis when lost; CLEAR-network target' },

  // ===== Mitochondrial machinery (expanded — beyond mitophagy effectors) =====
  { id: 'VDAC1',  protein: 'VDAC1 / porin',         disease: 'SHARED', prevalence: 0.55, role: 'outer-mitochondrial-membrane voltage-dependent anion channel; major PRKN ubiquitination substrate during mitophagy', secondary: ['PD'] },
  { id: 'OPA1',   protein: 'OPA1 GTPase',           disease: 'SHARED', prevalence: 0.65, role: 'inner-mitochondrial-membrane fusion + cristae shaping; loss causes autosomal-dominant optic atrophy', secondary: ['PD'] },
  { id: 'PARL',   protein: 'PARL rhomboid protease',disease: 'SHARED', prevalence: 0.55, role: 'inner-membrane intramembrane protease; cleaves PINK1 to set its turnover threshold for mitophagy initiation', secondary: ['PD'] },
  { id: 'TFAM',   protein: 'mt transcription factor A', disease: 'SHARED', prevalence: 0.50, role: 'packages and transcribes mitochondrial DNA; required for mtDNA copy-number maintenance' },
  { id: 'POLG',   protein: 'mt DNA polymerase γ',   disease: 'SHARED', prevalence: 0.65, role: 'mtDNA replication; Alpers syndrome, PEO; mtDNA depletion/deletion disorders', secondary: ['HD'] },
  { id: 'SPG7',   protein: 'paraplegin (SPG7)',     disease: 'SHARED', prevalence: 0.55, role: 'm-AAA inner-membrane protease subunit; hereditary spastic paraplegia type 7; processes OPA1' },
  { id: 'TOMM70', protein: 'TOMM70 / TOM70',        disease: 'SHARED', prevalence: 0.45, role: 'outer-membrane import receptor; brings PINK1 to TOM complex; recognises C-terminal mitochondrial signals', secondary: ['PD'] },
  { id: 'NDUFS1', protein: 'Complex I (NDUFS1)',    disease: 'SHARED', prevalence: 0.50, role: 'core subunit of mitochondrial Complex I; biallelic loss causes Leigh syndrome; complex-I deficiency in PD substantia nigra' },

  // ===== Round 4 — tangential expansion (dotted edges; pending SME validation) =====
  // Synaptic vesicle / SNARE
  { id: 'SYT1',    protein: 'synaptotagmin-1', disease: 'SHARED', prevalence: 0.45, role: 'Ca²⁺ sensor for SV fusion; binds αSyn and the SNARE complex', secondary: ['PD'] },
  { id: 'STX1A',   protein: 'syntaxin-1A',     disease: 'SHARED', prevalence: 0.40, role: 't-SNARE; assembles with VAMP2 + SNAP25', secondary: ['PD'] },
  { id: 'SNAP25',  protein: 'SNAP-25',         disease: 'SHARED', prevalence: 0.55, role: 't-SNARE; reduced in AD presynapses', secondary: ['AD','PD'] },
  { id: 'VAMP2',   protein: 'synaptobrevin-2', disease: 'SHARED', prevalence: 0.45, role: 'v-SNARE on SVs; bound by αSyn', secondary: ['PD'] },
  { id: 'SYP',     protein: 'synaptophysin',   disease: 'SHARED', prevalence: 0.55, role: 'abundant SV marker; early loss in AD', secondary: ['AD'] },
  { id: 'SV2A',    protein: 'SV2A',            disease: 'SHARED', prevalence: 0.45, role: 'universal SV marker; PET biomarker of synaptic density' },
  // PSD scaffolds + glutamate receptors
  { id: 'DLG4',    protein: 'PSD-95',          disease: 'SHARED', prevalence: 0.55, role: 'postsynaptic scaffold; anchors NMDA/AMPA', secondary: ['ALS','AD'] },
  { id: 'GRIN1',   protein: 'NMDA-R GluN1',    disease: 'SHARED', prevalence: 0.45, role: 'obligate NMDA-R subunit; Aβ-driven endocytosis', secondary: ['AD'] },
  { id: 'GRIA1',   protein: 'AMPA-R GluA1',    disease: 'SHARED', prevalence: 0.40, role: 'AMPA subunit; trafficking affected by Aβ-PrPc', secondary: ['AD'] },
  { id: 'HOMER1',  protein: 'Homer-1',         disease: 'SHARED', prevalence: 0.40, role: 'PSD scaffold linking mGluRs to IP3R' },
  // Mitochondrial fission receptors
  { id: 'FIS1',    protein: 'Fis1',            disease: 'SHARED', prevalence: 0.40, role: 'OMM DRP1 receptor; recruited by Aβ in AD', secondary: ['AD','PD'] },
  { id: 'MFF',     protein: 'MFF',             disease: 'SHARED', prevalence: 0.45, role: 'primary DRP1 receptor; AMPK-regulated', secondary: ['AD'] },
  { id: 'MIEF1',   protein: 'MID49',           disease: 'SHARED', prevalence: 0.40, role: 'DRP1 receptor co-recruiting MFF' },
  // DA-neuron axis
  { id: 'TH',      protein: 'tyrosine hydroxylase', disease: 'PD', prevalence: 0.85, role: 'rate-limiting dopamine synthesis enzyme; biochemical signature lost in PD substantia nigra' },
  { id: 'SLC6A3',  protein: 'DAT',             disease: 'PD',  prevalence: 0.70, role: 'dopamine transporter; the DAT-SPECT imaging target' },
  { id: 'SLC18A2', protein: 'VMAT2',           disease: 'PD',  prevalence: 0.55, role: 'vesicular monoamine transporter; reduced in PD' },
  // AD LOAD GWAS
  { id: 'PICALM',  protein: 'PICALM',          disease: 'AD',  prevalence: 0.55, role: 'consistent LOAD GWAS hit; clathrin assembly + endocytosis' },
  { id: 'CD2AP',   protein: 'CD2AP',           disease: 'AD',  prevalence: 0.45, role: 'LOAD GWAS hit; endocytic adaptor; APP processing' },
  { id: 'TOMM40',  protein: 'TOM40',           disease: 'AD',  prevalence: 0.50, role: 'OMM channel; chr19 next to APOE; confounded AD risk', secondary: ['SHARED'] },
  // ALS extension
  { id: 'UBQLN2',  protein: 'ubiquilin-2',     disease: 'ALS', prevalence: 0.55, role: 'X-linked ALS/FTD; ubiquitin shuttle' },
  { id: 'KIF5A',   protein: 'kinesin-5A',      disease: 'ALS', prevalence: 0.55, role: 'anterograde axonal motor; ALS25 + HSP10' },
  { id: 'ANG',     protein: 'angiogenin',      disease: 'ALS', prevalence: 0.45, role: 'RNase A family; ALS9; tRNA-fragment biology' },
  { id: 'CHCHD10', protein: 'CHCHD10',         disease: 'ALS', prevalence: 0.50, role: 'mitochondrial IMS protein; ALS22/FTD' },
  // Autophagy core extensions
  { id: 'RB1CC1',  protein: 'FIP200',          disease: 'SHARED', prevalence: 0.55, role: 'ULK1-complex scaffold; loss abolishes neuronal autophagy' },
  { id: 'ATG12',   protein: 'ATG12',           disease: 'SHARED', prevalence: 0.50, role: 'ubiquitin-like; ATG12-ATG5 conjugate is the LC3-lipidation E3' },
  { id: 'ATG16L1', protein: 'ATG16L1',         disease: 'SHARED', prevalence: 0.50, role: 'recruits ATG12-ATG5 to phagophore' },
  { id: 'STX17',   protein: 'syntaxin-17',     disease: 'SHARED', prevalence: 0.55, role: 'autophagosome SNARE; fuses with LAMP1+ lysosomes via SNAP29 + VAMP8' },
  // Inflammation
  { id: 'NLRP3',   protein: 'NLRP3',           disease: 'SHARED', prevalence: 0.55, role: 'inflammasome sensor activated by Aβ + αSyn fibrils; drives chronic neuroinflammation', secondary: ['AD','PD'] },
  // Iron / NBIA
  { id: 'FTL',     protein: 'ferritin light',  disease: 'NBIA', prevalence: 0.55, role: 'iron storage; mutations cause neuroferritinopathy' },

  // ===== Round 3 — additions from Bayati & Chen review =====
  { id: 'CD63',    protein: 'CD63 (LAMP3)',         disease: 'LSD',    prevalence: 0.55, role: 'lysosomal/late-endosomal tetraspanin; LAMP family; PD-relevant lysosomal trafficking', secondary: ['PD'] },
  { id: 'TMEM175', protein: 'TMEM175 (lyso K+ channel)', disease: 'PD', prevalence: 0.65, role: 'lysosomal K+ channel; GWAS-identified PD risk locus; loss reduces lysosomal enzyme activity', secondary: ['LSD'] },
  { id: 'UBE3A',   protein: 'E6-AP ubiquitin ligase', disease: 'SHARED', prevalence: 0.55, role: 'E3 ligase; loss causes Angelman syndrome; central to synaptic UPS turnover' },
  { id: 'ATG9A',   protein: 'ATG9A scramblase',     disease: 'SHARED', prevalence: 0.50, role: 'only multi-spanning membrane ATG protein; lipid scramblase; mislocalised by αSyn impairs autophagy', secondary: ['PD'] },
  { id: 'RAB1A',   protein: 'Rab1A GTPase',         disease: 'SHARED', prevalence: 0.45, role: 'ER-Golgi + autophagosome biogenesis; mislocalised by αSyn aggregates', secondary: ['PD'] },
  { id: 'C1QA',    protein: 'complement C1qA',      disease: 'SHARED', prevalence: 0.55, role: 'complement tag for microglial phagocytosis; drives synaptic pruning in AD', secondary: ['AD'] },
  { id: 'C3',      protein: 'complement C3',        disease: 'SHARED', prevalence: 0.55, role: 'downstream of C1q; opsonises synapses for microglial removal', secondary: ['AD'] },
  { id: 'ATP6V0A1',protein: 'V-ATPase V0a1',        disease: 'SHARED', prevalence: 0.50, role: 'lysosomal proton pump subunit; PSEN1 mutations disrupt its assembly in familial AD', secondary: ['AD','LSD'] },
  { id: 'SLC1A2',  protein: 'EAAT2 / GLT-1',        disease: 'SHARED', prevalence: 0.55, role: 'astrocytic glutamate transporter; lost expression in HD/ALS astrocytes drives excitotoxicity', secondary: ['HD','ALS'] },

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

  // ============================================================
  // Round 5 — major expansion. ~75 new genes spanning recessive/atypical PD,
  // LOAD GWAS microglial axis, ALS/FTD extensions, pure tauopathies (PSP/CBD/
  // FTLD-tau), hereditary spastic paraplegias, Charcot-Marie-Tooth, polyQ SCAs,
  // additional lysosomal storage hydrolases, mitochondrial cristae/MICOS,
  // stress-granule biology, lipid metabolism, and microglial markers.
  // All edges from this batch are pending SME validation; marked tentative
  // (dotted) where the literature is suggestive rather than mechanistic.
  // ============================================================

  // ===== Atypical / recessive / juvenile PD =====
  { id: 'VPS13C',  protein: 'VPS13C',                 disease: 'PD',  prevalence: 0.45, role: 'PARK23 — recessive early-onset PD; lipid-transfer protein at ER-mitochondria contacts; PINK1-mitophagy modulator', secondary: ['SHARED'] },
  { id: 'SYNJ1',   protein: 'synaptojanin-1',          disease: 'PD',  prevalence: 0.45, role: 'PARK20 — recessive juvenile-onset PD; PI(4,5)P2 phosphatase; synaptic-vesicle endocytosis', secondary: ['SHARED'] },
  { id: 'FBXO7',   protein: 'FBXO7',                   disease: 'PD',  prevalence: 0.45, role: 'PARK15 — recessive pallido-pyramidal syndrome; SCF E3 ligase substrate-receptor; PRKN partner in mitophagy', secondary: ['SHARED'] },
  { id: 'HTRA2',   protein: 'HtrA2 / Omi',             disease: 'PD',  prevalence: 0.35, role: 'PARK13 — mitochondrial serine protease in the intermembrane space; mitochondrial QC; controversial PD link', secondary: ['SHARED'] },
  { id: 'GIGYF2',  protein: 'GIGYF2',                  disease: 'PD',  prevalence: 0.30, role: 'PARK11 — translational repressor with 4EHP; protein-quality-control link to PD' },
  { id: 'EIF4G1',  protein: 'eIF4G1',                  disease: 'PD',  prevalence: 0.30, role: 'PARK18 — translation initiation factor; rare AD-onset PD' },
  { id: 'GCH1',    protein: 'GTP cyclohydrolase 1',    disease: 'PD',  prevalence: 0.55, role: 'dopa-responsive dystonia (Segawa); also identified as a PD risk gene; rate-limiting for BH4 → TH cofactor', secondary: ['SHARED'] },
  { id: 'GBA2',    protein: 'non-lysosomal β-glucosidase', disease: 'PD', prevalence: 0.40, role: 'SPG46 / cerebellar ataxia; GBA paralog; modifies glucosylceramide pool that GBA processes', secondary: ['HSP','LSD'] },
  { id: 'DNAJC6',  protein: 'auxilin',                 disease: 'PD',  prevalence: 0.40, role: 'PARK19 — recessive juvenile PD; clathrin uncoating co-chaperone; vesicle recycling at the synapse' },
  { id: 'DNAJC13', protein: 'RME-8',                   disease: 'PD',  prevalence: 0.35, role: 'PARK21 — endosomal trafficking; retromer-adjacent (VPS35 axis)' },
  { id: 'CHCHD2',  protein: 'CHCHD2',                  disease: 'PD',  prevalence: 0.45, role: 'PARK22 — mitochondrial IMS twin CX9C protein; sister to CHCHD10; Lewy-body forming Asian-onset PD', secondary: ['ALS','SHARED'] },
  { id: 'LRRK1',   protein: 'LRRK1',                   disease: 'PD',  prevalence: 0.30, role: 'paralog of LRRK2; phosphorylates a distinct Rab subset (Rab7); osteopetrosis when lost; tangentially PD-implicated' },
  { id: 'SH3GL2',  protein: 'endophilin-A1',           disease: 'PD',  prevalence: 0.35, role: 'BAR-domain synaptic-endocytosis protein; LRRK2 phosphorylation substrate; PD GWAS' },
  { id: 'RIT2',    protein: 'RIT2',                    disease: 'PD',  prevalence: 0.30, role: 'small GTPase; PD GWAS; neuronal MAPK signalling' },

  // ===== AD — LOAD GWAS microglial axis + secretase + Aβ-degrading =====
  { id: 'ABCA7',   protein: 'ABCA7',                   disease: 'AD',  prevalence: 0.55, role: 'LOAD GWAS; lipid transporter; loss-of-function variants raise AD risk in multiple ancestries' },
  { id: 'ABCA1',   protein: 'ABCA1',                   disease: 'AD',  prevalence: 0.45, role: 'cholesterol efflux to APOE; ABCA1 agonists tested for AD; Tangier disease when lost' },
  { id: 'CR1',     protein: 'complement receptor 1',   disease: 'AD',  prevalence: 0.45, role: 'LOAD GWAS; binds C3b/C4b; microglial Aβ clearance', secondary: ['SHARED'] },
  { id: 'MS4A6A',  protein: 'MS4A6A',                  disease: 'AD',  prevalence: 0.40, role: 'LOAD GWAS — chr11 MS4A cluster; microglial expression; modulates soluble TREM2' },
  { id: 'INPP5D',  protein: 'SHIP1',                   disease: 'AD',  prevalence: 0.45, role: 'LOAD GWAS; microglial inhibitory phosphatase; opposes TREM2 signalling' },
  { id: 'SPI1',    protein: 'PU.1',                    disease: 'AD',  prevalence: 0.50, role: 'master microglial transcription factor; LOAD GWAS; expression-QTL drives AD risk' },
  { id: 'ABI3',    protein: 'ABI3',                    disease: 'AD',  prevalence: 0.40, role: 'LOAD GWAS rare-variant; microglial actin regulator; expressed in DAM state' },
  { id: 'MEF2C',   protein: 'MEF2C',                   disease: 'AD',  prevalence: 0.40, role: 'LOAD GWAS; MADS-box TF expressed in microglia and neurons; cognitive resilience' },
  { id: 'PTK2B',   protein: 'Pyk2',                    disease: 'AD',  prevalence: 0.40, role: 'LOAD GWAS; focal-adhesion-kinase family; Aβ-induced tau phosphorylation; synapse loss' },
  { id: 'MME',     protein: 'neprilysin',              disease: 'AD',  prevalence: 0.55, role: 'principal Aβ-degrading endopeptidase; declines with age; somatostatin-induced' },
  { id: 'IDE',     protein: 'insulin-degrading enzyme',disease: 'AD',  prevalence: 0.50, role: 'major soluble Aβ-degrading metallopeptidase; competes with insulin; AD-diabetes link' },
  { id: 'ECE1',    protein: 'endothelin-converting enzyme', disease: 'AD', prevalence: 0.40, role: 'membrane metallopeptidase; cleaves Aβ; secondary to neprilysin' },
  { id: 'NCSTN',   protein: 'nicastrin',               disease: 'AD',  prevalence: 0.40, role: 'γ-secretase substrate-recognition subunit; partners with PSEN1/PSEN2/APH1/PEN-2' },
  { id: 'APH1A',   protein: 'APH-1A',                  disease: 'AD',  prevalence: 0.35, role: 'γ-secretase complex; required for assembly and stability of PSEN-NCSTN core' },

  // ===== ALS / FTD extension =====
  { id: 'VCP',     protein: 'VCP / p97',               disease: 'ALS', prevalence: 0.60, role: 'AAA+ ATPase; ALS14 / IBMPFD / multisystem proteinopathy; ubiquitin-dependent segregase; ERAD + autophagy' },
  { id: 'MATR3',   protein: 'matrin-3',                disease: 'ALS', prevalence: 0.45, role: 'ALS21 — nuclear matrix RNA/DNA-binding protein; partners with TDP-43' },
  { id: 'PFN1',    protein: 'profilin-1',              disease: 'ALS', prevalence: 0.40, role: 'ALS18 — actin-binding; mutations destabilise the cytoskeleton in motor axons' },
  { id: 'NEK1',    protein: 'NEK1 kinase',             disease: 'ALS', prevalence: 0.45, role: 'ALS24 — ciliary kinase; DNA-damage response; oligogenic risk modifier in ALS' },
  { id: 'SETX',    protein: 'senataxin',               disease: 'ALS', prevalence: 0.40, role: 'ALS4 / ataxia-AOA2; RNA/DNA helicase; resolves R-loops' },
  { id: 'ANXA11',  protein: 'annexin A11',             disease: 'ALS', prevalence: 0.45, role: 'ALS23 — Ca²⁺-dependent phospholipid-binding; RNP granule tether to lysosomes for axonal transport' },
  { id: 'CCNF',    protein: 'cyclin F',                disease: 'ALS', prevalence: 0.40, role: 'ALS/FTD — SCF E3 ligase substrate receptor; mutations stabilise TDP-43' },
  { id: 'CHMP2B',  protein: 'CHMP2B',                  disease: 'ALS', prevalence: 0.40, role: 'FTD3 — ESCRT-III subunit; endosomal sorting; autophagosome maturation' },
  { id: 'VAPB',    protein: 'VAPB',                    disease: 'ALS', prevalence: 0.40, role: 'ALS8 — ER membrane MSP-domain protein; ER-mitochondrial contacts' },
  { id: 'ALS2',    protein: 'alsin',                   disease: 'ALS', prevalence: 0.40, role: 'juvenile ALS2 / infantile-onset HSP / PLSJ; RabGEF for Rab5 endosomes', secondary: ['HSP'] },
  { id: 'HNRNPA1', protein: 'hnRNPA1',                 disease: 'ALS', prevalence: 0.45, role: 'multisystem proteinopathy; prion-like LCD; phase separation; rare ALS variant' },
  { id: 'HNRNPA2B1', protein: 'hnRNPA2/B1',            disease: 'ALS', prevalence: 0.40, role: 'multisystem proteinopathy; prion-like LCD; partners with hnRNPA1' },
  { id: 'TAF15',   protein: 'TAF15',                   disease: 'ALS', prevalence: 0.40, role: 'FET-family RNA-binding protein (FUS, EWSR1, TAF15); recently identified amyloid in FTLD-FET' },
  { id: 'EWSR1',   protein: 'EWSR1',                   disease: 'ALS', prevalence: 0.35, role: 'FET family; rare ALS variant; aggregates in FTLD-FET' },
  { id: 'ELP3',    protein: 'elongator complex',       disease: 'ALS', prevalence: 0.30, role: 'tRNA modification (mcm5s2U34); ALS susceptibility; motor-axon vulnerability' },

  // ===== Pure tauopathies (PSP, CBD, FTLD-tau) =====
  { id: 'STX6',    protein: 'syntaxin-6',              disease: 'TAU', prevalence: 0.55, role: 'PSP GWAS; lysosomal/Golgi SNARE; tau secretion/seeding axis', secondary: ['AD'] },
  { id: 'EIF2AK3', protein: 'PERK',                    disease: 'TAU', prevalence: 0.50, role: 'PSP GWAS; ER-stress kinase; phosphorylates eIF2α; integrated stress response', secondary: ['SHARED'] },
  { id: 'MOBP',    protein: 'MOBP',                    disease: 'TAU', prevalence: 0.55, role: 'PSP & FTLD-tau GWAS; myelin/oligodendrocyte basic protein; oligodendroglial tau pathology' },
  { id: 'IRF8',    protein: 'IRF8',                    disease: 'TAU', prevalence: 0.45, role: 'PSP GWAS; microglial/myeloid transcription factor', secondary: ['SHARED'] },
  { id: 'CDKN2A',  protein: 'p16 / p14ARF',            disease: 'TAU', prevalence: 0.40, role: 'PSP GWAS; cell-cycle regulator; cellular senescence in glia' },
  { id: 'AFG3L2',  protein: 'AFG3L2 (m-AAA)',          disease: 'TAU', prevalence: 0.50, role: 'SCA28 + spastic ataxia; partner of SPG7 in m-AAA inner-membrane protease; OPA1 processing', secondary: ['SHARED'] },

  // ===== Hereditary spastic paraplegia (HSP) =====
  { id: 'SPAST',   protein: 'spastin',                 disease: 'HSP', prevalence: 0.85, role: 'SPG4 — most common AD-HSP; microtubule-severing AAA+ ATPase; ER shaping' },
  { id: 'ATL1',    protein: 'atlastin-1',              disease: 'HSP', prevalence: 0.55, role: 'SPG3A — ER-membrane dynamin-family GTPase; tubular ER fusion' },
  { id: 'REEP1',   protein: 'REEP1',                   disease: 'HSP', prevalence: 0.55, role: 'SPG31 — ER-shaping hairpin protein; partners with atlastin/spastin' },
  { id: 'SPG11',   protein: 'spatacsin',               disease: 'HSP', prevalence: 0.60, role: 'commonest recessive HSP; juvenile ALS5; required for autophagic lysosome reformation', secondary: ['ALS','LSD'] },
  { id: 'KIF1A',   protein: 'kinesin-3 / KIF1A',       disease: 'HSP', prevalence: 0.55, role: 'SPG30 + intellectual disability; anterograde kinesin; SV precursor transport in axons' },

  // ===== Charcot-Marie-Tooth (CMT) =====
  { id: 'PMP22',   protein: 'PMP22',                   disease: 'CMT', prevalence: 0.95, role: 'CMT1A — most common CMT; tetraspan PNS myelin protein; duplication on chr17p' },
  { id: 'MPZ',     protein: 'MPZ / P0',                disease: 'CMT', prevalence: 0.70, role: 'CMT1B — major PNS myelin Ig-domain adhesion molecule; >100 dominant mutations' },
  { id: 'GJB1',    protein: 'connexin-32',             disease: 'CMT', prevalence: 0.65, role: 'CMTX1 — X-linked CMT; Schwann-cell gap-junction protein' },
  { id: 'NEFL',    protein: 'neurofilament-L',         disease: 'CMT', prevalence: 0.65, role: 'CMT2E + ALS rare; serum/CSF NfL is the leading global biomarker of axonal injury', secondary: ['ALS','SHARED'] },
  { id: 'DCTN1',   protein: 'dynactin p150',           disease: 'CMT', prevalence: 0.50, role: 'Perry syndrome (parkinsonism + ALS); dynein adaptor; retrograde axonal transport', secondary: ['ALS','PD'] },

  // ===== HD / SCA polyQ extension =====
  { id: 'ATXN7',   protein: 'ataxin-7',                disease: 'HD',  prevalence: 0.45, role: 'SCA7 — polyQ; SAGA transcriptional coactivator; cone-rod dystrophy adds retinal degeneration' },
  { id: 'ATXN10',  protein: 'ataxin-10',               disease: 'HD',  prevalence: 0.40, role: 'SCA10 — non-coding pentanucleotide (ATTCT) expansion; ataxia + epilepsy' },
  { id: 'CACNA1A', protein: 'Cav2.1 / CACNA1A',        disease: 'HD',  prevalence: 0.55, role: 'SCA6 polyQ; also EA2 + FHM1; P/Q-type Ca²⁺ channel pore' },
  { id: 'TBP',     protein: 'TBP',                     disease: 'HD',  prevalence: 0.40, role: 'SCA17 — polyQ in TATA-binding protein; transcriptional master regulator' },
  { id: 'ATN1',    protein: 'atrophin-1',              disease: 'HD',  prevalence: 0.40, role: 'DRPLA — polyQ; dentatorubral-pallidoluysian atrophy; transcriptional corepressor' },
  { id: 'PPP2R2B', protein: 'PP2A B-subunit',          disease: 'HD',  prevalence: 0.35, role: 'SCA12 — non-coding CAG expansion; phosphatase regulatory subunit' },

  // ===== Lysosomal storage extension =====
  { id: 'ARSA',    protein: 'arylsulfatase A',         disease: 'LSD', prevalence: 0.55, role: 'metachromatic leukodystrophy; sulfatide degradation; gene therapy approved (atidarsagene)' },
  { id: 'ASAH1',   protein: 'acid ceramidase',         disease: 'LSD', prevalence: 0.45, role: 'Farber disease; SMA-PME; ceramide hydrolysis' },
  { id: 'GLB1',    protein: 'β-galactosidase',         disease: 'LSD', prevalence: 0.55, role: 'GM1 gangliosidosis; Morquio B; broad gangliosides + keratan sulfate substrate' },
  { id: 'MCOLN1',  protein: 'TRPML1',                  disease: 'LSD', prevalence: 0.55, role: 'mucolipidosis IV; lysosomal cation channel; Ca²⁺ release for lysosomal trafficking and TFEB activation' },
  { id: 'HEXB',    protein: 'β-hexosaminidase β',      disease: 'LSD', prevalence: 0.50, role: 'Sandhoff disease (loss of HexA + HexB); subunit shared with HEXA' },
  { id: 'GNS',     protein: 'N-acetylglucosamine-6-sulfatase', disease: 'LSD', prevalence: 0.40, role: 'mucopolysaccharidosis IIID (Sanfilippo D); heparan sulfate breakdown' },

  // ===== Mitochondrial cristae / MICOS / mtDNA =====
  { id: 'IMMT',    protein: 'mitofilin / MIC60',       disease: 'SHARED', prevalence: 0.50, role: 'MICOS core; defines crista junctions; partners with SAM50 for OMM-IMM bridging' },
  { id: 'SAM50',   protein: 'SAM50',                   disease: 'SHARED', prevalence: 0.45, role: 'sorting-and-assembly machinery; OMM β-barrel insertion; MICOS-SAM bridge' },
  { id: 'COQ8A',   protein: 'COQ8A / CABC1',           disease: 'SHARED', prevalence: 0.45, role: 'SCAR9 ataxia; CoQ10 biosynthesis kinase-like; mitochondrial respiratory-chain support' },
  { id: 'DGUOK',   protein: 'deoxyguanosine kinase',   disease: 'SHARED', prevalence: 0.40, role: 'mtDNA depletion syndrome (hepatocerebral); deoxynucleotide salvage' },
  { id: 'TWNK',    protein: 'twinkle helicase',        disease: 'SHARED', prevalence: 0.50, role: 'mtDNA replicative helicase; PEO; mtDNA depletion + multiple-deletion syndromes' },

  // ===== Stress granules / integrated stress response =====
  { id: 'G3BP1',   protein: 'G3BP1',                   disease: 'SHARED', prevalence: 0.55, role: 'canonical stress-granule scaffold; nucleator of cytoplasmic SGs' },
  { id: 'G3BP2',   protein: 'G3BP2',                   disease: 'SHARED', prevalence: 0.40, role: 'paralog of G3BP1; redundant SG-nucleation function' },
  { id: 'EIF2S1',  protein: 'eIF2α',                   disease: 'SHARED', prevalence: 0.55, role: 'integrated stress response; phosphorylated at Ser51 by PERK/PKR/GCN2/HRI; global translation attenuation', secondary: ['TAU','ALS'] },

  // ===== Glial / microglial markers =====
  { id: 'CSF1R',   protein: 'CSF1R',                   disease: 'SHARED', prevalence: 0.60, role: 'microglial RTK; ALSP/HDLS when mutated (adult-onset leukoencephalopathy); CSF1R inhibitors deplete microglia', secondary: ['AD'] },
  { id: 'CX3CR1',  protein: 'CX3CR1',                  disease: 'SHARED', prevalence: 0.45, role: 'microglial fractalkine receptor; tones down microglial reactivity; canonical microglia marker', secondary: ['AD'] },
  { id: 'P2RY12',  protein: 'P2RY12',                  disease: 'SHARED', prevalence: 0.45, role: 'homeostatic microglia marker; ADP receptor; lost during DAM transition', secondary: ['AD'] },
  { id: 'AIF1',    protein: 'Iba-1',                   disease: 'SHARED', prevalence: 0.40, role: 'ionised calcium binding adaptor; pan-microglial/macrophage immunostaining marker' },

  // ===== Lipid metabolism / ceramide axis =====
  { id: 'SREBF1',  protein: 'SREBP-1',                 disease: 'SHARED', prevalence: 0.40, role: 'sterol regulatory element binding protein; lipogenesis TF; identified as ALS modifier via lipidomics' },
  { id: 'SPTLC1',  protein: 'SPTLC1',                  disease: 'ALS',    prevalence: 0.40, role: 'HSAN1 + recent juvenile ALS; serine palmitoyltransferase; sphingolipid biosynthesis entry point' },
  { id: 'ELOVL5',  protein: 'ELOVL5',                  disease: 'HD',     prevalence: 0.35, role: 'SCA38 — fatty-acid elongase; polyunsaturated-fatty-acid biosynthesis' },

  // ===== Prion / PrP chaperones =====
  { id: 'STIP1',   protein: 'STI1 / HOP',              disease: 'PRION',  prevalence: 0.45, role: 'HSP70-HSP90 organising co-chaperone; secreted ligand for cellular PrP; neuroprotective' },

  // ===== Missing nodes referenced by earlier edges (fixes orphan edges) =====
  { id: 'DNM1L',   protein: 'Drp1 (DNM1L)',            disease: 'SHARED', prevalence: 0.70, role: 'dynamin-related protein 1; principal mitochondrial fission GTPase; recruited to OMM by MFF/FIS1/MID49/MID51; encephalopathy when mutated', secondary: ['AD','HD','PD'] },
  { id: 'ATG5',    protein: 'ATG5',                    disease: 'SHARED', prevalence: 0.55, role: 'ATG12-ATG5 conjugate is the E3-like ligase for LC3 lipidation; required for canonical autophagy' },
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

  // ============================================================
  // Round 3 — edges drawn from Bayati & Chen (Axonal & Synaptic Dysfunctions
  // Drive Neurodegeneration). The recurring theme: lysosomal/autophagy
  // machinery sits at the crossroads of PD, AD, ALS, and HD — not just LSD.
  // Citations for these are deferred to SME validation; renderer shows NCBI
  // gene-page links per gene rather than fabricated PMIDs.
  // ============================================================

  // --- αSyn perturbs autophagy initiation machinery ---
  { from: 'SNCA', to: 'ATG9A', kind: 'opposes', strength: 0.7,
    note: 'α-synuclein aggregation mislocalises ATG9A, blocking autophagosome biogenesis at the seed-membrane stage. One of the upstream reasons PD neurons fail mitophagy even when PINK1/PRKN are functional.',
    pmids: [] },
  { from: 'SNCA', to: 'RAB1A', kind: 'opposes', strength: 0.7,
    note: 'α-synuclein impairs Rab1A localisation; Rab1A traffic deficits compound ATG9A misplacement and impair autophagosome formation in PD.',
    pmids: [] },
  { from: 'RAB1A', to: 'ATG9A', kind: 'complex', strength: 0.6,
    note: 'Rab1A and ATG9A cooperate in the membrane-seeding step of autophagosome biogenesis; loss of either disrupts autophagy initiation.',
    pmids: [] },

  // --- TMEM175 / CD63 / GBA lysosomal PD axis ---
  { from: 'TMEM175', to: 'SNCA', kind: 'shared-mechanism', strength: 0.75,
    note: 'TMEM175 loss reduces lysosomal enzyme activity, including impaired α-synuclein clearance through chaperone-mediated autophagy; GWAS-identified PD risk locus.',
    pmids: [] },
  { from: 'TMEM175', to: 'GBA', kind: 'shared-mechanism', strength: 0.8,
    note: 'Both PD risk genes converge on lysosomal proteostasis; TMEM175 sets lysosomal pH/K+ balance that GBA depends on for activity.',
    pmids: [] },
  { from: 'CD63', to: 'SNCA', kind: 'shared-mechanism', strength: 0.55,
    note: 'CD63 (lysosomal tetraspanin) participates in late-endosomal/lysosomal trafficking required for α-synuclein clearance; recent PD literature implicates this axis.',
    pmids: [] },
  { from: 'CD63', to: 'LAMP1', kind: 'complex', strength: 0.7,
    note: 'CD63 (LAMP3) and LAMP1 are lysosomal-membrane glycoprotein family members; co-occupy the limiting membrane of mature lysosomes.',
    pmids: [] },
  { from: 'CD63', to: 'LAMP2', kind: 'complex', strength: 0.7,
    note: 'LAMP family lysosomal-membrane glycoproteins; CD63 trafficks similarly via M6P-independent routes.',
    pmids: [] },

  // --- LAMP1/LAMP2 are autophagy-fusion partners for ALL neurodegen aggregates ---
  { from: 'LAMP1', to: 'APP', kind: 'shared-mechanism', strength: 0.7,
    note: 'LAMP1+ lysosomes are the terminal compartment for autophagic Aβ/APP clearance; LAMP1 loss attenuates Aβ degradation in AD.',
    pmids: [] },
  { from: 'LAMP1', to: 'MAPT', kind: 'shared-mechanism', strength: 0.7,
    note: 'Phospho-tau and tau-aggregate clearance route through LAMP1+ lysosomes; impaired in AD/tauopathies.',
    pmids: [] },
  { from: 'LAMP1', to: 'HTT', kind: 'shared-mechanism', strength: 0.65,
    note: 'mHTT polyQ-aggregate clearance depends on autophagosome–LAMP1+ lysosome fusion; impaired in HD.',
    pmids: [] },
  { from: 'LAMP2', to: 'APP', kind: 'shared-mechanism', strength: 0.65,
    note: 'LAMP2-mediated autophagosome–lysosome fusion is required for Aβ clearance; LAMP2 also gates CMA delivery of soluble APP fragments.',
    pmids: [] },
  { from: 'LAMP2', to: 'SNCA', kind: 'kinase-substrate', strength: 0.85,
    note: 'LAMP2A is the receptor for chaperone-mediated autophagy of α-synuclein; pathogenic αSyn binds LAMP2A but is not degraded, gumming up CMA for other substrates.',
    pmids: [] },
  { from: 'LAMP2', to: 'MAPT', kind: 'kinase-substrate', strength: 0.65,
    note: 'Soluble tau is a CMA substrate via LAMP2A; impaired in AD/tauopathies, contributing to tau accumulation.',
    pmids: [] },
  { from: 'LAMP2', to: 'HTT', kind: 'kinase-substrate', strength: 0.6,
    note: 'mHTT N-terminal fragments are CMA substrates via LAMP2A; clearance fails as polyQ-tract aggregation progresses.',
    pmids: [] },

  // --- v-ATPase / PSEN1 lysosomal-acidification axis (AD) ---
  { from: 'PSEN1', to: 'ATP6V0A1', kind: 'opposes', strength: 0.8,
    note: 'PSEN1 mutations impair V-ATPase V0a1 maturation and lysosomal trafficking, preventing lysosomal acidification — a chaperone-independent presenilin function central to familial AD lysosomal dysfunction.',
    pmids: [] },
  { from: 'ATP6V0A1', to: 'LAMP1', kind: 'complex', strength: 0.6,
    note: 'V-ATPase pumps protons into the LAMP1+ lysosomal lumen; acidification is required for resident hydrolase activity (CTSD, CTSB, GBA, GAA).',
    pmids: [] },
  { from: 'ATP6V0A1', to: 'CTSD', kind: 'complex', strength: 0.65,
    note: 'Cathepsin D requires the acidic pH established by V-ATPase to mature and stay enzymatically active; loss of v-ATPase shuts off lysosomal proteolysis.',
    pmids: [] },

  // --- UBE3A / synaptic UPS (Angelman, broader synaptic biology) ---
  { from: 'UBE3A', to: 'SNCA', kind: 'kinase-substrate', strength: 0.45,
    note: 'UBE3A ubiquitinates α-synuclein and regulates its turnover via the UPS; loss-of-function in Angelman syndrome perturbs synaptic protein turnover broadly.',
    pmids: [] },
  { from: 'UBE3A', to: 'SQSTM1', kind: 'shared-mechanism', strength: 0.45,
    note: 'UBE3A loss disrupts the UPS, shunting load to p62-mediated selective autophagy; same compensatory crosstalk implicated in other proteinopathies.',
    pmids: [] },

  // --- Complement / microglial pruning axis (AD, FTD) ---
  { from: 'C1QA', to: 'C3', kind: 'kinase-substrate', strength: 0.9,
    note: 'Classical complement cascade — C1q recognises opsonised synapses and activates C3, generating C3b/iC3b tags that microglia recognise via CR3 for phagocytosis.',
    pmids: [] },
  { from: 'C1QA', to: 'TREM2', kind: 'shared-mechanism', strength: 0.55,
    note: 'Microglial activation state (TREM2-DAP12 vs DAM transcriptional program) sets readiness to execute complement-tagged synaptic pruning; the two axes converge on AD-microglia.',
    pmids: [] },
  { from: 'C1QA', to: 'APP', kind: 'shared-mechanism', strength: 0.6,
    note: 'C1q is upregulated on synapses near Aβ plaques in AD, marking them for premature complement-mediated pruning.',
    pmids: [] },
  { from: 'C3', to: 'APP', kind: 'shared-mechanism', strength: 0.55,
    note: 'C3 tagging of Aβ-proximal synapses drives microglial phagocytosis of intact synapses in AD models — synaptic loss begins before plaques mature.',
    pmids: [] },

  // --- HD astrocyte excitotoxicity axis ---
  { from: 'HTT', to: 'SLC1A2', kind: 'opposes', strength: 0.75,
    note: 'mHTT expression in astrocytes downregulates SLC1A2/EAAT2/GLT-1 glutamate transporter, impairing synaptic glutamate clearance and driving excitotoxic striatal neuron death in HD.',
    pmids: [] },

  // --- Mitochondrial dynamics in AD/HD (Aβ → Drp1 fragmentation; TDP-43 → expression changes) ---
  { from: 'DNM1L', to: 'APP', kind: 'shared-mechanism', strength: 0.7,
    note: 'Aβ enhances Drp1 recruitment to the outer mitochondrial membrane (via Fis1/Mff/MiD49/51), driving excessive mitochondrial fragmentation, ATP deficits, and dendritic spine loss in AD.',
    pmids: [] },
  { from: 'DNM1L', to: 'HTT', kind: 'shared-mechanism', strength: 0.65,
    note: 'mHTT aberrantly interacts with Drp1 and other fission/fusion machinery, causing fragmentation, transport defects, and corticostriatal synaptic energy failure.',
    pmids: [] },
  { from: 'TARDBP', to: 'MFN2', kind: 'opposes', strength: 0.65,
    note: 'TDP-43 aggregation alters Mfn2 expression and disrupts mitochondrial fusion in ALS axons; combines with direct TDP-43 association with mitochondria.',
    pmids: [] },
  { from: 'TARDBP', to: 'OPA1', kind: 'opposes', strength: 0.6,
    note: 'TDP-43 aggregation alters OPA1 expression, perturbing inner-membrane fusion and cristae shaping in ALS.',
    pmids: [] },

  // --- ATP13A2 ↔ LRRK2 lysosomal-biogenesis PD ---
  { from: 'ATP13A2', to: 'LRRK2', kind: 'shared-mechanism', strength: 0.55,
    note: 'Both ATP13A2 (lysosomal P-type ATPase) and LRRK2 (kinase regulating Rab10/Rab8) perturb lysosomal biogenesis and trafficking when mutated, converging on autophagic flux in PD.',
    pmids: [] },

  // --- BECN1 autophagy initiation — reduced/dysregulated across multiple NDs ---
  { from: 'BECN1', to: 'APP', kind: 'shared-mechanism', strength: 0.7,
    note: 'Beclin-1 expression is reduced in AD brain; restoring BECN1 enhances autophagic Aβ clearance.',
    pmids: [] },
  { from: 'BECN1', to: 'SNCA', kind: 'shared-mechanism', strength: 0.6,
    note: 'BECN1 overexpression rescues α-synuclein-induced neurodegeneration; loss of BECN1-mediated autophagy initiation impairs αSyn clearance in PD.',
    pmids: [] },
  { from: 'BECN1', to: 'HTT', kind: 'shared-mechanism', strength: 0.55,
    note: 'mHTT impairs Beclin-1 availability for autophagy initiation; restoring BECN1 reduces aggregate load in HD models.',
    pmids: [] },
  { from: 'BECN1', to: 'TFEB', kind: 'complex', strength: 0.7,
    note: 'Both upstream regulators of the autophagy-lysosomal pathway; TFEB activation increases autophagosome biogenesis (BECN1 complex) AND lysosomal CLEAR-network output.',
    pmids: [] },

  // ============================================================
  // Round 4 — TANGENTIAL edges (drawn dotted in the network).
  // Every edge below has `tentative: true` so the renderer styles it
  // as a dotted line. These are candidates for SME inclusion — flag
  // them as not-real if they're not load-bearing for the discussion.
  // ============================================================
  // SNARE / synaptic-vesicle axis (SNCA-centric)
  { from: 'SNCA', to: 'SYT1',   kind: 'shared-mechanism', strength: 0.35, tentative: true, pmids: [],
    note: 'αSyn interacts with synaptotagmin-1 at presynaptic terminals; perturbs Ca²⁺-triggered fusion in PD models. Tangential.' },
  { from: 'SNCA', to: 'VAMP2',  kind: 'shared-mechanism', strength: 0.4, tentative: true, pmids: [],
    note: 'αSyn binds and clusters VAMP2/synaptobrevin-2, contributing to SNARE-complex assembly defects in PD. Tangential.' },
  { from: 'SNCA', to: 'SNAP25', kind: 'shared-mechanism', strength: 0.4, tentative: true, pmids: [],
    note: 'αSyn aggregation reduces SNAP25 availability in SNARE complexes; presynaptic depression in PD. Tangential.' },
  { from: 'SNCA', to: 'STX1A',  kind: 'shared-mechanism', strength: 0.35, tentative: true, pmids: [],
    note: 'Aggregated αSyn disrupts syntaxin-1A function within the t-SNARE complex. Tangential.' },
  { from: 'APP',  to: 'SNAP25', kind: 'opposes', strength: 0.4, tentative: true, pmids: [],
    note: 'Aβ oligomers interfere with SNAP25-containing SNARE complex assembly, reducing presynaptic release. Tangential.' },
  { from: 'APP',  to: 'SYP',    kind: 'opposes', strength: 0.45, tentative: true, pmids: [],
    note: 'Aβ downregulates synaptophysin expression — synaptophysin loss is among the earliest AD presynaptic changes. Tangential.' },
  { from: 'SV2A', to: 'SYP',    kind: 'complex', strength: 0.4, tentative: true, pmids: [],
    note: 'Both abundant SV membrane proteins; SV2A is the [11C]UCB-J PET tracer target for synaptic-density imaging in AD/PD. Tangential.' },

  // PSD / postsynaptic
  { from: 'TARDBP', to: 'DLG4',  kind: 'opposes', strength: 0.45, tentative: true, pmids: [],
    note: 'TDP-43 mislocalisation reduces local dendritic translation of PSD-95, weakening the postsynaptic density in ALS. Tangential.' },
  { from: 'APP',    to: 'GRIN1', kind: 'opposes', strength: 0.5, tentative: true, pmids: [],
    note: 'Aβ binds NMDA receptors (GluN1 obligate subunit) and drives their endocytosis, reducing postsynaptic Ca²⁺ signalling. Tangential.' },
  { from: 'APP',    to: 'GRIA1', kind: 'opposes', strength: 0.45, tentative: true, pmids: [],
    note: 'Aβ-PrPc-Fyn signalling triggers AMPA-R (GluA1) endocytosis, depressing synaptic transmission in AD. Tangential.' },
  { from: 'DLG4',   to: 'GRIN1', kind: 'complex', strength: 0.45, tentative: true, pmids: [],
    note: 'PSD-95 anchors NMDA receptors at the postsynaptic density. Tangential structural link.' },
  { from: 'HOMER1', to: 'DLG4',  kind: 'complex', strength: 0.35, tentative: true, pmids: [],
    note: 'PSD scaffolding partners; both required for activity-dependent synapse strengthening. Tangential.' },

  // Mitochondrial fission receptors
  { from: 'DNM1L', to: 'FIS1',  kind: 'complex', strength: 0.55, tentative: true, pmids: [],
    note: 'FIS1 is one of four OMM DRP1 receptors; recruited during Aβ-driven mitochondrial fragmentation. Tangential.' },
  { from: 'DNM1L', to: 'MFF',   kind: 'complex', strength: 0.6, tentative: true, pmids: [],
    note: 'MFF is the principal OMM DRP1 receptor; AMPK phosphorylation enhances DRP1 recruitment. Tangential.' },
  { from: 'DNM1L', to: 'MIEF1', kind: 'complex', strength: 0.5, tentative: true, pmids: [],
    note: 'MID49 (MIEF1) recruits DRP1 alongside MFF. Tangential.' },

  // DA-neuron PD axis
  { from: 'TH',     to: 'SNCA',    kind: 'shared-disease', strength: 0.6, tentative: true, pmids: [],
    note: 'TH+ dopaminergic neurons in substantia nigra are the principal site of αSyn pathology and dopaminergic deficit in PD. Tangential vulnerability link.' },
  { from: 'TH',     to: 'SLC6A3',  kind: 'shared-mechanism', strength: 0.5, tentative: true, pmids: [],
    note: 'TH and DAT co-mark dopaminergic neurons; both lost in PD substantia nigra. Tangential cell-identity link.' },
  { from: 'SLC18A2',to: 'SLC6A3',  kind: 'shared-mechanism', strength: 0.5, tentative: true, pmids: [],
    note: 'VMAT2 loads dopamine into SVs; DAT reuptakes it from the cleft — paired dopaminergic infrastructure. Tangential.' },
  { from: 'SLC18A2',to: 'SNCA',    kind: 'shared-mechanism', strength: 0.35, tentative: true, pmids: [],
    note: 'VMAT2 reduction increases cytosolic dopamine, promoting αSyn aggregation under oxidative stress. Tangential.' },

  // AD LOAD GWAS axis
  { from: 'PICALM', to: 'APP',   kind: 'shared-mechanism', strength: 0.45, tentative: true, pmids: [],
    note: 'PICALM regulates clathrin-mediated APP endocytosis, modulating Aβ generation. Tangential AD-risk locus.' },
  { from: 'CD2AP',  to: 'APP',   kind: 'shared-mechanism', strength: 0.4, tentative: true, pmids: [],
    note: 'CD2AP modulates APP endocytic trafficking; LOAD GWAS hit. Tangential.' },
  { from: 'TOMM40', to: 'APOE',  kind: 'shared-mechanism', strength: 0.5, tentative: true, pmids: [],
    note: 'TOMM40 sits immediately upstream of APOE on chr19; its AD-risk signal is largely confounded with APOE ε4 LD. Tangential locus link.' },
  { from: 'PICALM', to: 'BIN1',  kind: 'shared-mechanism', strength: 0.4, tentative: true, pmids: [],
    note: 'Both LOAD GWAS endocytic-machinery hits; converge on synaptic APP processing. Tangential.' },

  // ALS extension
  { from: 'KIF5A', to: 'TARDBP',  kind: 'shared-mechanism', strength: 0.45, tentative: true, pmids: [],
    note: 'KIF5A ALS mutations and TDP-43 pathology both compromise axonal transport, converging on motor-neuron degeneration. Tangential.' },
  { from: 'UBQLN2', to: 'SQSTM1', kind: 'shared-mechanism', strength: 0.5, tentative: true, pmids: [],
    note: 'Both shuttle ubiquitinated cargo between UPS and autophagy; both mutated in familial ALS/FTD. Tangential.' },
  { from: 'UBQLN2', to: 'TARDBP', kind: 'shared-disease', strength: 0.45, tentative: true, pmids: [],
    note: 'UBQLN2 mutations cause ALS/FTD with TDP-43 pathology — same proteinopathy class as sporadic ALS. Tangential.' },
  { from: 'CHCHD10', to: 'CHCHD2', kind: 'shared-mechanism', strength: 0.55, tentative: true, pmids: [],
    note: 'CHCHD10 and CHCHD2 are paralogous mitochondrial IMS proteins; both implicated in late-onset neurodegeneration (ALS22 / PARK22). Tangential.' },
  { from: 'ANG',    to: 'TARDBP',  kind: 'shared-disease', strength: 0.35, tentative: true, pmids: [],
    note: 'Angiogenin loss-of-function variants are rare ALS9; same disease class. Tangential.' },

  // Autophagy core
  { from: 'RB1CC1', to: 'ULK1',    kind: 'complex', strength: 0.7, tentative: true, pmids: [],
    note: 'FIP200 + ULK1 + ATG13 + ATG101 form the autophagy-initiation complex. Tangential extension of ULK1 biology.' },
  { from: 'ATG12',  to: 'ATG7',    kind: 'kinase-substrate', strength: 0.7, tentative: true, pmids: [],
    note: 'ATG7 is the E1 that activates ATG12 for conjugation with ATG5. Tangential.' },
  { from: 'ATG12',  to: 'ATG5',    kind: 'complex', strength: 0.8, tentative: true, pmids: [],
    note: 'ATG12-ATG5 conjugate is the E3-like ligase for LC3 lipidation. Tangential.' },
  { from: 'ATG16L1',to: 'ATG12',   kind: 'complex', strength: 0.7, tentative: true, pmids: [],
    note: 'ATG16L1 brings the ATG12-ATG5 conjugate to the phagophore membrane. Tangential.' },
  { from: 'STX17',  to: 'LAMP1',   kind: 'complex', strength: 0.6, tentative: true, pmids: [],
    note: 'STX17 on autophagosomes + SNAP29 + VAMP8 on lysosomes drive autophagosome–LAMP1+ lysosome fusion. Tangential.' },
  { from: 'STX17',  to: 'MAP1LC3B',kind: 'complex', strength: 0.5, tentative: true, pmids: [],
    note: 'STX17 is recruited to LC3-decorated mature autophagosomes for fusion. Tangential.' },

  // Inflammation
  { from: 'NLRP3', to: 'APP',     kind: 'shared-mechanism', strength: 0.5, tentative: true, pmids: [],
    note: 'Aβ fibrils activate the NLRP3 inflammasome in microglia, driving IL-1β release and chronic AD neuroinflammation. Tangential.' },
  { from: 'NLRP3', to: 'SNCA',    kind: 'shared-mechanism', strength: 0.5, tentative: true, pmids: [],
    note: 'αSyn fibrils activate NLRP3 in microglia, fuelling neuroinflammation in PD. Tangential.' },
  { from: 'NLRP3', to: 'TREM2',   kind: 'shared-mechanism', strength: 0.35, tentative: true, pmids: [],
    note: 'TREM2-driven microglial activation state modulates NLRP3 readiness. Tangential.' },

  // Iron / NBIA
  { from: 'FTL',    to: 'PANK2',   kind: 'shared-disease', strength: 0.45, tentative: true, pmids: [],
    note: 'FTL (neuroferritinopathy) and PANK2 (PKAN) are both NBIA syndromes with brain iron accumulation. Tangential.' },
  { from: 'FTL',    to: 'C19orf12',kind: 'shared-disease', strength: 0.4, tentative: true, pmids: [],
    note: 'NBIA family — same MRI iron-accumulation phenotype. Tangential.' },
  { from: 'FTL',    to: 'WDR45',   kind: 'shared-disease', strength: 0.4, tentative: true, pmids: [],
    note: 'NBIA family. Tangential.' },

  // ===== Expanded lysosomal edges =====
  { from: 'TFEB', to: 'LAMP1', kind: 'kinase-substrate', strength: 0.9,
    note: 'LAMP1 is a canonical CLEAR-network target — its promoter is directly bound and activated by TFEB; LAMP1 is the most-induced lysosomal gene on TFEB activation.',
    pmids: ['19556463'] },
  { from: 'TFEB', to: 'LAMP2', kind: 'kinase-substrate', strength: 0.85,
    note: 'LAMP2 is induced by TFEB binding the CLEAR motif in its promoter; required for autophagosome–lysosome fusion (LAMP2A specifically mediates chaperone-mediated autophagy).',
    pmids: ['19556463'] },
  { from: 'TFEB', to: 'CTSD', kind: 'kinase-substrate', strength: 0.85,
    note: 'CTSD is a TFEB target gene; TFEB activation raises cathepsin D expression, enhancing lysosomal proteolytic capacity.',
    pmids: ['19556463'] },
  { from: 'TFEB', to: 'CTNS', kind: 'kinase-substrate', strength: 0.6,
    note: 'CTNS (cystinosin) is induced by TFEB; TFEB activation is being explored therapeutically in cystinosis.',
    pmids: ['28213592'] },
  { from: 'LAMP2', to: 'MAP1LC3B', kind: 'complex', strength: 0.8,
    note: 'LAMP2A is the receptor for chaperone-mediated autophagy; LAMP2B/C and the broader lysosomal membrane participate in fusion with LC3-decorated autophagosomes.',
    pmids: ['12970365'] },
  { from: 'CTSD', to: 'SNCA', kind: 'kinase-substrate', strength: 0.75,
    note: 'Cathepsin D is the principal lysosomal protease for α-synuclein clearance; CTSD deficiency causes α-syn accumulation; demonstrated in CTSD KO mouse and human iPSC-neurons.',
    pmids: ['18504254', '21346806'] },
  { from: 'CTSD', to: 'APP', kind: 'kinase-substrate', strength: 0.6,
    note: 'Cathepsin D processes APP and β-CTF in the endolysosomal system; perturbed in AD postmortem brain.',
    pmids: ['11470176'] },
  { from: 'CTSB', to: 'MAPT', kind: 'kinase-substrate', strength: 0.7,
    note: 'Cathepsin B cleaves tau, generating C-terminal aggregation-prone fragments; CTSB inhibition reduces tau pathology in tauopathy models.',
    pmids: ['28319074'] },
  { from: 'TPP1', to: 'CLN3', kind: 'shared-disease', strength: 0.65,
    note: 'Both cause neuronal ceroid lipofuscinosis (NCL / Batten disease) — TPP1 = late-infantile CLN2; CLN3 = juvenile (classic Batten); same disease family, different lysosomal proteins.',
    pmids: ['9054934'] },
  { from: 'CLN3', to: 'MAP1LC3B', kind: 'shared-mechanism', strength: 0.55,
    note: 'CLN3 is implicated in autophagy regulation and endolysosomal trafficking; CLN3 deficiency disrupts autophagic flux in neurons.',
    pmids: ['23097490'] },
  { from: 'IDUA', to: 'HEXA', kind: 'shared-mechanism', strength: 0.5,
    note: 'Both lysosomal glycan-degrading hydrolases (mucopolysaccharide vs glycosphingolipid); both cause early-onset neurodegenerative lysosomal storage disease.',
    pmids: ['12601565'] },
  { from: 'SCARB2', to: 'LAMP2', kind: 'shared-mechanism', strength: 0.6,
    note: 'Both lysosomal membrane proteins; SCARB2 (LIMP-2) and LAMP2 share the canonical lysosomal-membrane glycoprotein fold and N-glycosylation signature.',
    pmids: ['18923419'] },

  // ===== Expanded mitochondrial edges =====
  { from: 'PARL', to: 'PINK1', kind: 'kinase-substrate', strength: 1.0,
    note: 'PARL cleaves the imported PINK1 N-terminal MTS in healthy mitochondria, sending PINK1 for proteasomal degradation; loss of mitochondrial potential blocks PARL access, stabilising PINK1 on the OMM to initiate mitophagy.',
    pmids: ['21804141', '22138693'] },
  { from: 'PRKN', to: 'VDAC1', kind: 'kinase-substrate', strength: 0.95,
    note: 'PRKN poly-ubiquitinates VDAC1 (and VDAC2/3) on the outer mitochondrial membrane — one of the earliest and most abundant Parkin substrates identified by ubiquitinome profiling of mitophagy.',
    pmids: ['23478623', '20194754'] },
  { from: 'VDAC1', to: 'TOMM20', kind: 'complex', strength: 0.6,
    note: 'Both are abundant outer-mitochondrial-membrane proteins and major Parkin substrates; co-localise on the OMM and are ubiquitinated en bloc during mitophagy.',
    pmids: ['23478623'] },
  { from: 'TOMM70', to: 'PINK1', kind: 'complex', strength: 0.85,
    note: 'TOMM70 is the principal OMM import receptor for PINK1; the PINK1 N-terminal MTS engages TOMM70 before transit through the TOM core complex; required for PINK1 import in healthy mitochondria.',
    pmids: ['23620051'] },
  { from: 'TOMM70', to: 'TOMM20', kind: 'complex', strength: 0.8,
    note: 'Both are receptor subunits of the TOM (translocase of outer membrane) complex; TOMM20 recognises N-terminal MTS, TOMM70 recognises internal targeting signals; share the TOM40 core channel.',
    pmids: ['12193620'] },
  { from: 'OPA1', to: 'MFN2', kind: 'shared-mechanism', strength: 0.75,
    note: 'Mitochondrial fusion: MFN1/2 fuse the outer membrane; OPA1 fuses the inner membrane and shapes cristae; coordinated loss of either causes mitochondrial network fragmentation.',
    pmids: ['16778770'] },
  { from: 'OPA1', to: 'SPG7', kind: 'kinase-substrate', strength: 0.7,
    note: 'The m-AAA protease (SPG7/AFG3L2) processes OPA1; SPG7 mutations alter OPA1 proteolysis and contribute to hereditary spastic paraplegia phenotypes.',
    pmids: ['16839885'] },
  { from: 'TFAM', to: 'POLG', kind: 'complex', strength: 0.85,
    note: 'TFAM packages mtDNA into nucleoids and recruits POLG; together with TWNK helicase they form the core mtDNA replisome.',
    pmids: ['16107053'] },
  { from: 'POLG', to: 'SNCA', kind: 'shared-mechanism', strength: 0.5,
    note: 'POLG mutations and acquired mtDNA deletions are observed in PD substantia nigra; mitochondrial dysfunction is a feature of α-synuclein pathology.',
    pmids: ['16604068'] },
  { from: 'NDUFS1', to: 'SNCA', kind: 'shared-mechanism', strength: 0.55,
    note: 'Complex I deficiency in substantia nigra is a defining feature of sporadic Parkinson disease; α-synuclein impairs Complex I activity directly and via OXPHOS-component sequestration.',
    pmids: ['2154550'] },
  { from: 'PRKN', to: 'OPA1', kind: 'shared-mechanism', strength: 0.5,
    note: 'Parkin promotes turnover of inner-membrane fusion machinery indirectly via OMM ubiquitination; loss of PRKN perturbs OPA1-dependent cristae remodelling.',
    pmids: ['21701566'] },

  // ============================================================
  // Round 5 — edges for the expansion batch. ~100 edges spanning recessive/
  // atypical PD subtypes, AD microglial LOAD GWAS axis, Aβ-degrading proteases,
  // ALS/FTD extensions, pure tauopathies (PSP/CBD/FTLD-tau), HSP/CMT
  // axonopathies, polyQ SCAs, additional lysosomal hydrolases, mitochondrial
  // cristae/MICOS, stress granules, and lipid metabolism. Citations deferred
  // to SME validation — renderer falls back to NCBI gene-page links.
  // ============================================================

  // --- Recessive / atypical PD intra-cluster ---
  { from: 'VPS13C', to: 'PINK1',  kind: 'shared-mechanism', strength: 0.65, pmids: [], note: 'VPS13C loss raises PINK1-PRKN mitophagy threshold; loss-of-function variants cause early-onset PD via mitochondrial-quality-control failure.' },
  { from: 'VPS13C', to: 'PRKN',   kind: 'shared-mechanism', strength: 0.6, pmids: [], note: 'VPS13C lipid-transfer activity at ER-mitochondria contacts feeds the PRKN-dependent mitophagy pathway; PARK23.' },
  { from: 'SYNJ1',  to: 'SNCA',   kind: 'shared-mechanism', strength: 0.5, pmids: [], note: 'Synaptojanin-1 dephosphorylates PI(4,5)P2 for SV recycling; loss perturbs synaptic recycling and accelerates αSyn deposition.' },
  { from: 'SYNJ1',  to: 'DNAJC6', kind: 'complex', strength: 0.7, pmids: [], note: 'Auxilin and synaptojanin-1 cooperate at the clathrin-coated-vesicle uncoating step of SV endocytosis; both cause recessive juvenile PD when lost.' },
  { from: 'DNAJC6', to: 'SH3GL2', kind: 'shared-mechanism', strength: 0.55, pmids: [], note: 'Auxilin (DNAJC6) and endophilin-A1 (SH3GL2) are convergent components of clathrin-mediated synaptic-vesicle endocytosis; both linked to PD.' },
  { from: 'FBXO7',  to: 'PRKN',   kind: 'complex', strength: 0.7, pmids: [], note: 'FBXO7 binds PRKN and PINK1 and is required for efficient PRKN recruitment to depolarised mitochondria; loss causes PARK15.' },
  { from: 'FBXO7',  to: 'PINK1',  kind: 'complex', strength: 0.6, pmids: [], note: 'FBXO7 is recruited to damaged mitochondria during mitophagy and supports PINK1-PRKN signalling.' },
  { from: 'HTRA2',  to: 'PINK1',  kind: 'shared-mechanism', strength: 0.5, pmids: [], note: 'HtrA2/Omi is a mitochondrial IMS serine protease; PINK1 phosphorylates HTRA2; convergent mitochondrial-QC role.' },
  { from: 'GBA2',   to: 'GBA',    kind: 'shared-mechanism', strength: 0.65, pmids: [], note: 'GBA2 is the non-lysosomal glucosylceramidase; together with lysosomal GBA it sets cellular glucosylceramide tone; both perturb αSyn aggregation.' },
  { from: 'GBA2',   to: 'SNCA',   kind: 'shared-mechanism', strength: 0.45, pmids: [], note: 'GBA2 loss shifts glucosylceramide handling and modifies αSyn aggregation in cellular PD models.', tentative: true },
  { from: 'GCH1',   to: 'TH',     kind: 'kinase-substrate', strength: 0.8, pmids: [], note: 'GCH1 is rate-limiting for tetrahydrobiopterin (BH4) biosynthesis; BH4 is the obligate TH cofactor for dopamine synthesis. GCH1 loss → DRD.' },
  { from: 'GCH1',   to: 'SNCA',   kind: 'shared-mechanism', strength: 0.4, pmids: [], note: 'GCH1 loss-of-function variants raise PD risk; lower BH4 increases oxidative stress in DA neurons.', tentative: true },
  { from: 'DNAJC13',to: 'VPS35',  kind: 'shared-mechanism', strength: 0.55, pmids: [], note: 'DNAJC13/RME-8 acts in the same retromer-/endosomal-trafficking axis as VPS35; both AD-PD when mutated.' },
  { from: 'CHCHD2', to: 'PRKN',   kind: 'shared-mechanism', strength: 0.45, pmids: [], note: 'CHCHD2 is a mitochondrial IMS protein; PARK22 mutations destabilise complex IV and engage mitophagy.', tentative: true },
  { from: 'LRRK1',  to: 'LRRK2',  kind: 'shared-mechanism', strength: 0.55, pmids: [], note: 'LRRK1 and LRRK2 are paralogous ROCO kinases; LRRK1 phosphorylates Rab7 while LRRK2 targets Rab8/10/12; partial pathway redundancy.' },
  { from: 'SH3GL2', to: 'LRRK2',  kind: 'kinase-substrate', strength: 0.5, pmids: [], note: 'LRRK2 phosphorylates endophilin-A1 at Ser75 and regulates synaptic-vesicle endocytosis; PD-relevant.', tentative: true },
  { from: 'RIT2',   to: 'SNCA',   kind: 'shared-mechanism', strength: 0.35, pmids: [], note: 'RIT2 GWAS signal sits adjacent to SNCA-related neuronal MAPK signalling; convergent PD-risk locus.', tentative: true },
  { from: 'EIF4G1', to: 'GIGYF2', kind: 'complex', strength: 0.5, pmids: [], note: 'eIF4G1 and GIGYF2 cooperate in translational control; both nominated as rare PD genes; convergent proteostasis link.', tentative: true },

  // --- AD — LOAD GWAS microglial axis ---
  { from: 'SPI1',   to: 'TREM2',  kind: 'kinase-substrate', strength: 0.7, pmids: [], note: 'PU.1 (SPI1) is the master microglial transcription factor and binds the TREM2 promoter; SPI1 risk variant alters TREM2 expression.' },
  { from: 'SPI1',   to: 'CSF1R',  kind: 'kinase-substrate', strength: 0.7, pmids: [], note: 'SPI1/PU.1 directly drives CSF1R expression in microglia; both required for microglial identity.' },
  { from: 'INPP5D', to: 'TREM2',  kind: 'opposes', strength: 0.65, pmids: [], note: 'SHIP1 (INPP5D) hydrolyses PI(3,4,5)P3 generated downstream of TREM2-DAP12 signalling; LOAD risk allele alters microglial reactivity.' },
  { from: 'PLCG2',  to: 'INPP5D', kind: 'opposes', strength: 0.5, pmids: [], note: 'PLCγ2 (protective P522R) and SHIP1 (risk variants) sit on opposite arms of the TREM2 signalling output.', tentative: true },
  { from: 'ABCA7',  to: 'APOE',   kind: 'shared-mechanism', strength: 0.65, pmids: [], note: 'ABCA7 and ABCA1 efflux phospholipid/cholesterol to ApoE; both LOAD GWAS hits converge on the brain lipoprotein-particle pathway.' },
  { from: 'ABCA1',  to: 'APOE',   kind: 'kinase-substrate', strength: 0.7, pmids: [], note: 'ABCA1 lipidates ApoE-containing HDL particles in the CNS; ABCA1 agonists raise lipidated ApoE and lower Aβ.' },
  { from: 'ABCA7',  to: 'APP',    kind: 'shared-mechanism', strength: 0.45, pmids: [], note: 'ABCA7 modulates microglial Aβ phagocytosis and amyloid plaque burden in AD models.', tentative: true },
  { from: 'CR1',    to: 'C3',     kind: 'receptor-ligand', strength: 0.7, pmids: [], note: 'CR1 binds complement C3b/C4b and clears opsonised material; LOAD risk variants reduce CR1 efficacy in Aβ handling.' },
  { from: 'CR1',    to: 'APP',    kind: 'shared-mechanism', strength: 0.4, pmids: [], note: 'CR1 modulates Aβ clearance by microglia; LOAD GWAS hit.', tentative: true },
  { from: 'MS4A6A', to: 'TREM2',  kind: 'shared-mechanism', strength: 0.5, pmids: [], note: 'MS4A6A variants modulate soluble TREM2 (sTREM2) levels in CSF, linking the MS4A locus and TREM2 axis in AD.' },
  { from: 'ABI3',   to: 'TREM2',  kind: 'shared-mechanism', strength: 0.45, pmids: [], note: 'ABI3 is highly expressed in DAM microglia together with TREM2; rare-variant LOAD GWAS signal.', tentative: true },
  { from: 'MEF2C',  to: 'SPI1',   kind: 'shared-mechanism', strength: 0.4, pmids: [], note: 'MEF2C and SPI1 are coordinate microglial transcription factors; both LOAD GWAS; cognitive-resilience axis.', tentative: true },
  { from: 'PTK2B',  to: 'MAPT',   kind: 'kinase-substrate', strength: 0.55, pmids: [], note: 'Pyk2 (PTK2B) is activated by Aβ and phosphorylates tau; PTK2B LOAD-risk variant drives synapse loss.' },
  { from: 'PTK2B',  to: 'APP',    kind: 'shared-mechanism', strength: 0.45, pmids: [], note: 'Aβ activates Pyk2, linking the AD-risk PTK2B locus to amyloid-driven postsynaptic dysfunction.', tentative: true },

  // --- AD — secretase complex + Aβ-degrading proteases ---
  { from: 'NCSTN',  to: 'PSEN1',  kind: 'complex', strength: 0.95, pmids: [], note: 'Nicastrin recognises γ-secretase substrate N-termini; the active γ-secretase tetramer is PSEN1/NCSTN/APH-1/PEN-2.' },
  { from: 'NCSTN',  to: 'APH1A',  kind: 'complex', strength: 0.85, pmids: [], note: 'APH-1A and nicastrin form the early γ-secretase subcomplex that nucleates PSEN1 incorporation.' },
  { from: 'APH1A',  to: 'PSEN1',  kind: 'complex', strength: 0.9, pmids: [], note: 'APH-1A is required for PSEN1 endoproteolytic maturation and γ-secretase assembly.' },
  { from: 'MME',    to: 'APP',    kind: 'kinase-substrate', strength: 0.85, pmids: [], note: 'Neprilysin (MME) is the principal Aβ-degrading endopeptidase in brain; declines with age and AD progression.' },
  { from: 'IDE',    to: 'APP',    kind: 'kinase-substrate', strength: 0.8, pmids: [], note: 'Insulin-degrading enzyme cleaves soluble Aβ; competes with insulin substrate; linked to T2D-AD co-morbidity.' },
  { from: 'ECE1',   to: 'APP',    kind: 'kinase-substrate', strength: 0.5, pmids: [], note: 'Endothelin-converting enzyme 1 degrades Aβ as a secondary Aβ-clearing protease.' },

  // --- ALS / FTD extension ---
  { from: 'VCP',    to: 'TARDBP', kind: 'shared-mechanism', strength: 0.75, pmids: [], note: 'VCP/p97 extracts ubiquitinated stress-granule components and drives clearance of cytoplasmic TDP-43 aggregates; VCP loss-of-function aggravates TDP-43 proteinopathy.' },
  { from: 'VCP',    to: 'SQSTM1', kind: 'shared-mechanism', strength: 0.7, pmids: [], note: 'VCP and p62 cooperate in autophagic clearance of ubiquitinated cargo; both mutated in multisystem proteinopathy.' },
  { from: 'VCP',    to: 'MAP1LC3B', kind: 'shared-mechanism', strength: 0.6, pmids: [], note: 'VCP segregates ubiquitinated proteins and gates their handoff to LC3-driven selective autophagy.', tentative: true },
  { from: 'MATR3',  to: 'TARDBP', kind: 'complex', strength: 0.7, pmids: [], note: 'Matrin-3 directly binds TDP-43 within nuclear matrix RNA-binding complexes; ALS21 mutations alter the partnership.' },
  { from: 'PFN1',   to: 'TARDBP', kind: 'shared-mechanism', strength: 0.5, pmids: [], note: 'Profilin-1 mutations destabilise cytoskeleton and modify TDP-43 aggregation propensity in motor neurons.', tentative: true },
  { from: 'NEK1',   to: 'C9orf72', kind: 'modifier', strength: 0.55, pmids: [], note: 'NEK1 loss-of-function variants raise ALS risk and modify C9-ALS clinical course; oligogenic ALS-risk landscape.' },
  { from: 'SETX',   to: 'TARDBP', kind: 'shared-mechanism', strength: 0.45, pmids: [], note: 'Senataxin resolves R-loops and protects motor neurons; SETX dysfunction overlaps with TDP-43-related transcriptional stress.', tentative: true },
  { from: 'ANXA11', to: 'TARDBP', kind: 'shared-mechanism', strength: 0.55, pmids: [], note: 'Annexin A11 tethers RNP granules (with TDP-43 cargo) to lysosomes for axonal transport; ALS mutations disrupt the tether.' },
  { from: 'ANXA11', to: 'LAMP1',  kind: 'complex', strength: 0.5, pmids: [], note: 'ANXA11 mediates the granule-to-LAMP1+ lysosome tether that underlies long-distance RNP delivery in axons.', tentative: true },
  { from: 'CCNF',   to: 'TARDBP', kind: 'kinase-substrate', strength: 0.55, pmids: [], note: 'Cyclin F is an SCF E3 substrate adaptor for TDP-43; ALS/FTD-causing CCNF mutations stabilise TDP-43 ubiquitinated species.' },
  { from: 'CHMP2B', to: 'MAP1LC3B', kind: 'shared-mechanism', strength: 0.55, pmids: [], note: 'CHMP2B is an ESCRT-III subunit required for autophagosome maturation; FTD3-causing C-terminal truncations block fusion.' },
  { from: 'VAPB',   to: 'PINK1',  kind: 'shared-mechanism', strength: 0.4, pmids: [], note: 'VAPB defines ER-mitochondria contact sites where PINK1-PRKN mitophagy is coordinated; ALS8.', tentative: true },
  { from: 'ALS2',   to: 'SPAST',  kind: 'shared-disease', strength: 0.45, pmids: [], note: 'Both cause overlapping juvenile motor-axonopathy spectrums (ALS2/HSP); convergent axonal-cytoskeleton biology.', tentative: true },
  { from: 'HNRNPA1', to: 'TARDBP', kind: 'shared-mechanism', strength: 0.6, pmids: [], note: 'hnRNPA1 phase-separates via its prion-like LCD, similarly to TDP-43; co-aggregates in MSP and ALS.' },
  { from: 'HNRNPA1', to: 'HNRNPA2B1', kind: 'shared-mechanism', strength: 0.7, pmids: [], note: 'Paralogous hnRNP family with shared prion-like LCDs; both cause multisystem proteinopathy.' },
  { from: 'TAF15',  to: 'FUS',    kind: 'shared-mechanism', strength: 0.75, pmids: [], note: 'TAF15 + EWSR1 + FUS = FET family; share low-complexity domains and phase-separation behaviour; co-aggregate in FTLD-FET.' },
  { from: 'EWSR1',  to: 'FUS',    kind: 'shared-mechanism', strength: 0.65, pmids: [], note: 'FET-family paralogs; share phase-separation biology.' },
  { from: 'EWSR1',  to: 'TAF15',  kind: 'complex', strength: 0.55, pmids: [], note: 'TAF15 and EWSR1 co-aggregate in FTLD-FET.' },
  { from: 'ELP3',   to: 'TARDBP', kind: 'shared-mechanism', strength: 0.4, pmids: [], note: 'Elongator complex (ELP3) tRNA modification is a motor-neuron-specific vulnerability shared with TDP-43 proteinopathies.', tentative: true },

  // --- Pure tauopathies (PSP/CBD/FTLD-tau) ---
  { from: 'STX6',   to: 'MAPT',   kind: 'shared-mechanism', strength: 0.7, pmids: [], note: 'Syntaxin-6 GWAS-identified PSP risk gene; lysosomal/Golgi SNARE; tau secretion and tau seeding axis.' },
  { from: 'STX6',   to: 'STX17',  kind: 'shared-mechanism', strength: 0.5, pmids: [], note: 'Syntaxin-6 and syntaxin-17 operate on adjacent membrane-fusion steps of the autophagosome-lysosome system.', tentative: true },
  { from: 'EIF2AK3',to: 'MAPT',   kind: 'shared-mechanism', strength: 0.65, pmids: [], note: 'PERK (EIF2AK3) GWAS-identified PSP risk gene; ER-stress kinase upstream of integrated stress response; tau induction.' },
  { from: 'EIF2AK3',to: 'EIF2S1', kind: 'kinase-substrate', strength: 0.95, pmids: [], note: 'PERK phosphorylates eIF2α at Ser51 — the obligate trigger of the integrated stress response.' },
  { from: 'EIF2S1', to: 'MAPT',   kind: 'shared-mechanism', strength: 0.5, pmids: [], note: 'Sustained eIF2α-P drives ATF4-mediated transcriptional reprogramming that exacerbates tau pathology and synapse loss.', tentative: true },
  { from: 'MOBP',   to: 'MAPT',   kind: 'shared-disease', strength: 0.55, pmids: [], note: 'MOBP variants are tauopathy GWAS hits; oligodendroglial coiled-body tau pathology in PSP and CBD.' },
  { from: 'IRF8',   to: 'MAPT',   kind: 'shared-mechanism', strength: 0.4, pmids: [], note: 'IRF8 microglial TF axis is implicated in PSP risk; microglia-tau crosstalk.', tentative: true },
  { from: 'CDKN2A', to: 'MAPT',   kind: 'shared-mechanism', strength: 0.35, pmids: [], note: 'CDKN2A senescence locus is a PSP GWAS hit; glial senescence drives tau accumulation.', tentative: true },
  { from: 'AFG3L2', to: 'SPG7',   kind: 'complex', strength: 0.95, pmids: [], note: 'AFG3L2 and SPG7 form the m-AAA inner-mitochondrial-membrane protease that processes OPA1; AFG3L2 mutations cause SCA28.' },
  { from: 'AFG3L2', to: 'OPA1',   kind: 'kinase-substrate', strength: 0.8, pmids: [], note: 'm-AAA protease (AFG3L2 + SPG7) cleaves OPA1 to its short, fission-competent form; loss raises cristae instability.' },

  // --- HSP intra-cluster ---
  { from: 'SPAST',  to: 'ATL1',   kind: 'complex', strength: 0.7, pmids: [], note: 'SPAST and ATL1 cooperate to shape the tubular ER; SPG4 + SPG3A are the two commonest dominant HSPs.' },
  { from: 'SPAST',  to: 'REEP1',  kind: 'complex', strength: 0.65, pmids: [], note: 'REEP1 partners with spastin and atlastin in ER-shaping; SPG31 dominant HSP.' },
  { from: 'ATL1',   to: 'REEP1',  kind: 'complex', strength: 0.65, pmids: [], note: 'Atlastin and REEP1 cooperate in tubular-ER fusion; same ER-shaping module.' },
  { from: 'SPG11',  to: 'ALS2',   kind: 'shared-disease', strength: 0.55, pmids: [], note: 'Both cause juvenile ALS / HSP spectrum disorders; spatacsin and alsin both involved in endolysosomal trafficking.', tentative: true },
  { from: 'SPG11',  to: 'LAMP1',  kind: 'shared-mechanism', strength: 0.55, pmids: [], note: 'Spatacsin is required for autophagic-lysosome reformation (ALR); SPG11 loss causes lysosomal swelling.' },
  { from: 'KIF1A',  to: 'KIF5A',  kind: 'shared-mechanism', strength: 0.5, pmids: [], note: 'Paralogous kinesin-3/kinesin-1 anterograde motors; both implicated in HSP-axon spectrum.', tentative: true },

  // --- CMT intra-cluster ---
  { from: 'PMP22',  to: 'MPZ',    kind: 'shared-disease', strength: 0.75, pmids: [], note: 'PMP22 and MPZ are the two principal PNS-myelin proteins; CMT1A (PMP22 dup) and CMT1B (MPZ point mutations).' },
  { from: 'MPZ',    to: 'GJB1',   kind: 'shared-disease', strength: 0.55, pmids: [], note: 'Demyelinating CMT family — MPZ + GJB1 are both Schwann-cell proteins; CMT1B + CMTX1.' },
  { from: 'NEFL',   to: 'MFN2',   kind: 'shared-disease', strength: 0.6, pmids: [], note: 'CMT2 axonal family — neurofilament light (CMT2E) and mitofusin-2 (CMT2A); convergent on motor-axon energetics.' },
  { from: 'NEFL',   to: 'TARDBP', kind: 'shared-mechanism', strength: 0.5, pmids: [], note: 'TDP-43 directly stabilises NEFL mRNA; loss of nuclear TDP-43 in ALS lowers NEFL transcript and contributes to axonal failure; serum NfL is the leading ALS biomarker.' },
  { from: 'DCTN1',  to: 'KIF5A',  kind: 'opposes', strength: 0.55, pmids: [], note: 'Dynactin (DCTN1) couples cargo to retrograde dynein; KIF5A drives anterograde transport. Both mutated in ALS/HSP spectrum — bidirectional axonal-transport failure.' },
  { from: 'DCTN1',  to: 'TARDBP', kind: 'shared-mechanism', strength: 0.5, pmids: [], note: 'Perry syndrome (DCTN1) causes parkinsonism + TDP-43 pathology in brainstem motor nuclei.', tentative: true },

  // --- HD / SCA polyQ extension ---
  { from: 'ATXN7',  to: 'HTT',    kind: 'shared-mechanism', strength: 0.6, pmids: [], note: 'SCA7 and HD both polyQ-expansion diseases; share aggregation biology and transcriptional dysregulation.' },
  { from: 'ATXN7',  to: 'ATXN1',  kind: 'shared-disease', strength: 0.55, pmids: [], note: 'polyQ SCA family.' },
  { from: 'ATXN10', to: 'ATXN3',  kind: 'shared-disease', strength: 0.4, pmids: [], note: 'SCA family; ATXN10 is non-coding pentanucleotide rather than polyQ.', tentative: true },
  { from: 'CACNA1A',to: 'ATXN1',  kind: 'shared-disease', strength: 0.5, pmids: [], note: 'SCA6 (CACNA1A polyQ) and SCA1 (ATXN1 polyQ) — same polyQ-SCA family.' },
  { from: 'TBP',    to: 'HTT',    kind: 'shared-mechanism', strength: 0.55, pmids: [], note: 'SCA17 (TBP polyQ) and HD (HTT polyQ) share polyQ pathology and transcriptional dysregulation.' },
  { from: 'TBP',    to: 'AR',     kind: 'shared-disease', strength: 0.45, pmids: [], note: 'polyQ family (SBMA and SCA17).' },
  { from: 'ATN1',   to: 'HTT',    kind: 'shared-mechanism', strength: 0.55, pmids: [], note: 'DRPLA (ATN1 polyQ) and HD (HTT polyQ) — overlapping clinical and pathological features; both polyQ.' },
  { from: 'PPP2R2B',to: 'ATXN1',  kind: 'shared-disease', strength: 0.4, pmids: [], note: 'SCA12 (non-coding CAG) and SCA1 — same SCA family.', tentative: true },

  // --- Lysosomal storage extension ---
  { from: 'ARSA',   to: 'GALC',   kind: 'shared-mechanism', strength: 0.55, pmids: [], note: 'Sulfatide degradation enzymes — ARSA (MLD) and GALC (Krabbe) cause demyelinating LSDs.' },
  { from: 'GLB1',   to: 'HEXA',   kind: 'shared-mechanism', strength: 0.5, pmids: [], note: 'Both lysosomal glycoside hydrolases catalysing ganglioside breakdown (GM1 and GM2); cause early-onset neurodegenerative LSDs.' },
  { from: 'HEXB',   to: 'HEXA',   kind: 'complex', strength: 0.95, pmids: [], note: 'HEXA-HEXB heterodimer (β-hexosaminidase A); HEXB-HEXB homodimer (HexB); Tay-Sachs and Sandhoff diseases respectively.' },
  { from: 'MCOLN1', to: 'TFEB',   kind: 'kinase-substrate', strength: 0.7, pmids: [], note: 'TRPML1 (MCOLN1)-mediated lysosomal Ca²⁺ release activates calcineurin to dephosphorylate TFEB and trigger CLEAR-network induction.' },
  { from: 'MCOLN1', to: 'LAMP1',  kind: 'complex', strength: 0.55, pmids: [], note: 'TRPML1 sits in the LAMP1+ lysosomal limiting membrane; mucolipidosis IV when lost.' },
  { from: 'GNS',    to: 'IDUA',   kind: 'shared-mechanism', strength: 0.45, pmids: [], note: 'Both heparan-sulfate-degrading lysosomal enzymes (MPS IIID and MPS I); convergent CNS-MPS pathology.' },
  { from: 'ASAH1',  to: 'SMPD1',  kind: 'shared-mechanism', strength: 0.5, pmids: [], note: 'Acid ceramidase (ASAH1) and acid sphingomyelinase (SMPD1) sit on adjacent sphingolipid-degradation steps.' },

  // --- Mitochondrial cristae / MICOS / mtDNA ---
  { from: 'IMMT',   to: 'SAM50',  kind: 'complex', strength: 0.9, pmids: [], note: 'Mitofilin (MIC60/IMMT) and SAM50 form the MICOS-SAM bridge that links inner-membrane cristae junctions to OMM β-barrel assembly.' },
  { from: 'IMMT',   to: 'OPA1',   kind: 'complex', strength: 0.6, pmids: [], note: 'MICOS (IMMT-centric) and OPA1 cooperate to shape and maintain cristae architecture.' },
  { from: 'SAM50',  to: 'TOMM70', kind: 'complex', strength: 0.55, pmids: [], note: 'SAM and TOM complexes hand off β-barrel precursors at the OMM; structural and functional coupling.' },
  { from: 'TWNK',   to: 'POLG',   kind: 'complex', strength: 0.95, pmids: [], note: 'Twinkle helicase and POLG form the core mtDNA replisome; mutations in either cause PEO and mtDNA depletion/deletion disorders.' },
  { from: 'TWNK',   to: 'TFAM',   kind: 'shared-mechanism', strength: 0.55, pmids: [], note: 'Twinkle, POLG, and TFAM are the three nucleoid-core proteins of mtDNA maintenance.' },
  { from: 'DGUOK',  to: 'POLG',   kind: 'shared-mechanism', strength: 0.55, pmids: [], note: 'DGUOK supplies dNTP precursors to POLG; loss causes the hepatocerebral mtDNA depletion syndrome.' },
  { from: 'COQ8A',  to: 'NDUFS1', kind: 'shared-mechanism', strength: 0.4, pmids: [], note: 'CoQ10 biosynthesis (COQ8A) supports respiratory-chain function downstream of Complex I (NDUFS1).', tentative: true },

  // --- Stress granules / integrated stress response ---
  { from: 'G3BP1',  to: 'TARDBP', kind: 'shared-mechanism', strength: 0.6, pmids: [], note: 'G3BP1-nucleated stress granules sequester TDP-43; chronic SG persistence is hypothesised to seed TDP-43 aggregates.' },
  { from: 'G3BP1',  to: 'G3BP2',  kind: 'complex', strength: 0.85, pmids: [], note: 'G3BP1/G3BP2 are paralogous stress-granule nucleators; double KO abolishes typical SG formation.' },
  { from: 'G3BP1',  to: 'FUS',    kind: 'shared-mechanism', strength: 0.5, pmids: [], note: 'FUS LCD interacts with G3BP1 in stress granules; ALS-FUS perturbs SG dynamics.', tentative: true },
  { from: 'EIF2S1', to: 'G3BP1',  kind: 'shared-mechanism', strength: 0.7, pmids: [], note: 'eIF2α-P (the ISR trigger) is the canonical upstream switch for stress-granule formation; G3BP1 nucleates downstream.' },

  // --- Glial / microglial markers ---
  { from: 'CSF1R',  to: 'TREM2',  kind: 'shared-mechanism', strength: 0.55, pmids: [], note: 'CSF1R and TREM2 cooperate to maintain microglia; CSF1R loss (HDLS/ALSP) and TREM2 loss (Nasu-Hakola) share progressive leukoencephalopathy phenotypes.' },
  { from: 'CX3CR1', to: 'TREM2',  kind: 'shared-mechanism', strength: 0.4, pmids: [], note: 'CX3CR1 (homeostatic) and TREM2 (DAM) define opposite ends of the microglial activation continuum.', tentative: true },
  { from: 'P2RY12', to: 'CX3CR1', kind: 'shared-mechanism', strength: 0.5, pmids: [], note: 'P2RY12 and CX3CR1 are coordinate homeostatic-microglia markers; both downregulated during DAM transition.' },
  { from: 'AIF1',   to: 'CSF1R',  kind: 'shared-mechanism', strength: 0.35, pmids: [], note: 'Iba-1 (AIF1) is the most-used pan-microglial immunostaining marker; CSF1R-dependent population.', tentative: true },

  // --- Lipid metabolism / ceramide axis ---
  { from: 'SREBF1', to: 'ABCA1',  kind: 'kinase-substrate', strength: 0.5, pmids: [], note: 'SREBP-1 regulates lipogenic gene transcription, interacting with the cholesterol-efflux axis represented by ABCA1.', tentative: true },
  { from: 'SPTLC1', to: 'SMPD1',  kind: 'shared-mechanism', strength: 0.45, pmids: [], note: 'Serine palmitoyltransferase initiates the sphingolipid biosynthesis pathway; SMPD1 hydrolyses sphingomyelin to ceramide downstream.', tentative: true },
  { from: 'SPTLC1', to: 'TARDBP', kind: 'shared-disease', strength: 0.4, pmids: [], note: 'Recently identified SPTLC1 variants cause juvenile ALS; both linked to motor-neuron lipid-handling failure.', tentative: true },
  { from: 'ELOVL5', to: 'ATXN3',  kind: 'shared-disease', strength: 0.35, pmids: [], note: 'SCA38 (ELOVL5) and SCA3 (ATXN3) — SCA family; convergent cerebellar vulnerability.', tentative: true },

  // --- Prion / chaperone ---
  { from: 'STIP1',  to: 'PRNP',   kind: 'receptor-ligand', strength: 0.65, pmids: [], note: 'Secreted STI1/HOP binds cellular PrPc as a neuroprotective ligand; STI1-PrP signalling drives neurite outgrowth and protein quality control.' },
  { from: 'STIP1',  to: 'SQSTM1', kind: 'shared-mechanism', strength: 0.4, pmids: [], note: 'STIP1 acts as an HSP70-HSP90 co-chaperone; protein-quality-control crosstalk with autophagic substrate adaptors.', tentative: true },

  // --- Cross-cluster bridges that emerge from the new genes ---
  { from: 'NEFL',   to: 'TARDBP', kind: 'modifier', strength: 0.6, pmids: [], note: 'NfL CSF/serum is the principal biomarker of ongoing axonal injury in ALS, FTD, AD, MS — the cross-disease readout.', tentative: true },
  { from: 'CHCHD2', to: 'CHCHD10',kind: 'complex', strength: 0.85, pmids: [], note: 'CHCHD2 and CHCHD10 are paralogous IMS twin-CX9C proteins; co-aggregate and have overlapping ALS-PD phenotypes.' },
  { from: 'CSF1R',  to: 'TMEM106B', kind: 'shared-mechanism', strength: 0.4, pmids: [], note: 'CSF1R-driven microglia and TMEM106B (FTD modifier; lysosomal) converge on FTD-TDP risk.', tentative: true },
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
