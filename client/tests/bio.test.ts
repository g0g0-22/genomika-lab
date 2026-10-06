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
  reverseComplement, complement, transcribe, translate, findOrfs, gcContent,
  meltingTemp, topKmers, hydropathyProfile, parseFasta, cleanSequence, detectKind
} from '../src/lib/bio/sequence.ts';
import { align, blosum62 } from '../src/lib/bio/align.ts';
import { ENZYMES, findCutSites, digest, migration } from '../src/lib/bio/enzymes.ts';
import { distanceMatrix, upgma, neighbourJoining, toNewick, layoutTree, jukesCantor } from '../src/lib/bio/phylo.ts';
import { HBB_CDS, PLASMID_FRAGMENT, PHYLO_EXAMPLE, HBA_PROTEIN } from '../src/lib/bio/samples.ts';

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

test('sequence kind detection', () => {
  assert.equal(detectKind(HBB_CDS), 'dna');
  assert.equal(detectKind(transcribe(HBB_CDS)), 'rna');
  assert.equal(detectKind(HBA_PROTEIN), 'protein');
});

test('FASTA parsing keeps every record', () => {
  const records = parseFasta(PHYLO_EXAMPLE);
  assert.equal(records.length, 6);
  assert.equal(records[0].id, 'Ursus_arctos');
  assert.ok(records.every(r => r.seq.length === 99));
});

test('k-mer counting', () => {
  assert.deepEqual(topKmers('AAAATTTT', 2)[0], { kmer: 'AA', count: 3 });
});

test('hydropathy profile shrinks by the window size', () => {
  assert.equal(hydropathyProfile(HBA_PROTEIN, 9).length, HBA_PROTEIN.length - 8);
});

/* ------------------------------------------------------------ alignment -- */

test('BLOSUM62 is symmetric and has the documented values', () => {
  const order = 'ARNDCQEGHILKMFPSTWYVBZX*';
  for (const a of order) for (const b of order) assert.equal(blosum62(a, b), blosum62(b, a));
  assert.equal(blosum62('W', 'W'), 11);
  assert.equal(blosum62('C', 'C'), 9);
  assert.equal(blosum62('A', 'W'), -3);
});

test('Needleman-Wunsch reproduces the GCATGCG / GATTACA example', () => {
  const r = align('GCATGCG', 'GATTACA', { match: 1, mismatch: -1, gap: -1, mode: 'global' });
  assert.equal(r.score, 0);
  assert.equal(r.alignedA.length, r.alignedB.length);
  // A global alignment consumes every character of both inputs.
  assert.equal(r.alignedA.replace(/-/g, ''), 'GCATGCG');
  assert.equal(r.alignedB.replace(/-/g, ''), 'GATTACA');
});

test('Smith-Waterman reproduces the GGTTGACTA / TGTTACGG example', () => {
  const r = align('GGTTGACTA', 'TGTTACGG', { match: 3, mismatch: -3, gap: -2, mode: 'local' });
  assert.equal(r.score, 13);
  assert.equal(r.alignedA, 'GTTGAC');
  assert.equal(r.alignedB, 'GTT-AC');
});

test('Smith-Waterman with BLOSUM62 finds the AWGHE / AW-HE alignment', () => {
  const r = align('HEAGAWGHEE', 'PAWHEAE', { match: 1, mismatch: -1, gap: -8, mode: 'local', substitution: 'blosum62' });
  assert.equal(r.score, 20);
  assert.equal(r.alignedA, 'AWGHE');
  assert.equal(r.alignedB, 'AW-HE');
});

test('identical sequences align at full identity with no gaps', () => {
  const r = align('ACGTACGT', 'ACGTACGT', { match: 2, mismatch: -1, gap: -2, mode: 'global' });
  assert.equal(r.score, 16);
  assert.equal(r.identity, 1);
  assert.equal(r.gaps, 0);
});

/* -------------------------------------------------------------- enzymes -- */

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

/* --------------------------------------------------------- phylogenetics -- */

test('Jukes-Cantor correction exceeds the raw p-distance', () => {
  assert.equal(jukesCantor(0), 0);
  assert.ok(jukesCantor(0.2) > 0.2);
});

test('distance matrix is symmetric with a zero diagonal', () => {
  const records = parseFasta(PHYLO_EXAMPLE);
  const matrix = distanceMatrix(records.map(r => r.seq), 'jc');
  matrix.forEach((row, i) => {
    assert.equal(row[i], 0);
    row.forEach((value, j) => assert.ok(Math.abs(value - matrix[j][i]) < 1e-12));
  });
});

test('UPGMA groups the two Ursus species together', () => {
  const records = parseFasta(PHYLO_EXAMPLE);
  const labels = records.map(r => r.id);
  const tree = upgma(labels, distanceMatrix(records.map(r => r.seq), 'jc'))!;
  assert.equal(tree.leafCount, 6);
  assert.match(toNewick(tree), /\(Ursus_arctos:[\d.]+,Ursus_maritimus:[\d.]+\)/);
});

test('Neighbour-Joining returns a tree over every taxon', () => {
  const records = parseFasta(PHYLO_EXAMPLE);
  const labels = records.map(r => r.id);
  const tree = neighbourJoining(labels, distanceMatrix(records.map(r => r.seq), 'jc'))!;
  assert.equal(tree.leafCount, 6);
  const newick = toNewick(tree);
  labels.forEach(label => assert.ok(newick.includes(label)));
  assert.ok(newick.endsWith(';'));
});

test('tree layout produces one coordinate per node', () => {
  const records = parseFasta(PHYLO_EXAMPLE);
  const tree = neighbourJoining(records.map(r => r.id), distanceMatrix(records.map(r => r.seq), 'jc'))!;
  const { nodes, leaves } = layoutTree(tree);
  assert.equal(leaves, 6);
  assert.equal(nodes.filter(n => n.isLeaf).length, 6);
  assert.ok(nodes.every(n => n.x >= n.parentX));
});
