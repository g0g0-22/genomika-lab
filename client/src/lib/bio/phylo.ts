/**
 * Distance-based phylogenetic reconstruction.
 *
 * Two classical algorithms are implemented over the same distance matrix:
 *   UPGMA assumes a constant rate of change and produces an ultrametric,
 *     rooted tree — every leaf sits at the same distance from the root;
 *   Neighbour-Joining drops that assumption and produces an unrooted tree
 *     with additive branch lengths, which is usually the better estimate.
 */

export type DistanceModel = 'p' | 'jc';

export type TreeNode = {
  name: string;
  children: TreeNode[];
  branchLength: number;
  height: number;     // distance from this node down to its leaves
  leafCount: number;
};

/** Fraction of differing positions, ignoring columns with a gap. */
export function pDistance(a: string, b: string) {
  const n = Math.min(a.length, b.length);
  let compared = 0;
  let differing = 0;
  for (let i = 0; i < n; i++) {
    if (a[i] === '-' || b[i] === '-') continue;
    compared++;
    if (a[i] !== b[i]) differing++;
  }
  return compared ? differing / compared : 0;
}

/**
 * Jukes-Cantor correction. Undoes the saturation of p-distance by accounting
 * for multiple substitutions at the same site.
 */
export function jukesCantor(p: number) {
  if (p <= 0) return 0;
  if (p >= 0.75) return 3;          // saturated: report a large finite distance
  return -0.75 * Math.log(1 - (4 / 3) * p);
}

export function distanceMatrix(sequences: string[], model: DistanceModel = 'p') {
  const n = sequences.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const p = pDistance(sequences[i], sequences[j]);
      const d = model === 'jc' ? jukesCantor(p) : p;
      matrix[i][j] = d;
      matrix[j][i] = d;
    }
  }
  return matrix;
}

const leaf = (name: string): TreeNode => ({ name, children: [], branchLength: 0, height: 0, leafCount: 1 });

/* ----------------------------------------------------------------- UPGMA -- */

export function upgma(labels: string[], distances: number[][]): TreeNode | null {
  const n = labels.length;
  if (n < 2) return n === 1 ? leaf(labels[0]) : null;

  const matrix = distances.map(row => [...row]);
  const nodes: (TreeNode | null)[] = labels.map(leaf);
  const active = new Set<number>(labels.map((_, i) => i));

  while (active.size > 1) {
    let bestI = -1, bestJ = -1, bestD = Infinity;
    for (const i of active) {
      for (const j of active) {
        if (j <= i) continue;
        if (matrix[i][j] < bestD) { bestD = matrix[i][j]; bestI = i; bestJ = j; }
      }
    }

    const left = nodes[bestI]!;
    const right = nodes[bestJ]!;
    const height = bestD / 2;
    const parent: TreeNode = {
      name: '',
      children: [left, right],
      branchLength: 0,
      height,
      leafCount: left.leafCount + right.leafCount
    };
    left.branchLength = Math.max(height - left.height, 0);
    right.branchLength = Math.max(height - right.height, 0);

    // Weighted average of the two merged clusters (the "average linkage" step).
    for (const k of active) {
      if (k === bestI || k === bestJ) continue;
      const merged =
        (matrix[bestI][k] * left.leafCount + matrix[bestJ][k] * right.leafCount) /
        (left.leafCount + right.leafCount);
      matrix[bestI][k] = merged;
      matrix[k][bestI] = merged;
    }

    nodes[bestI] = parent;
    nodes[bestJ] = null;
    active.delete(bestJ);
  }

  const rootIndex = [...active][0];
  return nodes[rootIndex]!;
}

/* ---------------------------------------------------- NEIGHBOUR-JOINING -- */

