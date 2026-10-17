/**
 * Core nucleotide and protein sequence operations.
 *
 * Everything here is a straightforward, readable implementation rather than an
 * optimised one: the point of these tools is that a student can compare the
 * output on screen against the algorithm in a textbook.
 */

export const DNA_ALPHABET = 'ACGTUN';
/** Includes the IUPAC degenerate codes, for input a restriction site can match. */
export const IUPAC_DNA_ALPHABET = 'ACGTUNRYSWKMBDHV';

export type SeqKind = 'dna' | 'rna' | 'protein' | 'unknown';
export type ParsedFasta = { id: string; description: string; seq: string };

const stripWhitespace = (s: string) => s.replace(/[\s\d]/g, '');

/** Splits FASTA text into records. Text without a '>' line becomes one record. */
export function parseFasta(text: string): ParsedFasta[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (!trimmed.startsWith('>')) {
    return [{ id: 'sequence', description: '', seq: stripWhitespace(trimmed) }];
  }
  return trimmed
    .split(/^>/m)
    .filter(Boolean)
    .map(block => {
      const [header, ...rest] = block.split('\n');
      const space = header.indexOf(' ');
      return {
        id: (space === -1 ? header : header.slice(0, space)).trim() || 'sequence',
        description: space === -1 ? '' : header.slice(space + 1).trim(),
        seq: stripWhitespace(rest.join(''))
      };
    })
    .filter(r => r.seq.length > 0);
}

/**
 * Uppercases, then keeps every position the sequence really has. An IUPAC
 * ambiguity code outside the requested alphabet (R, Y, K …) is a base of
 * uncertain identity, so it becomes N rather than vanishing: deleting one
 * shifted every downstream codon and produced a different protein. Only
 * characters that are no nucleotide code at all are dropped. Both are counted
 * so the interface can say what it did.
 */
export function cleanSequence(raw: string, alphabet = DNA_ALPHABET) {
  const upper = raw.toUpperCase().replace(/[^A-Z*]/g, '');
  const allowed = new Set(alphabet.split(''));
  let seq = '';
  let ambiguous = 0;
  let dropped = 0;
  for (const ch of upper) {
    if (allowed.has(ch)) seq += ch;
    else if (IUPAC_DNA_ALPHABET.includes(ch)) { seq += 'N'; ambiguous++; }
    else dropped++;
  }
  return { seq, ambiguous, dropped };
}

/**
 * Classifies raw input before any alphabet cleaning. Cleaning with the DNA
 * alphabet first turned a pasted protein into a short, meaningless "DNA"
 * string, so the protein case could never be detected.
 */
export function classifyInput(raw: string): SeqKind {
  const letters = raw.toUpperCase().replace(/[^A-Z*]/g, '');
  return detectKind(letters);
}

/** Best-effort guess of what kind of sequence a string holds. */
export function detectKind(seq: string): SeqKind {
  if (!seq) return 'unknown';
  const s = seq.toUpperCase();
  const nucleotides = (s.match(/[ACGTUN]/g) || []).length;
  if (nucleotides / s.length > 0.9) return s.includes('U') && !s.includes('T') ? 'rna' : 'dna';
  const aminoAcids = (s.match(/[ACDEFGHIKLMNPQRSTVWY*]/g) || []).length;
  if (aminoAcids / s.length > 0.9) return 'protein';
  return 'unknown';
}

const COMPLEMENT: Record<string, string> = {
  A: 'T', T: 'A', G: 'C', C: 'G', U: 'A', N: 'N',
  R: 'Y', Y: 'R', S: 'S', W: 'W', K: 'M', M: 'K',
  B: 'V', V: 'B', D: 'H', H: 'D'
};

const isRna = (seq: string) => seq.includes('U') && !seq.includes('T');

/** The complement in the strand's own alphabet: RNA pairs A with U, not T. */
export const complement = (seq: string) => {
  const rna = isRna(seq);
  return seq.split('').map(c => {
    const base = COMPLEMENT[c] ?? 'N';
    return rna && base === 'T' ? 'U' : base;
  }).join('');
};
export const reverse = (seq: string) => seq.split('').reverse().join('');
export const reverseComplement = (seq: string) => reverse(complement(seq));
export const transcribe = (seq: string) => seq.replace(/T/g, 'U');
export const backTranscribe = (seq: string) => seq.replace(/U/g, 'T');

/* ------------------------------------------------------------- COMPOSITION */

