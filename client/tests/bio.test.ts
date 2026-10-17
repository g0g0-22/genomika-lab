/**
 * Correctness tests for the algorithm library and the BibTeX export.
 *
 *   node --experimental-strip-types --test tests/bio.test.ts
 *
 * Expected values are not read off this code's own output. They are either
 * published facts (the beta-globin protein, OligoCalc's masses, textbook
 * enzyme ends) or derived here by a different, deliberately naive method —
 * cut positions by a literal string search plus the enzyme's cut offset — so
 * the library and the expectation cannot share a bug.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  reverseComplement, complement, transcribe, translate, translateAllFrames, findOrfs,
  gcContent, meltingTemp, molecularWeight, parseFasta, cleanSequence, detectKind, toFasta,
  IUPAC_DNA_ALPHABET, formatMass, meltingTempApplies, classifyInput
} from '../src/lib/bio/sequence.ts';
import { bibtexAuthors, latexEscape, toBibtex, toBibtexFile, citationKey } from '../src/lib/bibtex.ts';
import { ENZYMES, findCutSites, digest, migration, recognitionSequence, GEL_RANGES, overhang } from '../src/lib/bio/enzymes.ts';
import { HBB_CDS, PLASMID_FRAGMENT } from '../src/lib/bio/samples.ts';

/* ------------------------------------------------------------- sequence -- */

test('complement and reverse complement', () => {
  assert.equal(complement('ATGC'), 'TACG');
  assert.equal(reverseComplement('ATGC'), 'GCAT');
  assert.equal(reverseComplement(reverseComplement(HBB_CDS)), HBB_CDS);
});

test('the complement of RNA stays RNA', () => {
  assert.equal(complement('AUGC'), 'UACG');
  assert.equal(reverseComplement('AUGC'), 'GCAU');
  assert.equal(complement('ATGC'), 'TACG', 'DNA is unchanged');
});

test('a stray residue from the other alphabet still has mass', () => {
  // Previously U in a DNA strand weighed nothing, so ATGU equalled ATG.
  assert.ok(molecularWeight('ATGU') > molecularWeight('ATG') + 290);
});

test('raw input is classified before alphabet cleaning', () => {
  assert.equal(classifyInput(HBB_CDS), 'dna');
  // Most amino-acid letters are also IUPAC nucleotide codes (M, K, V, H …), so
  // a protein has to be recognised before any cleaning turns it into "DNA".
  assert.equal(classifyInput('MVHLTPEEKSAVTALWGKVNVDEVGGEALGRLLVVYPWTQRFF'), 'protein');
});

test('an ambiguity code keeps its place as N instead of shifting the frame', () => {
  const withR = HBB_CDS.slice(0, 21) + 'R' + HBB_CDS.slice(22);     // codon 8 (GAG, Glu) becomes RAG
  const { seq, ambiguous, dropped } = cleanSequence(withR);
  assert.equal(seq.length, HBB_CDS.length, 'no position is lost');
  assert.deepEqual([ambiguous, dropped], [1, 0]);
  // The unknown codon is X; everything after it is still in frame.
  assert.ok(translate(seq).startsWith('MVHLTPEXKSAVTALWGKV'));
  assert.equal(findOrfs(seq, 30)[0].protein.length, 147);

  assert.deepEqual(cleanSequence('ACGT-ZZ-ACGT'), { seq: 'ACGTACGT', ambiguous: 0, dropped: 2 },
    'characters that are no nucleotide code at all are the only ones dropped');
});

test('transcription replaces T with U', () => {
  assert.equal(transcribe('ATGC'), 'AUGC');
});

test('beta-globin translates to the known protein', () => {
  const protein = translate(HBB_CDS);
  assert.ok(protein.startsWith('MVHLTPEEKSAVTALWGKVNVDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAVMGNPKVKAHGKKVLGAFSDGLAHLDNLKGTFATLSELHCDKLHVDPENFRLLGNVLVCVLAHHFGKEFTPPVQAAYQKVVAGVANALAHKYH'));
  assert.equal(protein.at(-1), '*');
  assert.equal(protein.length, 148); // 147 residues plus the stop codon
});

