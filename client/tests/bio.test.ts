/**
 * Correctness tests for the algorithm library.
 *
 *   node --experimental-strip-types --test tests/
 *
 * The alignment cases are the standard textbook examples, so the expected
 * numbers can be checked against any reference implementation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  reverseComplement, complement, transcribe, translate, translateAllFrames, findOrfs,
  gcContent, meltingTemp, molecularWeight, parseFasta, cleanSequence, detectKind, toFasta,
  IUPAC_DNA_ALPHABET
} from '../src/lib/bio/sequence.ts';
import { ENZYMES, findCutSites, digest, migration, recognitionSequence } from '../src/lib/bio/enzymes.ts';
import { HBB_CDS, PLASMID_FRAGMENT } from '../src/lib/bio/samples.ts';

/* ------------------------------------------------------------- sequence -- */

test('complement and reverse complement', () => {
  assert.equal(complement('ATGC'), 'TACG');
  assert.equal(reverseComplement('ATGC'), 'GCAT');
  assert.equal(reverseComplement(reverseComplement(HBB_CDS)), HBB_CDS);
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

test('all six reading frames are produced', () => {
  const frames = translateAllFrames(HBB_CDS);
  assert.equal(frames.length, 6);
  assert.deepEqual(frames.map(f => f.frame), [3, 2, 1, -1, -2, -3]);
});

test('the IUPAC alphabet survives cleaning when it is asked for', () => {
  assert.deepEqual(cleanSequence('ATGCRYKM'), { seq: 'ATGC', dropped: 4 });
  assert.deepEqual(cleanSequence('ATGCRYKM', IUPAC_DNA_ALPHABET), { seq: 'ATGCRYKM', dropped: 0 });
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

test('a linear digest of the same sequence gives one more fragment than cuts', () => {
  const enzymes = ENZYMES.filter(e => ['EcoRI', 'BamHI'].includes(e.name));
  const sites = findCutSites(PLASMID_FRAGMENT, enzymes).filter(s => s.position > 0);
  const fragments = digest(PLASMID_FRAGMENT, findCutSites(PLASMID_FRAGMENT, enzymes), false);
  assert.equal(fragments.length, sites.length + 1);
  assert.ok(fragments.every(f => !f.wraps));
  assert.equal(fragments.reduce((sum, f) => sum + f.length, 0), PLASMID_FRAGMENT.length);
});

test('EcoRI cuts the demo fragment exactly twice', () => {
  const ecoRI = ENZYMES.find(e => e.name === 'EcoRI')!;
  const sites = findCutSites(PLASMID_FRAGMENT, [ecoRI]);
  assert.equal(sites.length, 2);
  assert.deepEqual(sites.map(s => s.position), [1, 46]);
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
