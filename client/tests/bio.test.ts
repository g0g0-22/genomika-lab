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
  gcContent, meltingTemp, parseFasta, cleanSequence, detectKind, toFasta
} from '../src/lib/bio/sequence.ts';
import { ENZYMES, findCutSites, digest, migration } from '../src/lib/bio/enzymes.ts';
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