test('open reading frame detection recovers the full beta-globin frame', () => {
  const orfs = findOrfs(HBB_CDS, 100);
  // The longest frame is the real one; a shorter spurious frame also exists
  // on the reverse strand, which is exactly what a real ORF finder reports.
  assert.equal(orfs[0].strand, '+');
  assert.equal(orfs[0].start, 1);
  assert.equal(orfs[0].end, HBB_CDS.length);
  assert.equal(orfs[0].protein.length, 147);
  assert.ok(orfs[0].hasStop);
});

test('GC content and melting temperature', () => {
  assert.equal(gcContent('GGCC'), 1);
  assert.equal(gcContent('ATAT'), 0);
  assert.equal(meltingTemp('ATGC'), 12);            // Wallace rule, short oligo
  assert.ok(Math.abs(meltingTemp('GCGCGCGCGCGCGCGCGCGC') - 72.28) < 0.01);
});

test('molecular weight uses residue masses, not free nucleotide masses', () => {
  // Forming each phosphodiester bond releases water, so a residue weighs
  // 18.02 Da less than the free monophosphate. Expected values are OligoCalc's.
  assert.ok(Math.abs(molecularWeight('ATGC') - 1173.84) < 0.01);
  assert.ok(Math.abs(molecularWeight('AAAA') - 1190.88) < 0.01);
  assert.equal(molecularWeight(''), 0);

  // A single residue carries no bond at all, so it is just the residue mass
  // less the 5'-phosphate adjustment.
  assert.ok(Math.abs(molecularWeight('A') - (313.21 - 61.96)) < 0.01);

  // Each added base must raise the mass by exactly one residue, never more.
  const step = molecularWeight('AA') - molecularWeight('A');
  assert.ok(Math.abs(step - 313.21) < 0.01, 'no water is left on the chain');

  // RNA residues are heavier than their DNA counterparts.
  assert.ok(molecularWeight('AUGC') > molecularWeight('ATGC'));
});

test('melting temperature does not depend on whether the strand is DNA or RNA', () => {
  assert.equal(meltingTemp('ATGC'), meltingTemp('AUGC'));
  assert.equal(meltingTemp('ATATATATATATATATAT'), meltingTemp('AUAUAUAUAUAUAUAUAU'));
});

test('cleaning drops characters outside the alphabet', () => {
  const { seq, dropped } = cleanSequence('atg-cxz 123');
  assert.equal(seq, 'ATGC');
  assert.equal(dropped, 2);                          // X and Z
});

test('FASTA round-trips through the parser', () => {
  const records = parseFasta(toFasta('HBB test', HBB_CDS));
  assert.equal(records.length, 1);
  assert.equal(records[0].id, 'HBB');
  assert.equal(records[0].seq, HBB_CDS);           // line wrapping must not alter the sequence
});

test('a multi-record FASTA keeps every record', () => {
  const records = parseFasta(`>one\n${HBB_CDS}\n>two desc here\n${PLASMID_FRAGMENT}`);
  assert.equal(records.length, 2);
  assert.deepEqual(records.map(r => r.id), ['one', 'two']);
  assert.equal(records[1].description, 'desc here');
  assert.equal(records[1].seq, PLASMID_FRAGMENT);
});

test('sequence kind detection', () => {
  assert.equal(detectKind(HBB_CDS), 'dna');
  assert.equal(detectKind(transcribe(HBB_CDS)), 'rna');
  assert.equal(detectKind(translate(HBB_CDS).replace(/\*/g, '')), 'protein');
});

test('all six reading frames are produced, in the conventional order', () => {
  const frames = translateAllFrames(HBB_CDS);
  assert.deepEqual(frames.map(f => f.frame), [1, 2, 3, -1, -2, -3]);
  assert.ok(frames[0].protein.startsWith('MVHLTPEEK'), 'frame +1 of a coding sequence is its protein');
  assert.equal(frames[3].protein, translate(reverseComplement(HBB_CDS)));
});

