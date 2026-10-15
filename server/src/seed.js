import bcrypt from 'bcryptjs';
import { db, migrate } from './db.js';

migrate();

const wipe = [
  'publication_authors','project_members','rsvps','bookings','applications',
  'messages','partners','positions','events','news','datasets','publications',
  'projects','people','groups','instruments','users'
];
db.exec('PRAGMA foreign_keys = OFF;');
for (const t of wipe) db.exec(`DELETE FROM ${t}; DELETE FROM sqlite_sequence WHERE name='${t}';`);
db.exec('PRAGMA foreign_keys = ON;');

const ins = (sql) => db.prepare(sql);

/* ---------------------------------------------------------------- GROUPS */
const groupRows = [
  {
    slug: 'comparative-genomics', accent: 'green', founded: 2016,
    name_mk: 'Компаративна геномика',
    name_en: 'Comparative Genomics',
    tagline_mk: 'Читање на еволуцијата запишана во геномите',
    tagline_en: 'Reading evolution as it is written in genomes',
    description_mk: 'Групата развива алгоритми за порамнување и филогенетска реконструкција за споредување на геномите на балканските ендемични видови. Работиме на скалабилни методи за откривање структурни варијанти и анотација на некодирачки региони.',
    description_en: 'The group develops alignment and phylogenetic reconstruction algorithms used to compare genomes of endemic Balkan species. We work on scalable structural-variant discovery and on annotation of non-coding regions.'
  },
  {
    slug: 'structural-bioinformatics', accent: 'blue', founded: 2018,
    name_mk: 'Структурна биоинформатика',
    name_en: 'Structural Bioinformatics',
    tagline_mk: 'Од секвенца до форма, од форма до функција',
    tagline_en: 'From sequence to shape, from shape to function',
    description_mk: 'Ја проучуваме врската меѓу аминокиселинската секвенца и тридимензионалната структура на протеините. Развиваме модели за предвидување места на врзување и процена на стабилноста на мутантите.',
    description_en: 'We study the relation between amino-acid sequence and three-dimensional protein structure. We build models for binding-site prediction and for stability assessment of engineered mutants.'
  },
  {
    slug: 'microbiome-ml', accent: 'amber', founded: 2021,
    name_mk: 'Микробиом и машинско учење',
    name_en: 'Microbiome & Machine Learning',
    tagline_mk: 'Екосистеми премали за да се видат, премногу важни за да се игнорираат',
    tagline_en: 'Ecosystems too small to see, too important to ignore',
    description_mk: 'Комбинираме метагеномско секвенционирање со методи на машинско учење за да ги разбереме микробните заедници во Охридското Езеро и почвите на Шар Планина.',
    description_en: 'We combine metagenomic sequencing with machine-learning methods to understand microbial communities in Lake Ohrid and in the soils of Šar Mountain.'
  }
];
const gStmt = ins(`INSERT INTO groups (slug,name_mk,name_en,tagline_mk,tagline_en,description_mk,description_en,accent,founded)
  VALUES (@slug,@name_mk,@name_en,@tagline_mk,@tagline_en,@description_mk,@description_en,@accent,@founded)`);
groupRows.forEach(g => gStmt.run(g));
const G = Object.fromEntries(db.prepare('SELECT slug,id FROM groups').all().map(r => [r.slug, r.id]));