export function baseCounts(seq: string) {
  const counts: Record<string, number> = { A: 0, C: 0, G: 0, T: 0, U: 0, N: 0, other: 0 };
  for (const ch of seq) {
    if (ch in counts) counts[ch]++;
    else counts.other++;
  }
  return counts;
}

export function gcContent(seq: string) {
  if (!seq.length) return 0;
  const { G, C } = baseCounts(seq);
  return (G + C) / seq.length;
}

/*
 * Average molecular weight of a single strand, in daltons.
 *
 * These are *residue* masses, not free nucleotide masses: forming each
 * phosphodiester bond releases a molecule of water, so a residue weighs
 * 18.02 Da less than the free monophosphate it came from. Using the free
 * masses — as an earlier version of this function did — overstates the
 * result by 18.02 Da for every bond in the chain.
 *
 * The trailing −61.96 converts from a 5'-monophosphate to the 5'-hydroxyl a
 * synthesised oligo carries. For DNA the result equals OligoCalc's. RNA is
 * given with the same 5'-hydroxyl end, as for a synthetic RNA oligo;
 * OligoCalc instead assumes an in-vitro transcript with a 5'-triphosphate
 * (+159.0), so its RNA figures run 220.96 Da higher by design.
 */
const DNA_RESIDUE_MASS: Record<string, number> = { A: 313.21, T: 304.20, G: 329.21, C: 289.18, N: 308.95 };
const RNA_RESIDUE_MASS: Record<string, number> = { A: 329.21, U: 306.17, G: 345.21, C: 305.18, N: 321.44 };

export function molecularWeight(seq: string) {
  if (!seq.length) return 0;
  const table = isRna(seq) ? RNA_RESIDUE_MASS : DNA_RESIDUE_MASS;
  const other = table === RNA_RESIDUE_MASS ? DNA_RESIDUE_MASS : RNA_RESIDUE_MASS;
  // A mixed strand is malformed, but a residue the main table lacks (U in a DNA
  // strand) still weighs something — previously it counted as zero.
  const total = seq.split('').reduce((sum, ch) => sum + (table[ch] ?? other[ch] ?? 0), 0);
  return total - 61.96;
}

/**
 * Mass in the unit a person would expect to read it in. Rounding everything to
 * whole kilodaltons made a 12-mer read "4 kDa" and a primer read "0 kDa" —
 * exactly the short sequences for which mass is actually used.
 */
export function formatMass(daltons: number): { value: number; unit: 'Da' | 'kDa'; digits: number } {
  return daltons < 10_000
    ? { value: daltons, unit: 'Da', digits: 1 }
    : { value: daltons / 1000, unit: 'kDa', digits: 2 };
}

/**
 * Both formulas are oligonucleotide estimates. Past roughly fifty bases the
 * GC formula stops describing anything physical — a gene does not melt at a
 * single temperature — so callers should not present a value beyond this.
 */
export const TM_MAX_LENGTH = 50;
export const meltingTempApplies = (seq: string) => seq.length > 0 && seq.length <= TM_MAX_LENGTH;

/**
 * Melting temperature. Under 14 bases the Wallace rule applies; above it the
 * GC-based formula gives a far better estimate.
 */
export function meltingTemp(seq: string) {
  const n = seq.length;
  if (!n) return 0;
  const { A, T, U, G, C } = baseCounts(seq);
  // U pairs with A exactly as T does; counting it separately silently gave
  // RNA a different melting temperature from the identical DNA sequence.
  const weak = A + T + U;
  if (n < 14) return 2 * weak + 4 * (G + C);
  return 64.9 + (41 * (G + C - 16.4)) / n;
}

/* -------------------------------------------------------------- TRANSLATION */

export const CODON_TABLE: Record<string, string> = {
  TTT:'F', TTC:'F', TTA:'L', TTG:'L', CTT:'L', CTC:'L', CTA:'L', CTG:'L',
  ATT:'I', ATC:'I', ATA:'I', ATG:'M', GTT:'V', GTC:'V', GTA:'V', GTG:'V',
  TCT:'S', TCC:'S', TCA:'S', TCG:'S', CCT:'P', CCC:'P', CCA:'P', CCG:'P',
  ACT:'T', ACC:'T', ACA:'T', ACG:'T', GCT:'A', GCC:'A', GCA:'A', GCG:'A',
  TAT:'Y', TAC:'Y', TAA:'*', TAG:'*', CAT:'H', CAC:'H', CAA:'Q', CAG:'Q',
  AAT:'N', AAC:'N', AAA:'K', AAG:'K', GAT:'D', GAC:'D', GAA:'E', GAG:'E',
  TGT:'C', TGC:'C', TGA:'*', TGG:'W', CGT:'R', CGC:'R', CGA:'R', CGG:'R',
  AGT:'S', AGC:'S', AGA:'R', AGG:'R', GGT:'G', GGC:'G', GGA:'G', GGG:'G'
};