test('the IUPAC alphabet survives cleaning when it is asked for', () => {
  assert.deepEqual(cleanSequence('ATGCRYKM'), { seq: 'ATGCNNNN', ambiguous: 4, dropped: 0 });
  assert.deepEqual(cleanSequence('ATGCRYKM', IUPAC_DNA_ALPHABET), { seq: 'ATGCRYKM', ambiguous: 0, dropped: 0 });
});

test('degenerate recognition sites match every base they stand for', () => {
  const hinfI = ENZYMES.find(e => e.name === 'HinfI')!;   // G^ANTC — N is any base
  assert.equal(recognitionSequence(hinfI), 'GANTC');
  for (const n of ['A', 'C', 'G', 'T']) {
    assert.equal(findCutSites(`TTG${n === 'A' ? 'GAATC' : `GA${n}TC`}TT`, [hinfI]).length, 1, `N = ${n}`);
  }

  const bstYI = ENZYMES.find(e => e.name === 'BstYI')!;   // R^GATCY — R is A/G, Y is C/T
  assert.equal(findCutSites('TTAGATCCTT', [bstYI]).length, 1);
  assert.equal(findCutSites('TTGGATCTTT', [bstYI]).length, 1);
  assert.equal(findCutSites('TTCGATCATT', [bstYI]).length, 0, 'C is not R and A is not Y');

  // The table would be dead code if no shipped enzyme used it.
  const degenerate = ENZYMES.filter(e => /[RYSWKMBDHVN]/.test(recognitionSequence(e)));
  assert.ok(degenerate.length >= 5);
});

test('a circular digest conserves length and marks the fragment crossing the origin', () => {
  const enzymes = ENZYMES.filter(e => ['EcoRI', 'BamHI'].includes(e.name));
  const sites = findCutSites(PLASMID_FRAGMENT, enzymes);
  const fragments = digest(PLASMID_FRAGMENT, sites, true);

  assert.equal(fragments.reduce((sum, f) => sum + f.length, 0), PLASMID_FRAGMENT.length);
  assert.equal(fragments.length, sites.length, 'n cuts on a circle give n fragments');

  const wrapping = fragments.filter(f => f.wraps);
  assert.equal(wrapping.length, 1, 'exactly one fragment crosses the origin');
  assert.ok(wrapping[0].end < wrapping[0].start, 'and it is the only one whose end precedes its start');
  fragments.filter(f => !f.wraps).forEach(f =>
    assert.ok(f.start <= f.end, 'every other fragment reads forwards'));
});

test('on a circle, a site straddling the origin is found', () => {
  const eco = ENZYMES.filter(e => e.name === 'EcoRI');
  // GAATTC split as "GA" at the end and "ATTC" at the start.
  const seq = 'ATTC' + 'T'.repeat(200) + 'GA';
  assert.equal(findCutSites(seq, eco, false).length, 0, 'a linear molecule has no such site');
  const sites = findCutSites(seq, eco, true);
  assert.equal(sites.length, 1);
  assert.equal(sites[0].position, seq.length - 1, 'cut between G and A, one base before the end');
});

test('a single cut on a circle opens it into one wrapping fragment', () => {
  const eco = ENZYMES.filter(e => e.name === 'EcoRI');
  const seq = 'T'.repeat(100) + 'GAATTC' + 'T'.repeat(100);
  const [fragment, ...rest] = digest(seq, findCutSites(seq, eco, true), true);
  assert.equal(rest.length, 0);
  assert.equal(fragment.length, seq.length);
  assert.equal(fragment.wraps, true);
  assert.ok(fragment.end < fragment.start);
});

test('a cut exactly at the origin does not wrap', () => {
  const eco = ENZYMES.filter(e => e.name === 'EcoRI');
  const seq = 'AATTC' + 'T'.repeat(200) + 'G';          // G^AATTC across the origin, cut at 0
  const [fragment] = digest(seq, findCutSites(seq, eco, true), true);
  assert.deepEqual({ start: fragment.start, end: fragment.end, wraps: fragment.wraps },
                   { start: 1, end: seq.length, wraps: undefined });
});