export function neighbourJoining(labels: string[], distances: number[][]): TreeNode | null {
  const n = labels.length;
  if (n < 3) return upgma(labels, distances);

  const matrix = distances.map(row => [...row]);
  const nodes: (TreeNode | null)[] = labels.map(leaf);
  const active = new Set<number>(labels.map((_, i) => i));

  while (active.size > 2) {
    const size = active.size;
    const totals = new Map<number, number>();
    for (const i of active) {
      let sum = 0;
      for (const j of active) if (i !== j) sum += matrix[i][j];
      totals.set(i, sum);
    }

    // Q(i,j) = (r-2)·d(i,j) − R(i) − R(j); the smallest Q joins next.
    let bestI = -1, bestJ = -1, bestQ = Infinity;
    for (const i of active) {
      for (const j of active) {
        if (j <= i) continue;
        const q = (size - 2) * matrix[i][j] - totals.get(i)! - totals.get(j)!;
        if (q < bestQ) { bestQ = q; bestI = i; bestJ = j; }
      }
    }

    const dij = matrix[bestI][bestJ];
    const deltaI = 0.5 * dij + (totals.get(bestI)! - totals.get(bestJ)!) / (2 * (size - 2));
    const deltaJ = dij - deltaI;

    const left = nodes[bestI]!;
    const right = nodes[bestJ]!;
    left.branchLength = Math.max(deltaI, 0);
    right.branchLength = Math.max(deltaJ, 0);

    const parent: TreeNode = {
      name: '',
      children: [left, right],
      branchLength: 0,
      height: Math.max(left.height + left.branchLength, right.height + right.branchLength),
      leafCount: left.leafCount + right.leafCount
    };

    for (const k of active) {
      if (k === bestI || k === bestJ) continue;
      const d = 0.5 * (matrix[bestI][k] + matrix[bestJ][k] - dij);
      matrix[bestI][k] = d;
      matrix[k][bestI] = d;
    }

    nodes[bestI] = parent;
    nodes[bestJ] = null;
    active.delete(bestJ);
  }

  const [a, b] = [...active];
  const left = nodes[a]!;
  const right = nodes[b]!;
  const finalDistance = matrix[a][b];
  left.branchLength = finalDistance / 2;
  right.branchLength = finalDistance / 2;
  return {
    name: '',
    children: [left, right],
    branchLength: 0,
    height: Math.max(left.height + left.branchLength, right.height + right.branchLength),
    leafCount: left.leafCount + right.leafCount
  };
}

/* ------------------------------------------------------------- RENDERING -- */

export function toNewick(node: TreeNode | null): string {
  if (!node) return ';';
  const walk = (n: TreeNode): string => {
    if (n.children.length === 0) return `${n.name.replace(/[(),:;]/g, '_')}:${n.branchLength.toFixed(5)}`;
    return `(${n.children.map(walk).join(',')}):${n.branchLength.toFixed(5)}`;
  };
  const body = node.children.length ? `(${node.children.map(walk).join(',')})` : walk(node);
  return `${body};`;
}

export type LayoutNode = {
  node: TreeNode;
  x: number;       // cumulative distance from the root
  y: number;       // leaf-order position
  parentX: number;
  isLeaf: boolean;
};

/** Turns a tree into coordinates for a rectangular cladogram. */
export function layoutTree(root: TreeNode | null) {
  const nodes: LayoutNode[] = [];
  if (!root) return { nodes, maxX: 1, leaves: 0 };

  let leafIndex = 0;
  let maxX = 0;

  const walk = (node: TreeNode, depth: number, parentX: number): number => {
    const x = parentX + node.branchLength;
    maxX = Math.max(maxX, x);
    if (node.children.length === 0) {
      const y = leafIndex++;
      nodes.push({ node, x, y, parentX, isLeaf: true });
      return y;
    }
    const childY = node.children.map(child => walk(child, depth + 1, x));
    const y = (Math.min(...childY) + Math.max(...childY)) / 2;
    nodes.push({ node, x, y, parentX, isLeaf: false });
    return y;
  };

  walk(root, 0, 0);
  return { nodes, maxX: maxX || 1, leaves: leafIndex };
}