/* ---------------------------------------------------------------- PEOPLE */
const peopleRows = [
  { slug:'ana-trajkovska', name_mk:'проф. д-р Ана Трајковска', name_en:'Prof. Ana Trajkovska',
    role_mk:'Директорка на лабораторијата', role_en:'Laboratory Director', seniority:'faculty',
    group_id:G['comparative-genomics'], email:'a.trajkovska@genomika.mk', orcid:'0000-0002-1825-0097', github:'atrajkovska',
    interests:'филогеномика;структурни варијанти;алгоритми за порамнување', joined_year:2016, hue:96,
    bio_mk: 'Ана ја основала лабораторијата во 2016 година, по десет години работа во Европскиот институт за биоинформатика. Ја интересира како изборот на алгоритам влијае врз биолошките заклучоци — тема за која предава и на додипломски студии.',
    bio_en:'Ana founded the laboratory in 2016 after ten years at the European Bioinformatics Institute. Her interest is how algorithmic choice shapes biological conclusions — a topic she also teaches at undergraduate level.' },
  { slug:'marko-stefanovski', name_mk:'д-р Марко Стефановски', name_en:'Dr. Marko Stefanovski',
    role_mk:'Раководител на група', role_en:'Group Leader', seniority:'faculty',
    group_id:G['comparative-genomics'], email:'m.stefanovski@genomika.mk', orcid:'0000-0001-5109-3700', github:'mstefanovski',
    interests:'структурни варијанти;long-read секвенционирање;графови на геноми', joined_year:2017, hue:86,
    bio_mk: 'Марко работи на пангеномски графови и откривање структурни варијанти со помош на долги отчитувања. Пред да се приклучи на лабораторијата, работел во областа на клиничката геномика во Загреб.',
    bio_en:'Marko works on pangenome graphs and structural-variant detection from long reads. Before joining he worked in clinical genomics in Zagreb.' },
  { slug:'elena-risteska', name_mk:'д-р Елена Ристеска', name_en:'Dr. Elena Risteska',
    role_mk:'Раководителка на група', role_en:'Group Leader', seniority:'faculty',
    group_id:G['structural-bioinformatics'], email:'e.risteska@genomika.mk', orcid:'0000-0003-4321-8877', github:'eristeska',
    interests:'предвидување структура;молекуларна динамика;дизајн на протеини', joined_year:2018, hue:176,
    bio_mk: 'Елена ја води групата за структурна биоинформатика. Работи на методи за процена на термостабилноста на инженерски модифицирани ензими без потреба од скапи симулации.',
    bio_en:'Elena leads the structural bioinformatics group. She works on methods that assess the thermostability of engineered enzymes without requiring expensive simulations.' },
  { slug:'damjan-kovachevikj', name_mk:'д-р Дамјан Ковачевиќ', name_en:'Dr. Damjan Kovachevikj',
    role_mk:'Раководител на група', role_en:'Group Leader', seniority:'faculty',
    group_id:G['microbiome-ml'], email:'d.kovachevikj@genomika.mk', orcid:'0000-0002-9987-1122', github:'dkova',
    interests:'метагеномика;репрезентациско учење;еколошка статистика', joined_year:2021, hue:38,
    bio_mk: 'Дамјан ја поврзува микробната екологија со современото машинско учење. Тој го координира долгорочното следење на микробиомот на Охридското Езеро.',
    bio_en:'Damjan connects microbial ecology with modern machine learning. He coordinates the long-term monitoring of the Lake Ohrid microbiome.' },
  { slug:'ivana-petrushevska', name_mk:'д-р Ивана Петрушевска', name_en:'Dr. Ivana Petrushevska',
    role_mk:'Постдокторска истражувачка', role_en:'Postdoctoral Researcher', seniority:'postdoc',
    group_id:G['structural-bioinformatics'], email:'i.petrushevska@genomika.mk', orcid:'0000-0001-7766-5511', github:'ipetrushevska',
    interests:'места за врзување;графовски невронски мрежи', joined_year:2022, hue:165,
    bio_mk: 'Ивана развива графовски невронски мрежи што ги предвидуваат активните места во ензимите на екстремофилните организми.',
    bio_en:'Ivana develops graph neural networks that predict active sites in enzymes from extremophile organisms.' },
  { slug:'nikola-avramovski', name_mk:'Никола Аврамовски', name_en:'Nikola Avramovski',
    role_mk:'Докторанд', role_en:'PhD Candidate', seniority:'phd',
    group_id:G['comparative-genomics'], email:'n.avramovski@genomika.mk', orcid:'0009-0004-3311-2200', github:'navramovski',
    interests:'порамнување на секвенци;SIMD оптимизација', joined_year:2022, hue:104,
    bio_mk: 'Никола работи на векторизирани имплементации на алгоритмот Smith–Waterman што се извршуваат директно во веб-прелистувач.',
    bio_en:'Nikola works on vectorised Smith–Waterman implementations that run directly inside a web browser.' },
  { slug:'sara-jovanoska', name_mk:'Сара Јованоска', name_en:'Sara Jovanoska',
    role_mk:'Докторандка', role_en:'PhD Candidate', seniority:'phd',
    group_id:G['microbiome-ml'], email:'s.jovanoska@genomika.mk', orcid:'0009-0007-8899-1010', github:'sjovanoska',
    interests:'16S rRNA;диверзитет;биостатистика', joined_year:2023, hue:44,
    bio_mk: 'Сара ги анализира сезонските промени во микробните заедници и развива робусни мерки за разновидност кај мал број примероци.',
    bio_en:'Sara analyses seasonal shifts in microbial communities and works on robust diversity measures for small samples.' },
  { slug:'filip-micevski', name_mk:'Филип Мицевски', name_en:'Filip Micevski',
    role_mk:'Инженер за истражувачки софтвер', role_en:'Research Software Engineer', seniority:'staff',
    group_id:G['comparative-genomics'], email:'f.micevski@genomika.mk', orcid:'', github:'fmicevski',
    interests:'веб-платформи;репродуцибилност;CI за наука', joined_year:2019, hue:120,
    bio_mk: 'Филип ги одржува сите алатки на оваа веб-страница. Верува дека истражувачки метод навистина постои само кога и други можат да го применат.',
    bio_en:'Filip maintains every tool you see on this site. He believes a research method does not exist until somebody else can run it.' },
  { slug:'tamara-gjorgjievska', name_mk:'Тамара Ѓорѓиевска', name_en:'Tamara Gjorgjievska',
    role_mk:'Управничка со податоци', role_en:'Data Steward', seniority:'staff',
    group_id:G['microbiome-ml'], email:'t.gjorgjievska@genomika.mk', orcid:'', github:'',
    interests:'FAIR принципи;метаподатоци;архивирање', joined_year:2021, hue:30,
    bio_mk: 'Тамара се грижи податочните множества на лабораторијата да можат лесно да се пронајдат, да бидат достапни и повторно да се користат.',
    bio_en:'Tamara makes sure the laboratory datasets stay findable, accessible and reusable.' },
  { slug:'bojan-naumovski', name_mk:'Бојан Наумовски', name_en:'Bojan Naumovski',
    role_mk:'Магистрант', role_en:'MSc Student', seniority:'msc',
    group_id:G['structural-bioinformatics'], email:'b.naumovski@genomika.mk', orcid:'', github:'bnaumovski',
    interests:'визуелизација на протеини;WebGL', joined_year:2024, hue:186,
    bio_mk: 'Бојан ја пишува магистерската теза за интерактивна визуелизација на конформациски ансамбли.',
    bio_en:'Bojan is writing his MSc thesis on interactive visualisation of conformational ensembles.' }
];
const pStmt = ins(`INSERT INTO people (slug,name_mk,name_en,role_mk,role_en,seniority,group_id,email,orcid,github,bio_mk,bio_en,interests,joined_year,hue)
  VALUES (@slug,@name_mk,@name_en,@role_mk,@role_en,@seniority,@group_id,@email,@orcid,@github,@bio_mk,@bio_en,@interests,@joined_year,@hue)`);
peopleRows.forEach(p => pStmt.run(p));
const P = Object.fromEntries(db.prepare('SELECT slug,id FROM people').all().map(r => [r.slug, r.id]));

