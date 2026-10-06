/**
 * Core nucleotide and protein sequence operations.
 *
 * Everything here is a straightforward, readable implementation rather than an
 * optimised one: the point of these tools is that a student can compare the
 * output on screen against the algorithm in a textbook.
 */

export const DNA_ALPHABET = 'ACGTUN';
export const PROTEIN_ALPHABET = 'ACDEFGHIKLMNPQRSTVWY*';

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

/** Uppercases and keeps only letters of the requested alphabet. */
export function cleanSequence(raw: string, alphabet = DNA_ALPHABET) {
  const upper = raw.toUpperCase().replace(/[^A-Z*]/g, '');
  const allowed = new Set(alphabet.split(''));
  let kept = '';
  let dropped = 0;
  for (const ch of upper) {
    if (allowed.has(ch)) kept += ch;
    else dropped++;
  }
  return { seq: kept, dropped };
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

export const complement = (seq: string) => seq.split('').map(c => COMPLEMENT[c] ?? 'N').join('');
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

/** GC skew in sliding windows: (G - C) / (G + C). Marks replication origins. */
export function gcSkew(seq: string, window = 100) {
  const out: { position: number; skew: number; gc: number }[] = [];
  const step = Math.max(1, Math.floor(window / 2));
  for (let i = 0; i + window <= seq.length; i += step) {
    const slice = seq.slice(i, i + window);
    const { G, C } = baseCounts(slice);
    out.push({
      position: i + Math.floor(window / 2),
      skew: G + C === 0 ? 0 : (G - C) / (G + C),
      gc: (G + C) / slice.length
    });
  }
  return out;
}

/** Average molecular weight of single-stranded DNA, in daltons. */
export function molecularWeight(seq: string) {
  const w: Record<string, number> = { A: 331.2, T: 322.2, G: 347.2, C: 307.2, U: 324.2, N: 327.0 };
  const total = seq.split('').reduce((sum, ch) => sum + (w[ch] ?? 0), 0);
  return seq.length ? total - 61.96 : 0; // one phosphate removed for the 5' end
}

/**
 * Melting temperature. Under 14 bases the Wallace rule applies; above it the
 * GC-based formula gives a far better estimate.
 */
export function meltingTemp(seq: string) {
  const n = seq.length;
  if (!n) return 0;
  const { A, T, G, C } = baseCounts(seq);
  if (n < 14) return 2 * (A + T) + 4 * (G + C);
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

export const AA_NAMES: Record<string, [string, string]> = {
  A: ['Аланин', 'Alanine'],        R: ['Аргинин', 'Arginine'],
  N: ['Аспарагин', 'Asparagine'],  D: ['Аспартат', 'Aspartate'],
  C: ['Цистеин', 'Cysteine'],      E: ['Глутамат', 'Glutamate'],
  Q: ['Глутамин', 'Glutamine'],    G: ['Глицин', 'Glycine'],
  H: ['Хистидин', 'Histidine'],    I: ['Изолеуцин', 'Isoleucine'],
  L: ['Леуцин', 'Leucine'],        K: ['Лизин', 'Lysine'],
  M: ['Метионин', 'Methionine'],   F: ['Фенилаланин', 'Phenylalanine'],
  P: ['Пролин', 'Proline'],        S: ['Серин', 'Serine'],
  T: ['Треонин', 'Threonine'],     W: ['Триптофан', 'Tryptophan'],
  Y: ['Тирозин', 'Tyrosine'],      V: ['Валин', 'Valine'],
  '*': ['Стоп', 'Stop']
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

export function translateAllFrames(seq: string) {
  const rc = reverseComplement(backTranscribe(seq));
  return [0, 1, 2]
    .flatMap(f => [
      { frame: f + 1, strand: '+' as const, protein: translate(seq, f) },
      { frame: -(f + 1), strand: '-' as const, protein: translate(rc, f) }
    ])
    .sort((a, b) => b.frame - a.frame);
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

/* -------------------------------------------------------------------- KMERS */

export function kmerCounts(seq: string, k: number) {
  const counts = new Map<string, number>();
  if (k < 1 || seq.length < k) return counts;
  for (let i = 0; i + k <= seq.length; i++) {
    const kmer = seq.slice(i, i + k);
    if (/[^ACGTU]/.test(kmer)) continue;
    counts.set(kmer, (counts.get(kmer) ?? 0) + 1);
  }
  return counts;
}

export function topKmers(seq: string, k: number, limit = 20) {
  return [...kmerCounts(seq, k).entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([kmer, count]) => ({ kmer, count }));
}

/** Relative codon usage in one reading frame, grouped by amino acid. */
export function codonUsage(seq: string, frame = 0) {
  const dna = backTranscribe(seq);
  const counts = new Map<string, number>();
  let total = 0;
  for (let i = frame; i + 3 <= dna.length; i += 3) {
    const codon = dna.slice(i, i + 3);
    if (!(codon in CODON_TABLE)) continue;
    counts.set(codon, (counts.get(codon) ?? 0) + 1);
    total++;
  }
  const byAminoAcid = new Map<string, { codon: string; count: number; fraction: number }[]>();
  for (const [codon, count] of counts) {
    const aa = CODON_TABLE[codon];
    if (!byAminoAcid.has(aa)) byAminoAcid.set(aa, []);
    byAminoAcid.get(aa)!.push({ codon, count, fraction: 0 });
  }
  for (const list of byAminoAcid.values()) {
    const sum = list.reduce((s, c) => s + c.count, 0);
    list.forEach(c => { c.fraction = sum ? c.count / sum : 0; });
    list.sort((a, b) => b.count - a.count);
  }
  return { total, byAminoAcid };
}

/* ----------------------------------------------------------- HYDROPHOBICITY */

/** Kyte & Doolittle (1982) hydropathy values. */
export const KD_SCALE: Record<string, number> = {
  A: 1.8, R: -4.5, N: -3.5, D: -3.5, C: 2.5, Q: -3.5, E: -3.5, G: -0.4,
  H: -3.2, I: 4.5, L: 3.8, K: -3.9, M: 1.9, F: 2.8, P: -1.6, S: -0.8,
  T: -0.7, W: -0.9, Y: -1.3, V: 4.2, '*': 0, X: 0
};

export function hydropathyProfile(protein: string, window = 9) {
  if (protein.length < window) return [];
  const half = Math.floor(window / 2);
  const out: { position: number; value: number }[] = [];
  for (let i = half; i < protein.length - half; i++) {
    let sum = 0;
    for (let j = i - half; j <= i + half; j++) sum += KD_SCALE[protein[j]] ?? 0;
    out.push({ position: i + 1, value: sum / window });
  }
  return out;
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
