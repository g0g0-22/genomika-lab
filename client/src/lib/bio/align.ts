/**
 * Pairwise sequence alignment by dynamic programming.
 *
 * Both classical algorithms share one recurrence and differ in two details:
 *   Needleman-Wunsch (global) initialises the first row and column with
 *     accumulated gap penalties and traces back from the bottom-right corner;
 *   Smith-Waterman (local) clamps every cell at zero and traces back from the
 *     highest-scoring cell until it reaches a zero.
 *
 * The full matrix is returned so the interface can draw it — seeing the matrix
 * is most of the point.
 */

export type AlignMode = 'global' | 'local';
export type Direction = 'none' | 'diag' | 'up' | 'left';

export type AlignParams = {
  match: number;
  mismatch: number;
  gap: number;          // negative number, linear gap cost
  mode: AlignMode;
  substitution?: 'simple' | 'blosum62';
};

export type AlignResult = {
  scores: number[][];
  pointers: Direction[][];
  score: number;
  alignedA: string;
  alignedB: string;
  midline: string;
  path: Array<[number, number]>;   // matrix coordinates of the traceback
  identity: number;                // fraction of identical aligned columns
  similarity: number;              // fraction scoring above zero
  gaps: number;
  length: number;
  cells: number;
  start: [number, number];
  end: [number, number];
};

/** Guard against a browser tab freezing on a pasted chromosome. */
export const MAX_ALIGN_LENGTH = 1200;

/* ------------------------------------------------------------- BLOSUM62 -- */

const BLOSUM_ORDER = 'ARNDCQEGHILKMFPSTWYVBZX*';
const BLOSUM_ROWS = [
  ' 4-1-2-2 0-1-1 0-2-1-1-1-1-2-1 1 0-3-2 0-2-1 0-4',
  '-1 5 0-2-3 1 0-2 0-3-2 2-1-3-2-1-1-3-2-3-1 0-1-4',
  '-2 0 6 1-3 0 0 0 1-3-3 0-2-3-2 1 0-4-2-3 3 0-1-4',
  '-2-2 1 6-3 0 2-1-1-3-4-1-3-3-1 0-1-4-3-3 4 1-1-4',
  ' 0-3-3-3 9-3-4-3-3-1-1-3-1-2-3-1-1-2-2-1-3-3-2-4',
  '-1 1 0 0-3 5 2-2 0-3-2 1 0-3-1 0-1-2-1-2 0 3-1-4',
  '-1 0 0 2-4 2 5-2 0-3-3 1-2-3-1 0-1-3-2-2 1 4-1-4',
  ' 0-2 0-1-3-2-2 6-2-4-4-2-3-3-2 0-2-2-3-3-1-2-1-4',
  '-2 0 1-1-3 0 0-2 8-3-3-1-2-1-2-1-2-2 2-3 0 0-1-4',
  '-1-3-3-3-1-3-3-4-3 4 2-3 1 0-3-2-1-3-1 3-3-3-1-4',
  '-1-2-3-4-1-2-3-4-3 2 4-2 2 0-3-2-1-2-1 1-4-3-1-4',
  '-1 2 0-1-3 1 1-2-1-3-2 5-1-3-1 0-1-3-2-2 0 1-1-4',
  '-1-1-2-3-1 0-2-3-2 1 2-1 5 0-2-1-1-1-1 1-3-1-1-4',
  '-2-3-3-3-2-3-3-3-1 0 0-3 0 6-4-2-2 1 3-1-3-3-1-4',
  '-1-2-2-1-3-1-1-2-2-3-3-1-2-4 7-1-1-4-3-2-2-1-2-4',
  ' 1-1 1 0-1 0 0 0-1-2-2 0-1-2-1 4 1-3-2-2 0 0 0-4',
  ' 0-1 0-1-1-1-1-2-2-1-1-1-1-2-1 1 5-2-2 0-1-1 0-4',
  '-3-3-4-4-2-2-3-2-2-3-2-3-1 1-4-3-211 2-3-4-3-2-4',
  '-2-2-2-3-2-1-2-3 2-1-1-2-1 3-3-2-2 2 7-1-3-2-1-4',
  ' 0-3-3-3-1-2-2-3-3 3 1-2 1-1-2-2 0-3-1 4-3-2-1-4',
  '-2-1 3 4-3 0 1-1 0-3-4 0-3-3-2 0-1-4-3-3 4 1-1-4',
  '-1 0 0 1-3 3 4-2 0-3-3 1-1-3-1 0-1-3-2-2 1 4-1-4',
  ' 0-1-1-1-2-1-1-1-1-1-1-1-1-1-2 0 0-2-1-1-1-1-1-4',
  '-4-4-4-4-4-4-4-4-4-4-4-4-4-4-4-4-4-4-4-4-4-4-4 1'
];