/* -------------------------------------------------------------- PROJECTS */
const projectRows = [
  { slug:'balkan-pangenome', group_id:G['comparative-genomics'], status:'active', funder:'Horizon Europe', grant_code:'HE-101089442', budget_eur:840000, start_date:'2024-01-01', end_date:'2027-12-31',
    title_mk:'Балкански пангеном на ендемични видови',
    title_en:'Balkan Pangenome of Endemic Species',
    abstract_mk: 'Градиме графовски пангеном врз основа на 120 ендемични видови од Балканскиот Полуостров за да ги откриеме структурните варијанти што им овозможуваат да се приспособат на изолирани живеалишта.',
    abstract_en:'We are building a graph pangenome from 120 endemic species of the Balkan Peninsula in order to reveal the structural variants that enable their adaptation to isolated habitats.',
    members:['ana-trajkovska','marko-stefanovski','nikola-avramovski','filip-micevski'] },
  { slug:'ohrid-microbiome', group_id:G['microbiome-ml'], status:'active', funder:'Фонд за иновации / Innovation Fund', grant_code:'IF-2023-114', budget_eur:310000, start_date:'2023-06-01', end_date:'2026-05-31',
    title_mk: 'Долгорочно следење на микробиомот на Охридското Езеро',
    title_en:'Long-term Monitoring of the Lake Ohrid Microbiome',
    abstract_mk: 'Секој месец земаме примероци од дванаесет точки на различни длабочини во езерото и ги следиме промените во микробните заедници со помош на метагеномско секвенционирање.',
    abstract_en:'Every month we sample twelve depth points across the lake and follow shifts in microbial communities using metagenomic sequencing.',
    members:['damjan-kovachevikj','sara-jovanoska','tamara-gjorgjievska'] },
  { slug:'thermostable-enzymes', group_id:G['structural-bioinformatics'], status:'active', funder:'МОН / Ministry of Education', grant_code:'MON-BIO-09', budget_eur:190000, start_date:'2024-09-01', end_date:'2027-08-31',
    title_mk:'Пресметковен дизајн на термостабилни ензими',
    title_en:'Computational Design of Thermostable Enzymes',
    abstract_mk: 'Развиваме брз модел што ја предвидува промената на слободната енергија при точкести мутации кај индустриски ензими што функционираат на температури над 70 °C.',
    abstract_en:'We are developing a fast model predicting the free-energy change of point mutations for industrial enzymes operating above 70 °C.',
    members:['elena-risteska','ivana-petrushevska','bojan-naumovski'] },
  { slug:'webalign', group_id:G['comparative-genomics'], status:'active', funder:'Chan Zuckerberg Initiative EOSS', grant_code:'CZI-EOSS-6-0233', budget_eur:120000, start_date:'2025-01-01', end_date:'2026-12-31',
    title_mk: 'WebAlign: порамнување на секвенци во прелистувач',
    title_en:'WebAlign: Alignment in the Browser',
    abstract_mk: 'Отворена библиотека што им овозможува на студентите и наставниците да користат класични алгоритми за порамнување без инсталација и без сервер.',
    abstract_en:'An open library that lets students and teachers run classical alignment algorithms with no installation and no server.',
    members:['nikola-avramovski','filip-micevski','ana-trajkovska'] },
  { slug:'shar-soil', group_id:G['microbiome-ml'], status:'completed', funder:'DAAD', grant_code:'DAAD-57598', budget_eur:74000, start_date:'2021-10-01', end_date:'2024-09-30',
    title_mk: 'Микробна разновидност во почвите на Шар Планина',
    title_en:'Microbial Diversity of Šar Mountain Soils',
    abstract_mk: 'Тригодишно истражување по висински трансект што ги мапира промените во микробната разновидност од 900 до 2.500 метри надморска височина.',
    abstract_en:'A three-year altitudinal transect mapping the change of microbial diversity from 900 to 2500 metres.',
    members:['damjan-kovachevikj','sara-jovanoska'] },
  { slug:'openbio-edu', group_id:G['structural-bioinformatics'], status:'planned', funder:'Erasmus+', grant_code:'ERA-2026-KA220', budget_eur:250000, start_date:'2026-03-01', end_date:'2029-02-28',
    title_mk:'OpenBio-EDU: отворени наставни ресурси за биоинформатика',
    title_en:'OpenBio-EDU: Open Teaching Resources for Bioinformatics',
    abstract_mk: 'Конзорциум од пет универзитети што подготвува двојазични интерактивни наставни материјали за додипломски курсеви по биоинформатика.',
    abstract_en:'A five-university consortium building bilingual interactive teaching material for undergraduate bioinformatics courses.',
    members:['elena-risteska','filip-micevski','ana-trajkovska','bojan-naumovski'] }
];
const prStmt = ins(`INSERT INTO projects (slug,title_mk,title_en,abstract_mk,abstract_en,group_id,status,funder,grant_code,budget_eur,start_date,end_date)
  VALUES (@slug,@title_mk,@title_en,@abstract_mk,@abstract_en,@group_id,@status,@funder,@grant_code,@budget_eur,@start_date,@end_date)`);
const pmStmt = ins('INSERT INTO project_members (project_id, person_id, role) VALUES (?,?,?)');
projectRows.forEach(p => {
  const { members, ...row } = p;
  const { lastInsertRowid } = prStmt.run(row);
  members.forEach((m, i) => pmStmt.run(lastInsertRowid, P[m], i === 0 ? 'PI' : 'member'));
});