test('a linear digest of the same sequence gives one more fragment than cuts', () => {
  const enzymes = ENZYMES.filter(e => ['EcoRI', 'BamHI'].includes(e.name));
  const sites = findCutSites(PLASMID_FRAGMENT, enzymes).filter(s => s.position > 0);
  const fragments = digest(PLASMID_FRAGMENT, findCutSites(PLASMID_FRAGMENT, enzymes), false);
  assert.equal(fragments.length, sites.length + 1);
  assert.ok(fragments.every(f => !f.wraps));
  assert.equal(fragments.reduce((sum, f) => sum + f.length, 0), PLASMID_FRAGMENT.length);
});

/** Cut positions by plain substring search: no regex, no IUPAC expansion. */
function naiveCuts(seq: string, site: string, offset: number) {
  const cuts: number[] = [];
  for (let i = seq.indexOf(site); i !== -1; i = seq.indexOf(site, i + 1)) cuts.push(i + offset);
  return cuts;
}

test('EcoRI cuts the demo fragment exactly twice', () => {
  const ecoRI = ENZYMES.find(e => e.name === 'EcoRI')!;
  const sites = findCutSites(PLASMID_FRAGMENT, [ecoRI]);
  assert.deepEqual(sites.map(s => s.position), naiveCuts(PLASMID_FRAGMENT, 'GAATTC', 1));
  assert.deepEqual(sites.map(s => s.position), [1, 46], 'G^AATTC at 0 and 45');
});

test('a digest partitions the sequence with nothing lost', () => {
  const sites = findCutSites(PLASMID_FRAGMENT, ENZYMES);
  const fragments = digest(PLASMID_FRAGMENT, sites);
  const total = fragments.reduce((sum, f) => sum + f.length, 0);
  assert.equal(total, PLASMID_FRAGMENT.length);
  // Fragments come back largest first, which is how a gel is read.
  for (let i = 1; i < fragments.length; i++) assert.ok(fragments[i - 1].length >= fragments[i].length);
});

test('an uncut sequence yields a single full-length fragment', () => {
  const fragments = digest('AAAAAAAAAA', []);
  assert.equal(fragments.length, 1);
  assert.equal(fragments[0].length, 10);
});

test('gel migration is monotonic: longer fragments travel less', () => {
  assert.ok(migration(10000, 400, 10000) < migration(500, 400, 10000));
});

/* --------------------------------------------------------------- display -- */

test('mass is shown in daltons for oligos and kilodaltons for longer chains', () => {
  // A 12-mer used to read "4 kDa"; a short primer read "0 kDa".
  const oligo = formatMass(molecularWeight('ATGCCCGGGTAA'));
  assert.equal(oligo.unit, 'Da');
  assert.ok(oligo.value > 3600 && oligo.value < 3700);

  const gene = formatMass(molecularWeight(HBB_CDS));
  assert.equal(gene.unit, 'kDa');
  assert.ok(gene.value > 137 && gene.value < 138);
});

test('a melting temperature is only offered where the formula applies', () => {
  assert.equal(meltingTempApplies('ACGTACGTACGTACGTACGT'), true);
  assert.equal(meltingTempApplies(HBB_CDS), false, 'a 444-nt gene does not melt at one temperature');
  assert.equal(meltingTempApplies(''), false);
});

/* ---------------------------------------------------------------- BibTeX -- */

test('BibTeX authors use the unambiguous "Surname, Initial." form', () => {
  // Without the comma BibTeX reads "Trajkovska A" as given name Trajkovska, surname A.
  assert.equal(bibtexAuthors('Trajkovska A, Stefanovski M'), 'Trajkovska, A. and Stefanovski, M.');
  assert.equal(bibtexAuthors('Tester T'), 'Tester, T.');
});