/** Broad physico-chemical classes, used for colouring protein sequences. */
export const AA_CLASS: Record<string, 'hydrophobic' | 'polar' | 'acidic' | 'basic' | 'special'> = {
  A:'hydrophobic', V:'hydrophobic', L:'hydrophobic', I:'hydrophobic', M:'hydrophobic',
  F:'hydrophobic', W:'hydrophobic', Y:'hydrophobic',
  S:'polar', T:'polar', N:'polar', Q:'polar',
  D:'acidic', E:'acidic',
  K:'basic', R:'basic', H:'basic',
  C:'special', G:'special', P:'special', '*':'special', X:'special'
};

export function translate(seq: string, frame = 0) {
  const dna = backTranscribe(seq);
  let protein = '';
  for (let i = frame; i + 3 <= dna.length; i += 3) {
    protein += CODON_TABLE[dna.slice(i, i + 3)] ?? 'X';
  }
  return protein;
}

/**
 * The six reading frames in the order every reference tool lists them:
 * +1, +2, +3 on the given strand, then -1, -2, -3 on its reverse complement.
 */
export function translateAllFrames(seq: string) {
  const rc = reverseComplement(backTranscribe(seq));
  return [
    ...[0, 1, 2].map(f => ({ frame: f + 1, strand: '+' as const, protein: translate(seq, f) })),
    ...[0, 1, 2].map(f => ({ frame: -(f + 1), strand: '-' as const, protein: translate(rc, f) }))
  ];
}

export type Orf = {
  strand: '+' | '-';
  frame: number;
  start: number;   // 1-based on the forward sequence
  end: number;     // 1-based, inclusive
  length: number;  // nucleotides, stop codon included
  protein: string;
  hasStop: boolean;
};

/** Finds ATG…stop stretches in all six reading frames. */
export function findOrfs(seq: string, minAminoAcids = 30): Orf[] {
  const dna = backTranscribe(seq);
  const rc = reverseComplement(dna);
  const orfs: Orf[] = [];

  const scan = (s: string, strand: '+' | '-') => {
    for (let frame = 0; frame < 3; frame++) {
      let i = frame;
      while (i + 3 <= s.length) {
        if (s.slice(i, i + 3) === 'ATG') {
          let protein = '';
          let j = i;
          let hasStop = false;
          while (j + 3 <= s.length) {
            const aa = CODON_TABLE[s.slice(j, j + 3)] ?? 'X';
            j += 3;
            if (aa === '*') { hasStop = true; break; }
            protein += aa;
          }
          if (protein.length >= minAminoAcids) {
            const localStart = i;
            const localEnd = j - 1;
            orfs.push({
              strand,
              frame: strand === '+' ? frame + 1 : -(frame + 1),
              start: strand === '+' ? localStart + 1 : s.length - localEnd,
              end: strand === '+' ? localEnd + 1 : s.length - localStart,
              length: localEnd - localStart + 1,
              protein,
              hasStop
            });
            i = j;
            continue;
          }
        }
        i += 3;
      }
    }
  };

  scan(dna, '+');
  scan(rc, '-');
  return orfs.sort((a, b) => b.protein.length - a.protein.length);
}

/* ---------------------------------------------------------------- FORMATTING */

/** Breaks a sequence into blocks with a position gutter, the way EMBOSS does. */
export function formatBlocks(seq: string, lineLength = 60, blockSize = 10) {
  const lines: { start: number; blocks: string[] }[] = [];
  for (let i = 0; i < seq.length; i += lineLength) {
    const line = seq.slice(i, i + lineLength);
    const blocks: string[] = [];
    for (let j = 0; j < line.length; j += blockSize) blocks.push(line.slice(j, j + blockSize));
    lines.push({ start: i + 1, blocks });
  }
  return lines;
}

export function toFasta(id: string, seq: string, lineLength = 60) {
  const body = seq.match(new RegExp(`.{1,${lineLength}}`, 'g'))?.join('\n') ?? '';
  return `>${id}\n${body}\n`;
}