/* ---------------------------------------------------------- PUBLICATIONS */
const pubs = [
  ['A graph pangenome of 120 endemic Balkan species reveals recurrent inversions','Trajkovska A, Stefanovski M, Avramovski N, Micevski F','Nature Communications',2025,'article','10.1038/s41467-025-48812-1',31,1,'comparative-genomics','pangenome;structural variants;inversion'],
  ['Vectorised Smith–Waterman for the browser: WebAssembly SIMD in teaching contexts','Avramovski N, Micevski F, Trajkovska A','Bioinformatics',2025,'article','10.1093/bioinformatics/btaf221',18,1,'comparative-genomics','alignment;SIMD;education'],
  ['Seasonal restructuring of the Lake Ohrid bacterioplankton community','Kovachevikj D, Jovanoska S, Gjorgjievska T','The ISME Journal',2025,'article','10.1038/s41396-025-01677-2',12,1,'microbiome-ml','metagenomics;limnology;diversity'],
  ['Fast estimation of mutational free-energy change without molecular dynamics','Risteska E, Petrushevska I, Naumovski B','Protein Science',2025,'article','10.1002/pro.5109',9,1,'structural-bioinformatics','stability;ddG;enzyme design'],
  ['Graph neural networks localise catalytic residues in extremophile enzymes','Petrushevska I, Risteska E','Journal of Chemical Information and Modeling',2024,'article','10.1021/acs.jcim.4c00873',44,1,'structural-bioinformatics','GNN;active site;extremophiles'],
  ['Benchmarking long-read structural variant callers on highly repetitive plant genomes','Stefanovski M, Trajkovska A','Genome Biology',2024,'article','10.1186/s13059-024-03299-3',67,1,'comparative-genomics','long reads;benchmark;SV'],
  ['Altitudinal gradients shape soil microbial diversity on Šar Mountain','Jovanoska S, Kovachevikj D','FEMS Microbiology Ecology',2024,'article','10.1093/femsec/fiae041',23,1,'microbiome-ml','soil;altitude;16S'],
  ['Reproducible bioinformatics teaching with browser-native tools','Micevski F, Trajkovska A','PLOS Computational Biology',2024,'article','10.1371/journal.pcbi.1012044',29,1,'comparative-genomics','education;reproducibility'],
  ['On the choice of gap penalties in pairwise protein alignment','Trajkovska A, Avramovski N','BMC Bioinformatics',2023,'article','10.1186/s12859-023-05412-y',52,1,'comparative-genomics','alignment;gap penalty'],
  ['Conformational ensembles as first-class citizens in structure databases','Naumovski B, Risteska E','Structure',2023,'article','10.1016/j.str.2023.09.004',15,0,'structural-bioinformatics','ensembles;databases'],
  ['A FAIR data workflow for small environmental genomics laboratories','Gjorgjievska T, Kovachevikj D','Scientific Data',2023,'article','10.1038/s41597-023-02455-x',38,1,'microbiome-ml','FAIR;metadata;workflow'],
  ['Codon usage bias correlates with growth temperature across 4,300 prokaryotes','Kovachevikj D, Risteska E, Trajkovska A','Molecular Biology and Evolution',2023,'article','10.1093/molbev/msad187',81,1,'microbiome-ml','codon usage;thermophiles'],
  ['UPGMA revisited: when simple clustering still wins','Avramovski N, Stefanovski M','Systematic Biology',2022,'article','10.1093/sysbio/syac055',26,0,'comparative-genomics','phylogenetics;UPGMA'],
  ['Restriction site prediction as a teaching device for string algorithms','Micevski F','Journal of Open Source Education',2022,'article','10.21105/jose.00142',7,1,'comparative-genomics','education;string matching'],
  ['Thermostability determinants in archaeal glycoside hydrolases','Risteska E, Petrushevska I','FEBS Journal',2022,'article','10.1111/febs.16544',49,1,'structural-bioinformatics','thermostability;archaea'],
  ['Sampling depth and the illusion of microbial rarity','Jovanoska S, Gjorgjievska T, Kovachevikj D','Environmental Microbiology',2022,'article','10.1111/1462-2920.16077',33,1,'microbiome-ml','rarefaction;sampling'],
  ['Hidden Markov models for prokaryotic gene finding: a practical reassessment','Stefanovski M','NAR Genomics and Bioinformatics',2021,'article','10.1093/nargab/lqab092',41,1,'comparative-genomics','HMM;gene finding'],
  ['GenomikaLab at ISMB 2021: browser-side genomics','Trajkovska A, Micevski F','ISMB Proceedings',2021,'conference','10.5281/zenodo.5125533',5,1,'comparative-genomics','conference;demo'],
  ['Sequence logos considered harmful for low-complexity regions','Petrushevska I','Bioinformatics Advances',2021,'article','10.1093/bioadv/vbab019',19,1,'structural-bioinformatics','sequence logo;visualisation'],
  ['An open protocol for monthly limnological metagenomic sampling','Gjorgjievska T, Jovanoska S','protocols.io',2021,'preprint','10.17504/protocols.io.bvj2n4qe',11,1,'microbiome-ml','protocol;sampling'],
  ['Phylogenetic signal in mitochondrial genomes of Balkan cave fauna','Trajkovska A, Stefanovski M','Molecular Phylogenetics and Evolution',2020,'article','10.1016/j.ympev.2020.106877',73,0,'comparative-genomics','phylogenetics;cave fauna'],
  ['Teaching dynamic programming through biological sequence alignment','Trajkovska A','ACM SIGCSE',2019,'conference','10.1145/3287324.3287401',58,0,'comparative-genomics','education;dynamic programming']
];
const pubStmt = ins(`INSERT INTO publications (title,authors,venue,year,type,doi,citations,open_access,group_id,keywords,abstract)
  VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
const paStmt = ins('INSERT INTO publication_authors (publication_id, person_id, position) VALUES (?,?,?)');
const nameToSlug = {
  'Trajkovska A':'ana-trajkovska','Stefanovski M':'marko-stefanovski','Risteska E':'elena-risteska',
  'Kovachevikj D':'damjan-kovachevikj','Petrushevska I':'ivana-petrushevska','Avramovski N':'nikola-avramovski',
  'Jovanoska S':'sara-jovanoska','Micevski F':'filip-micevski','Gjorgjievska T':'tamara-gjorgjievska',
  'Naumovski B':'bojan-naumovski'
};
pubs.forEach(p => {
  const [title,authors,venue,year,type,doi,citations,oa,gslug,keywords] = p;
  const abstract = `${title}. Published in ${venue} (${year}). This record is part of the demonstration corpus of GenomikaLab and is provided for interface evaluation purposes.`;
  const { lastInsertRowid } = pubStmt.run(title,authors,venue,year,type,doi,citations,oa,G[gslug],keywords,abstract);
  authors.split(', ').forEach((a, i) => {
    const slug = nameToSlug[a.trim()];
    if (slug) paStmt.run(lastInsertRowid, P[slug], i);
  });
});

/* -------------------------------------------------------------- DATASETS */
const datasets = [
  { slug:'ohrid-16s-2023-2025', format:'FASTQ + TSV', size_mb:2840.5, license:'CC BY 4.0', year:2025, downloads:412, doi:'10.5281/zenodo.11220034', organism:'mixed bacterioplankton', rows_count:1440,
    title_mk:'16S rRNA профили на Охридското Езеро (2023–2025)', title_en:'Lake Ohrid 16S rRNA profiles (2023–2025)',
    description_mk: 'Месечни профили на 16S ампликонски секвенци од дванаесет точки на различни длабочини, со целосни метаподатоци за температурата, pH-вредноста и растворениот кислород.',
    description_en:'Monthly 16S amplicon profiles from twelve points at different depths, with full metadata for temperature, pH and dissolved oxygen.',
    preview_csv:'sample_id,date,depth_m,temp_c,ph,do_mg_l,shannon,observed_otus\nOHR-2401,2024-01-15,5,7.8,8.21,10.4,4.12,318\nOHR-2402,2024-01-15,30,6.9,8.17,9.8,3.87,286\nOHR-2403,2024-01-15,100,6.1,8.09,8.1,3.41,241\nOHR-2404,2024-02-14,5,7.2,8.24,10.9,4.05,309\nOHR-2405,2024-02-14,30,6.6,8.19,10.1,3.92,297\nOHR-2406,2024-02-14,100,6.0,8.11,8.4,3.38,238\nOHR-2407,2024-03-13,5,9.4,8.26,10.2,4.31,342\nOHR-2408,2024-03-13,30,7.1,8.20,9.6,3.99,301' },
  { slug:'balkan-pangenome-v2', format:'GFA + VCF', size_mb:15420.0, license:'CC BY-SA 4.0', year:2025, downloads:187, doi:'10.5281/zenodo.11889201', organism:'120 endemic species', rows_count:120,
    title_mk:'Балкански пангеномски граф v2.0', title_en:'Balkan pangenome graph v2.0',
    description_mk: 'Графовска репрезентација на 120 геноми во формат GFA, придружена со датотека VCF со структурни варијанти идентификувани во однос на графот.',
    description_en:'Graph representation of 120 genomes in GFA format, accompanied by a VCF of structural variants called against the graph.',
    preview_csv:'species,assembly_n50_mb,genome_size_mb,contigs,sv_count,inversions\nProteus anguinus,18.4,2340,412,10422,318\nAstacus astacus,12.1,1810,688,8931,244\nSalmo letnica,9.7,1120,904,7712,201\nPelagonia orientalis,22.3,760,188,4021,96\nDinaromys bogdanovi,15.8,2510,502,11884,377' },
  { slug:'shar-soil-transect', format:'CSV', size_mb:38.2, license:'CC0 1.0', year:2024, downloads:963, doi:'10.5281/zenodo.10553120', organism:'soil microbiome', rows_count:2160,
    title_mk: 'Трансект на почвениот микробиом на Шар Планина', title_en:'Šar Mountain soil microbiome transect',
    description_mk: 'Метрики за разновидност и хемиски параметри на почвата за 2.160 примероци собрани долж висински градиент од 900 до 2.500 метри надморска височина.',
    description_en:'Diversity metrics and soil chemistry for 2160 samples collected along an altitudinal gradient from 900 to 2500 metres.',
    preview_csv:'site,altitude_m,ph,organic_c_pct,n_total_pct,shannon,chao1\nSAR-01,912,5.9,4.21,0.31,5.02,842\nSAR-02,1104,5.7,4.88,0.36,5.14,901\nSAR-03,1350,5.4,5.62,0.41,5.21,944\nSAR-04,1610,5.1,6.10,0.44,5.09,913\nSAR-05,1880,4.9,6.77,0.49,4.88,861\nSAR-06,2140,4.7,7.02,0.52,4.61,798\nSAR-07,2405,4.6,6.44,0.47,4.22,702' },
  { slug:'thermostability-benchmark', format:'CSV + PDB', size_mb:512.7, license:'CC BY 4.0', year:2025, downloads:274, doi:'10.5281/zenodo.11704455', organism:'archaeal enzymes', rows_count:3841,
    title_mk: 'Референтен тест за термостабилност при точкести мутации', title_en:'Point-mutation thermostability benchmark',
    description_mk: 'Експериментално измерени вредности на ΔΔG за 3.841 точкести мутации кај 44 археални ензими, заедно со соодветните структури.',
    description_en:'Experimentally measured ΔΔG values for 3841 point mutations across 44 archaeal enzymes, with accompanying structures.',
    preview_csv:'pdb_id,mutation,ddg_kcal_mol,temp_c,method,chain\n1AKY,A45V,-0.82,55,DSC,A\n1AKY,G78D,1.44,55,DSC,A\n3TIM,V12I,-1.10,60,CD,A\n3TIM,K57E,0.31,60,CD,A\n1LYZ,T40S,0.95,50,DSF,A\n1LYZ,I55L,-0.44,50,DSF,A' },
  { slug:'codon-usage-4300', format:'TSV', size_mb:96.4, license:'CC BY 4.0', year:2023, downloads:1508, doi:'10.5281/zenodo.8123945', organism:'4300 prokaryotes', rows_count:4300,
    title_mk: 'Употреба на кодони кај 4.300 прокариоти', title_en:'Codon usage across 4300 prokaryotes',
    description_mk: 'Релативна употреба на кодони за секој геном, со наведена оптимална температура на раст за секој организам.',
    description_en:'Relative codon usage per genome, annotated with the optimal growth temperature of each organism.',
    preview_csv:'organism,domain,opt_growth_temp_c,gc_pct,cai_mean,enc\nThermus thermophilus,Bacteria,68,69.4,0.74,42.1\nEscherichia coli,Bacteria,37,50.8,0.68,52.3\nPyrococcus furiosus,Archaea,100,40.8,0.71,39.8\nBacillus subtilis,Bacteria,30,43.5,0.66,53.9\nMethanocaldococcus jannaschii,Archaea,85,31.4,0.69,41.2' },
  { slug:'teaching-sequences', format:'FASTA', size_mb:1.2, license:'CC0 1.0', year:2024, downloads:3204, doi:'10.5281/zenodo.10998112', organism:'curated', rows_count:240,
    title_mk:'Наставна збирка секвенци', title_en:'Teaching sequence collection',
    description_mk: 'Мала, внимателно одбрана збирка од 240 нуклеотидни и протеински секвенци, избрани за да ги илустрираат класичните алгоритми на оваа веб-страница.',
    description_en:'A small curated collection of 240 nucleotide and protein sequences chosen to illustrate the classical algorithms on this site.',
    preview_csv:'accession,type,length,description,difficulty\nEDU-001,DNA,240,Lambda phage fragment with EcoRI sites,easy\nEDU-002,DNA,1044,Human beta-globin coding region,easy\nEDU-003,PROT,141,Human haemoglobin alpha chain,easy\nEDU-004,DNA,3120,Repeat-rich plant intron,hard\nEDU-005,PROT,398,Thermophilic glycoside hydrolase,medium' }
];
const dStmt = ins(`INSERT INTO datasets (slug,title_mk,title_en,description_mk,description_en,format,size_mb,license,year,downloads,doi,organism,rows_count,preview_csv)
  VALUES (@slug,@title_mk,@title_en,@description_mk,@description_en,@format,@size_mb,@license,@year,@downloads,@doi,@organism,@rows_count,@preview_csv)`);
datasets.forEach(d => dStmt.run(d));

/* ------------------------------------------------------------------ NEWS */
const news = [
  { slug:'pangenome-nature-comms', date:'2025-06-12', tag:'publication',
    title_mk:'Нашиот балкански пангеном објавен во Nature Communications',
    title_en:'Our Balkan pangenome published in Nature Communications',
    excerpt_mk:'По три години работа, графовскиот пангеном од 120 ендемични видови е јавно достапен.',
    excerpt_en:'After three years of work, the graph pangenome of 120 endemic species is publicly available.',
    body_mk: 'Трудот опишува повторливи инверзии што независно се појавуваат кај неколку изолирани популации. Сите податоци и изворниот код се објавени под отворена лиценца, а графот може да се преземе од нашето складиште на податочни множества.',
    body_en:'The paper describes recurrent inversions that appear independently across several isolated populations. All data and code are released under an open licence, and the graph can be downloaded from our dataset repository.' },
  { slug:'webalign-czi-grant', date:'2025-02-03', tag:'grant',
    title_mk:'WebAlign доби поддршка од Chan Zuckerberg Initiative',
    title_en:'WebAlign receives Chan Zuckerberg Initiative support',
    excerpt_mk: 'Двегодишна поддршка за развој на отворени алатки за порамнување што работат директно во прелистувачот.',
    excerpt_en:'Two years of support to develop open alignment tools that run inside the browser.',
    body_mk: 'Финансирањето ќе овозможи целосно преработување на јадрото со WebAssembly SIMD, изработка на двојазична документација и подготовка на наставни материјали за додипломски курсеви.',
    body_en:'The funding will enable a complete rewrite of the core using WebAssembly SIMD, bilingual documentation, and teaching material for undergraduate courses.' },
  { slug:'open-day-2025', date:'2025-04-22', tag:'outreach',
    title_mk:'Отворен ден: 180 средношколци во лабораторијата',
    title_en:'Open day: 180 secondary-school students in the lab',
    excerpt_mk: 'Нашиот најпосетен ден на отворени врати досега, со работилници за читање ДНК-секвенци.',
    excerpt_en:'Our best-attended open day so far, with workshops on reading DNA sequences.',
    body_mk: 'Учениците ги користеа токму алатките достапни на оваа веб-страница за да ги идентификуваат отворените рамки на читање и да симулираат рестрикциска дигестија. Материјалите и понатаму се јавно достапни.',
    body_en:'Students used the very tools available on this site to identify open reading frames and to simulate a restriction digest. The materials remain publicly available.' },
  { slug:'new-sequencer', date:'2024-11-08', tag:'facility',
    title_mk: 'Нов секвенцер за долги отчитувања во лабораторијата',
    title_en:'New long-read sequencer in the facility',
    excerpt_mk:'Капацитетот за долги отчитувања се зголеми четирикратно.',
    excerpt_en:'Long-read capacity has increased fourfold.',
    body_mk: 'Инструментот може да се резервира преку системот на оваа веб-страница, вклучително и од надворешни академски корисници по субвенционирана цена.',
    body_en:'The instrument is bookable through the system on this site, including for external academic users at a subsidised rate.' },
  { slug:'sara-best-poster', date:'2024-09-19', tag:'award',
    title_mk: 'Сара Јованоска ја освои наградата за најдобар постер на ECCB',
    title_en:'Sara Jovanoska wins best poster award at ECCB',
    excerpt_mk: 'Наградата го признава нејзиниот придонес во истражувањето на привидната реткост на микробите при недоволно земање примероци.',
    excerpt_en:'The award recognises her work on the illusion of microbial rarity under shallow sampling.',
    body_mk: 'Истражувањето покажува дека вообичаените мерки за реткост систематски ја преценуваат разновидноста кога бројот на земени примероци е под одреден праг.',
    body_en:'The work shows that common rarity measures systematically overestimate diversity when sampling depth falls below a certain threshold.' },
  { slug:'phd-call-2026', date:'2025-08-30', tag:'people',
    title_mk: 'Отворен повик за две докторски позиции во 2026 година',
    title_en:'Call open for two PhD positions in 2026',
    excerpt_mk:'Пријавите се отворени до крајот на јануари 2026 година.',
    excerpt_en:'Applications are open until the end of January 2026.',
    body_mk: 'Бараме кандидати со образование од областа на информатиката, биологијата или математиката. Претходното искуство во биоинформатиката е предност, но не е задолжително.',
    body_en:'We are looking for candidates with a background in computer science, biology or mathematics. Prior bioinformatics experience is welcome but not required.' }
];
const nStmt = ins(`INSERT INTO news (slug,title_mk,title_en,excerpt_mk,excerpt_en,body_mk,body_en,date,tag)
  VALUES (@slug,@title_mk,@title_en,@excerpt_mk,@excerpt_en,@body_mk,@body_en,@date,@tag)`);
news.forEach(n => nStmt.run(n));

/* ---------------------------------------------------------------- EVENTS */
/**
 * `hour` is the intended local wall-clock time of the event; the value stored
 * is the equivalent instant in UTC, marked with a Z. Storing a bare local
 * string made it incomparable with SQLite's datetime('now'), which is UTC.
 */
function futureDate(offsetDays, hour) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, 0, 0, 0);
  return `${d.toISOString().slice(0, 19)}Z`;
}
const events = [
  { off:6, h:14, dur:1, kind:'seminar', capacity:60, location:'Амфитеатар А / Lecture Hall A', speaker:'Prof. Marit Andersen', affiliation:'University of Oslo',
    title_mk:'Пангеномски графови надвор од човечкиот геном', title_en:'Pangenome graphs beyond the human genome',
    description_mk: 'Гостински семинар за примена на графовски репрезентации кај видови со геноми што содржат голем број повторувачки секвенци.',
    description_en:'Guest seminar on applying graph representations to species with highly repetitive genomes.' },
  { off:13, h:10, dur:6, kind:'workshop', capacity:24, location:'Компјутерска лабораторија 2 / Computer Lab 2', speaker:'Filip Micevski', affiliation:'GenomikaLab',
    title_mk:'Работилница: порамнување на секвенци од нула', title_en:'Workshop: sequence alignment from scratch',
    description_mk: 'Еднодневна работилница на која учесниците имплементираат Needleman–Wunsch и Smith–Waterman и ги споредуваат резултатите со алатките достапни на оваа веб-страница.',
    description_en:'A one-day workshop in which participants implement Needleman–Wunsch and Smith–Waterman and compare results against the tools on this site.' },
  { off:21, h:15, dur:1, kind:'seminar', capacity:60, location:'Амфитеатар А / Lecture Hall A', speaker:'Dr. Elena Risteska', affiliation:'GenomikaLab',
    title_mk:'Колку структура е доволна за да се предвиди функција?', title_en:'How much structure is enough to predict function?',
    description_mk:'Внатрешен семинар со преглед на најновите резултати од групата за структурна биоинформатика.',
    description_en:'Internal seminar reviewing the latest results from the structural bioinformatics group.' },
  { off:34, h:9, dur:8, kind:'symposium', capacity:150, location:'Конгресен центар, Скопје / Congress Centre, Skopje', speaker:'', affiliation:'',
    title_mk:'Втор симпозиум за биоинформатика на Западен Балкан', title_en:'Second Western Balkans Bioinformatics Symposium',
    description_mk: 'Целодневен симпозиум со предавања, сесија со постери и панел-дискусија за отворената наука во регионот.',
    description_en:'A full-day symposium with talks, a poster session and a panel on open science in the region.' },
  { off:48, h:14, dur:2, kind:'outreach', capacity:180, location:'Фоаје / Foyer', speaker:'', affiliation:'',
    title_mk:'Отворен ден на лабораторијата', title_en:'Laboratory open day',
    description_mk:'Отворен настан за средношколци и за пошироката јавност, со демонстрации и кратки работилници.',
    description_en:'An open event for secondary-school students and the general public, with demonstrations and short workshops.' },
  { off:62, h:11, dur:1, kind:'defense', capacity:40, location:'Сала за одбрани / Defence Room', speaker:'Bojan Naumovski', affiliation:'GenomikaLab',
    title_mk:'Одбрана на магистерска теза: визуелизација на конформациски ансамбли', title_en:'MSc defence: visualising conformational ensembles',
    description_mk:'Јавна одбрана на магистерската теза, отворена за сите заинтересирани.',
    description_en:'Public defence of the MSc thesis, open to all interested attendees.' }
];
const eStmt = ins(`INSERT INTO events (title_mk,title_en,description_mk,description_en,starts_at,ends_at,location,speaker,affiliation,capacity,kind)
  VALUES (@title_mk,@title_en,@description_mk,@description_en,@starts_at,@ends_at,@location,@speaker,@affiliation,@capacity,@kind)`);
events.forEach(e => eStmt.run({
  ...e,
  starts_at: futureDate(e.off, e.h),
  ends_at: futureDate(e.off, e.h + e.dur)
}));

/* ----------------------------------------------------------- INSTRUMENTS */
const instruments = [
  { slug:'nanopore-promethion', category:'sequencing', location:'Соба 104 / Room 104', hourly_rate:45, requires_training:1, open_from:8, open_to:20, max_hours:6, status:'available',
    name_mk:'Нанопорен секвенцер PromethION 2', name_en:'Nanopore PromethION 2 sequencer',
    description_mk: 'Секвенционирање со долги отчитувања, до 290 Gb по проточна ќелија. Пред првата самостојна употреба задолжително е да се помине обука.',
    description_en:'Long-read sequencing, up to 290 Gb per flow cell. Training is mandatory before first independent use.' },
  { slug:'illumina-nextseq', category:'sequencing', location:'Соба 104 / Room 104', hourly_rate:38, requires_training:1, open_from:8, open_to:20, max_hours:6, status:'available',
    name_mk:'Illumina NextSeq 2000', name_en:'Illumina NextSeq 2000',
    description_mk: 'Секвенционирање со кратки отчитувања за ампликонски и целогеномски библиотеки.',
    description_en:'Short-read sequencing for amplicon and whole-genome libraries.' },
  { slug:'hpc-cluster', category:'computing', location:'Дата центар / Data centre', hourly_rate:6, requires_training:0, open_from:0, open_to:24, max_hours:12, status:'available',
    name_mk:'Пресметковен кластер „Вардар“', name_en:'“Vardar” compute cluster',
    description_mk: '128 јадра, 1 TB RAM и четири графички процесори. Со резервацијата се добива приоритет во редот за извршување на распоредувачот.',
    description_en:'128 cores, 1 TB RAM and four GPUs. A booking grants a priority queue on the scheduler.' },
  { slug:'qpcr-station', category:'wet-lab', location:'Соба 108 / Room 108', hourly_rate:12, requires_training:0, open_from:8, open_to:18, max_hours:4, status:'available',
    name_mk:'qPCR станица', name_en:'qPCR station',
    description_mk: 'Квантитативна PCR-анализа со 96 бунарчиња и четири канали за детекција.',
    description_en:'Quantitative PCR with 96 wells and four detection channels.' },
  { slug:'bioanalyzer', category:'wet-lab', location:'Соба 108 / Room 108', hourly_rate:15, requires_training:1, open_from:8, open_to:18, max_hours:3, status:'maintenance',
    name_mk:'Биоанализатор за контрола на квалитет', name_en:'Bioanalyzer for quality control',
    description_mk: 'Проверка на интегритетот и распределбата на должините на нуклеинските киселини. Опремата е на сервис до крајот на месецот.',
    description_en:'Integrity and length-distribution checks for nucleic acids. Under service until the end of the month.' },
  { slug:'visualisation-wall', category:'computing', location:'Соба 201 / Room 201', hourly_rate:0, requires_training:0, open_from:8, open_to:22, max_hours:4, status:'available',
    name_mk:'Ѕид за визуелизација', name_en:'Visualisation wall',
    description_mk: 'Дисплеј од девет панели за преглед на геномски прелистувачи и структури во голем формат. Бесплатен за внатрешни корисници.',
    description_en:'A nine-panel display for reviewing genome browsers and structures at large format. Free for internal users.' }
];
const iStmt = ins(`INSERT INTO instruments (slug,name_mk,name_en,description_mk,description_en,category,location,hourly_rate,requires_training,open_from,open_to,max_hours,status)
  VALUES (@slug,@name_mk,@name_en,@description_mk,@description_en,@category,@location,@hourly_rate,@requires_training,@open_from,@open_to,@max_hours,@status)`);
instruments.forEach(i => iStmt.run(i));
const I = Object.fromEntries(db.prepare('SELECT slug,id FROM instruments').all().map(r => [r.slug, r.id]));

/* ------------------------------------------------------------- POSITIONS */
const positions = [
  { slug:'phd-pangenome-2026', kind:'phd', group_id:G['comparative-genomics'], deadline:'2026-01-31', is_open:1,
    title_mk:'Докторска позиција: алгоритми за пангеномски графови',
    title_en:'PhD position: algorithms for pangenome graphs',
    description_mk: 'Четиригодишна докторска позиција со обезбедено финансирање во рамките на проектот „Балкански пангеном“. Кандидатот ќе развива методи за идентификување структурни варијанти со помош на графовски репрезентации.',
    description_en:'A four-year funded PhD position within the Balkan Pangenome project. The candidate will develop methods for calling structural variants against graph representations.',
    requirements_mk: 'Диплома по информатика, математика или сродна област;Добро познавање на програмирање во C++, Rust или Python;Интерес за биологија, без услов за претходно знаење;Работно познавање на англискиот јазик',
    requirements_en:'Degree in computer science, mathematics or a related field;Solid programming in C++, Rust or Python;Interest in biology, prior knowledge not required;Working knowledge of English' },
  { slug:'phd-microbiome-2026', kind:'phd', group_id:G['microbiome-ml'], deadline:'2026-01-31', is_open:1,
    title_mk:'Докторска позиција: машинско учење за метагеномски податоци',
    title_en:'PhD position: machine learning for metagenomic data',
    description_mk: 'Позиција во групата за микробиом, насочена кон учење репрезентации од временски серии на микробни заедници.',
    description_en:'A position in the microbiome group focused on representation learning over time series of microbial communities.',
    requirements_mk: 'Диплома по информатика, статистика или биологија;Искуство со Python и библиотеки за машинско учење;Подготвеност за учество во теренска работа неколкупати годишно',
    requirements_en:'Degree in computer science, statistics or biology;Experience with Python and machine-learning libraries;Willingness to join field work a few times a year' },
  { slug:'rse-webtools', kind:'staff', group_id:G['structural-bioinformatics'], deadline:'2025-12-15', is_open:1,
    title_mk:'Инженер за истражувачки софтвер (веб-алатки)',
    title_en:'Research software engineer (web tools)',
    description_mk: 'Работно место со полно работно време за развој и одржување на јавните алатки на лабораторијата, вклучително и оние што се извршуваат директно во прелистувачот.',
    description_en:'A full-time role developing and maintaining the laboratory public tools, including those that execute directly in the browser.',
    requirements_mk: 'Најмалку две години искуство со TypeScript и React;Познавање на пристапноста и перформансите;Способност за соработка со научници, а не само со програмери',
    requirements_en:'At least two years of experience with TypeScript and React;Understanding of accessibility and performance;Comfort working with scientists, not only with programmers' },
  { slug:'intern-summer-2026', kind:'internship', group_id:G['comparative-genomics'], deadline:'2026-03-15', is_open:1,
    title_mk:'Летна пракса за студенти (8 недели)',
    title_en:'Summer internship for students (8 weeks)',
    description_mk: 'Платена летна пракса за студенти на додипломски студии. Секој практикант работи на едно мало, јасно ограничено истражувачко прашање и на крајот ги презентира резултатите пред лабораторијата.',
    description_en:'A paid summer internship for undergraduate students. Each intern works on one small, self-contained question and presents the result to the laboratory at the end.',
    requirements_mk: 'Завршена втора година од студиите;Основни програмерски вештини;Љубопитност и желба за учење надвор од досегашното искуство',
    requirements_en:'Second year of study completed;Basic programming;Curiosity that exceeds prior experience' },
  { slug:'postdoc-structure-2025', kind:'postdoc', group_id:G['structural-bioinformatics'], deadline:'2025-05-01', is_open:0,
    title_mk: 'Постдокторска позиција: предвидување на стабилноста (затворена)',
    title_en:'Postdoctoral position: stability prediction (closed)',
    description_mk:'Позицијата е пополнета во јуни 2025 година.',
    description_en:'This position was filled in June 2025.',
    requirements_mk: 'Докторска диплома по биоинформатика или сродна област',
    requirements_en:'PhD in bioinformatics or a related field' }
];
const posStmt = ins(`INSERT INTO positions (slug,title_mk,title_en,kind,group_id,description_mk,description_en,requirements_mk,requirements_en,deadline,is_open)
  VALUES (@slug,@title_mk,@title_en,@kind,@group_id,@description_mk,@description_en,@requirements_mk,@requirements_en,@deadline,@is_open)`);
positions.forEach(p => posStmt.run(p));

/* -------------------------------------------------------------- PARTNERS */
const partners = [
  ['European Bioinformatics Institute','Hinxton','United Kingdom',52.0801,0.1846,9],
  ['University of Ljubljana','Ljubljana','Slovenia',46.0511,14.5051,6],
  ['University of Zagreb','Zagreb','Croatia',45.8150,15.9819,5],
  ['Max Planck Institute for Biology','Tübingen','Germany',48.5216,9.0576,4],
  ['University of Oslo','Oslo','Norway',59.9400,10.7215,3],
  ['Sofia University','Sofia','Bulgaria',42.6934,23.3339,4],
  ['University of Belgrade','Belgrade','Serbia',44.8184,20.4586,7],
  ['ETH Zürich','Zürich','Switzerland',47.3763,8.5476,2],
  ['University of Athens','Athens','Greece',37.9684,23.7325,3],
  ['Ss. Cyril and Methodius University','Skopje','North Macedonia',42.0043,21.4093,14]
];
const partStmt = ins('INSERT INTO partners (name,city,country,lat,lng,joint_papers) VALUES (?,?,?,?,?,?)');
partners.forEach(p => partStmt.run(...p));

/* ----------------------------------------------------------------- USERS */
const users = [
  ['admin@genomika.mk','genomika2026','admin','ana-trajkovska'],
  ['f.micevski@genomika.mk','genomika2026','admin','filip-micevski'],
  ['n.avramovski@genomika.mk','genomika2026','researcher','nikola-avramovski'],
  ['s.jovanoska@genomika.mk','genomika2026','researcher','sara-jovanoska']
];
const uStmt = ins('INSERT INTO users (email,password_hash,role,person_id) VALUES (?,?,?,?)');
users.forEach(([email, pw, role, slug]) => uStmt.run(email, bcrypt.hashSync(pw, 10), role, P[slug] ?? null));

/* -------------------------------------------------------- SAMPLE BOOKINGS */
const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const bStmt = ins(`INSERT INTO bookings (instrument_id,user_id,user_name,user_email,date,start_hour,end_hour,purpose,status)
  VALUES (?,?,?,?,?,?,?,?,?)`);
const sample = [
  [I['nanopore-promethion'], 3, 'Nikola Avramovski','n.avramovski@genomika.mk', 0, 9, 13, 'Pangenome run — batch 14'],
  [I['nanopore-promethion'], null,'Sara Jovanoska','s.jovanoska@genomika.mk', 1, 10, 14, 'Ohrid metagenome, March samples'],
  [I['hpc-cluster'], 3, 'Nikola Avramovski','n.avramovski@genomika.mk', 0, 14, 20, 'SIMD benchmark suite'],
  [I['qpcr-station'], null,'Ivana Petrushevska','i.petrushevska@genomika.mk', 2, 8, 11, 'Expression validation'],
  [I['illumina-nextseq'], null,'Tamara Gjorgjievska','t.gjorgjievska@genomika.mk', 3, 9, 15, '16S library, run 42'],
  [I['visualisation-wall'], null,'Bojan Naumovski','b.naumovski@genomika.mk', 1, 15, 18, 'Thesis figures review']
];
sample.forEach(([instr, uid, name, email, offset, sh, eh, purpose]) => {
  const d = new Date(today); d.setDate(d.getDate() + offset);
  bStmt.run(instr, uid, name, email, iso(d), sh, eh, purpose, 'confirmed');
});

console.log('Seed complete.');
console.log(db.prepare(`SELECT
  (SELECT COUNT(*) FROM people) people,
  (SELECT COUNT(*) FROM publications) publications,
  (SELECT COUNT(*) FROM projects) projects,
  (SELECT COUNT(*) FROM datasets) datasets,
  (SELECT COUNT(*) FROM events) events,
  (SELECT COUNT(*) FROM instruments) instruments,
  (SELECT COUNT(*) FROM bookings) bookings,
  (SELECT COUNT(*) FROM users) users`).get());