const BLOSUM62: Record<string, Record<string, number>> = (() => {
  const table: Record<string, Record<string, number>> = {};
  BLOSUM_ORDER.split('').forEach((rowChar, r) => {
    const values = BLOSUM_ROWS[r].match(/.{2}/g)!.map(v => parseInt(v.trim(), 10));
    table[rowChar] = {};
    BLOSUM_ORDER.split('').forEach((colChar, c) => { table[rowChar][colChar] = values[c]; });
  });
  return table;
})();

export function blosum62(a: string, b: string) {
  return BLOSUM62[a]?.[b] ?? BLOSUM62['X']?.[b] ?? -1;
}

/* ------------------------------------------------------------- ALIGNMENT -- */

export function align(a: string, b: string, params: AlignParams): AlignResult {
  const { match, mismatch, gap, mode, substitution = 'simple' } = params;
  const n = a.length;
  const m = b.length;

  const score = (x: string, y: string) =>
    substitution === 'blosum62' ? blosum62(x, y) : (x === y ? match : mismatch);

  const scores: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const pointers: Direction[][] = Array.from({ length: n + 1 }, () => new Array<Direction>(m + 1).fill('none'));

  if (mode === 'global') {
    for (let i = 1; i <= n; i++) { scores[i][0] = i * gap; pointers[i][0] = 'up'; }
    for (let j = 1; j <= m; j++) { scores[0][j] = j * gap; pointers[0][j] = 'left'; }
  }

  let best = mode === 'local' ? 0 : -Infinity;
  let bestCell: [number, number] = mode === 'local' ? [0, 0] : [n, m];

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const diagonal = scores[i - 1][j - 1] + score(a[i - 1], b[j - 1]);
      const up = scores[i - 1][j] + gap;
      const left = scores[i][j - 1] + gap;

      let value = diagonal;
      let from: Direction = 'diag';
      if (up > value) { value = up; from = 'up'; }
      if (left > value) { value = left; from = 'left'; }

      if (mode === 'local' && value < 0) { value = 0; from = 'none'; }

      scores[i][j] = value;
      pointers[i][j] = from;

      if (mode === 'local' && value > best) { best = value; bestCell = [i, j]; }
    }
  }

  if (mode === 'global') { best = scores[n][m]; bestCell = [n, m]; }

  /* ---- traceback ---- */
  let [i, j] = bestCell;
  const end: [number, number] = [i, j];
  let alignedA = '';
  let alignedB = '';
  const path: Array<[number, number]> = [];

  while (i > 0 || j > 0) {
    if (mode === 'local' && scores[i][j] === 0) break;
    path.push([i, j]);
    const from = pointers[i][j];
    if (from === 'diag' || (i > 0 && j > 0 && from === 'none' && mode === 'global')) {
      alignedA = a[i - 1] + alignedA;
      alignedB = b[j - 1] + alignedB;
      i--; j--;
    } else if (from === 'up' || (j === 0 && i > 0)) {
      alignedA = a[i - 1] + alignedA;
      alignedB = '-' + alignedB;
      i--;
    } else if (from === 'left' || (i === 0 && j > 0)) {
      alignedA = '-' + alignedA;
      alignedB = b[j - 1] + alignedB;
      j--;
    } else {
      break;
    }
  }
  path.push([i, j]);
  path.reverse();

  /* ---- statistics ---- */
  let identical = 0;
  let similar = 0;
  let gaps = 0;
  let midline = '';
  for (let k = 0; k < alignedA.length; k++) {
    const x = alignedA[k];
    const y = alignedB[k];
    if (x === '-' || y === '-') { gaps++; midline += ' '; continue; }
    if (x === y) { identical++; similar++; midline += '|'; continue; }
    const positive = substitution === 'blosum62' ? blosum62(x, y) > 0 : false;
    if (positive) { similar++; midline += ':'; } else midline += '.';
  }

  const length = alignedA.length;
  return {
    scores,
    pointers,
    score: best,
    alignedA,
    alignedB,
    midline,
    path,
    identity: length ? identical / length : 0,
    similarity: length ? similar / length : 0,
    gaps,
    length,
    cells: n * m,
    start: [i, j],
    end
  };
}

/** Percent identity between two same-length aligned strings. */
export function percentIdentity(a: string, b: string) {
  if (!a.length) return 0;
  let same = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i] && a[i] !== '-') same++;
  return same / a.length;
}