test('BibTeX fields escape LaTeX command characters', () => {
  assert.equal(latexEscape('R&D at 50% #1 $x_y'), 'R\\&D at 50\\% \\#1 \\$x\\_y');
  const bib = toBibtex({ title: 'Speed & accuracy', authors: 'Doe J', venue: 'J. Test & Eval.', year: 2025, type: 'article' });
  assert.match(bib, /title\s+= \{Speed \\& accuracy\}/);
  assert.match(bib, /journal = \{J\. Test \\& Eval\.\}/);
  assert.ok(!/[^\\]&/.test(bib.replace(/\\&/g, '')), 'no bare ampersand survives');
});

test('BibTeX entry type and venue field follow the publication type', () => {
  const base = { title: 'T', authors: 'Doe J', venue: 'V', year: 2024 };
  assert.match(toBibtex({ ...base, type: 'article' }), /^@article\{[\s\S]*journal = \{V\}/);
  assert.match(toBibtex({ ...base, type: 'conference' }), /^@inproceedings\{[\s\S]*booktitle = \{V\}/);
  assert.match(toBibtex({ ...base, type: 'preprint' }), /^@misc\{[\s\S]*howpublished = \{V\}/);
});

test('the gel example is a digest whose every fragment resolves on its gel', () => {
  // Gel.tsx loads PvuII + NdeI on a 2 % gel; if the sample or the enzymes change,
  // the example must still show bands rather than run-off notes.
  const enzymes = ENZYMES.filter(e => e.name === 'PvuII' || e.name === 'NdeI');
  const lengths = digest(PLASMID_FRAGMENT, findCutSites(PLASMID_FRAGMENT, enzymes)).map(f => f.length);

  // The same fragments from naive cuts: consecutive differences, largest first.
  const cuts = [...naiveCuts(PLASMID_FRAGMENT, 'CAGCTG', 3), ...naiveCuts(PLASMID_FRAGMENT, 'CATATG', 2)].sort((a, b) => a - b);
  const bounds = [0, ...cuts, PLASMID_FRAGMENT.length];
  const expected = bounds.slice(1).map((end, i) => end - bounds[i]).sort((a, b) => b - a);
  assert.deepEqual(lengths, expected);
  assert.deepEqual(lengths, [349, 191, 138, 122]);
  const [min, max] = GEL_RANGES['2.0'];
  assert.ok(lengths.every(l => l >= min && l <= max));
});

test('every site is palindromic, so overhangs follow from the cut position', () => {
  const COMPLEMENT = { A: 'T', T: 'A', C: 'G', G: 'C', R: 'Y', Y: 'R', S: 'S', W: 'W',
                       K: 'M', M: 'K', B: 'V', V: 'B', D: 'H', H: 'D', N: 'N' };
  for (const enzyme of ENZYMES) {
    const site = recognitionSequence(enzyme);
    const reverseComplementSite = site.split('').reverse().map(c => COMPLEMENT[c]).join('');
    assert.equal(reverseComplementSite, site, `${enzyme.name} reads the same on both strands`);
  }
  // Textbook ends, one of each kind, plus ScrFI's one-base 5' overhang.
  const end = (name) => overhang(ENZYMES.find(e => e.name === name));
  assert.deepEqual(['EcoRI', 'PstI', 'SmaI', 'ScrFI', 'NotI'].map(end), ["5'", "3'", 'blunt', "5'", "5'"]);
});

test('BibTeX keeps name particles with the surname and gives every entry its own ASCII key', () => {
  assert.equal(bibtexAuthors('van der Berg J, Trajkovska AB'), 'van der Berg, J. and Trajkovska, A. B.');
  assert.equal(bibtexAuthors('GenomikaLab Consortium'), 'GenomikaLab Consortium');

  const base = { venue: 'V', year: 2024, type: 'article' };
  assert.equal(citationKey({ ...base, title: 'Геномски графови на ендемити', authors: 'Трајковска А' }),
    'trajkovska2024genomski', 'Macedonian names and titles are transliterated, not dropped');

  const twin = { ...base, title: 'Graph pangenomes', authors: 'Doe J' };
  const keys = [...toBibtexFile([twin, twin, twin]).matchAll(/^@article\{([^,]+),/gm)].map(m => m[1]);
  assert.deepEqual(keys, ['doe2024graph', 'doe2024grapha', 'doe2024graphb']);
});
