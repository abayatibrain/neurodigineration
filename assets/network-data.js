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
