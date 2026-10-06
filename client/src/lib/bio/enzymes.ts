/**
 * Restriction enzymes, digestion and gel migration.
 *
 * Recognition sites are written in IUPAC notation and compiled to a regular
 * expression; the caret in `site` marks where the enzyme cuts the top strand.
 */

export type Enzyme = {
  name: string;
  site: string;        // with '^' marking the cut, e.g. "G^AATTC"
  supplier: string;
  overhang: "5'" | "3'" | 'blunt';
};

export const ENZYMES: Enzyme[] = [
  { name: 'EcoRI',   site: 'G^AATTC',   supplier: 'E. coli RY13',        overhang: "5'" },
  { name: 'BamHI',   site: 'G^GATCC',   supplier: 'B. amyloliquefaciens', overhang: "5'" },
  { name: 'HindIII', site: 'A^AGCTT',   supplier: 'H. influenzae Rd',    overhang: "5'" },
  { name: 'PstI',    site: 'CTGCA^G',   supplier: 'P. stuartii',         overhang: "3'" },
  { name: 'SmaI',    site: 'CCC^GGG',   supplier: 'S. marcescens',       overhang: 'blunt' },
  { name: 'XhoI',    site: 'C^TCGAG',   supplier: 'X. holcicola',        overhang: "5'" },
  { name: 'SalI',    site: 'G^TCGAC',   supplier: 'S. albus',            overhang: "5'" },
  { name: 'KpnI',    site: 'GGTAC^C',   supplier: 'K. pneumoniae',       overhang: "3'" },
  { name: 'SacI',    site: 'GAGCT^C',   supplier: 'S. achromogenes',     overhang: "3'" },
  { name: 'PvuII',   site: 'CAG^CTG',   supplier: 'P. vulgaris',         overhang: 'blunt' },
  { name: 'EcoRV',   site: 'GAT^ATC',   supplier: 'E. coli J62',         overhang: 'blunt' },
  { name: 'NcoI',    site: 'C^CATGG',   supplier: 'N. corallina',        overhang: "5'" },
  { name: 'XbaI',    site: 'T^CTAGA',   supplier: 'X. badrii',           overhang: "5'" },
  { name: 'SpeI',    site: 'A^CTAGT',   supplier: 'S. pyogenes',         overhang: "5'" },
  { name: 'NdeI',    site: 'CA^TATG',   supplier: 'N. denitrificans',    overhang: "5'" },
  { name: 'BglII',   site: 'A^GATCT',   supplier: 'B. globigii',         overhang: "5'" },
  { name: 'NotI',    site: 'GC^GGCCGC', supplier: 'N. otitidis',         overhang: "5'" },
  { name: 'HaeIII',  site: 'GG^CC',     supplier: 'H. aegyptius',        overhang: 'blunt' },
  { name: 'AluI',    site: 'AG^CT',     supplier: 'A. luteus',           overhang: 'blunt' },
  { name: 'TaqI',    site: 'T^CGA',     supplier: 'T. aquaticus',        overhang: "5'" }
];

const IUPAC: Record<string, string> = {
  A: 'A', C: 'C', G: 'G', T: 'T',
  R: '[AG]', Y: '[CT]', S: '[GC]', W: '[AT]', K: '[GT]', M: '[AC]',
  B: '[CGT]', D: '[AGT]', H: '[ACT]', V: '[ACG]', N: '[ACGT]'
};

export const recognitionSequence = (enzyme: Enzyme) => enzyme.site.replace('^', '');
export const cutOffset = (enzyme: Enzyme) => enzyme.site.indexOf('^');

function siteRegex(enzyme: Enzyme) {
  const pattern = recognitionSequence(enzyme).split('').map(c => IUPAC[c] ?? c).join('');
  return new RegExp(pattern, 'g');
}

export type CutSite = {
  enzyme: string;
  /** 0-based index of the first base of the recognition site. */
  siteStart: number;
  /** 0-based index of the phosphodiester bond that is broken on the top strand. */
  position: number;
  overhang: Enzyme['overhang'];
};

/** Finds every recognition site of the given enzymes, overlaps included. */
export function findCutSites(seq: string, enzymes: Enzyme[]): CutSite[] {
  const sites: CutSite[] = [];
  for (const enzyme of enzymes) {
    const regex = siteRegex(enzyme);
    const offset = cutOffset(enzyme);
    let m: RegExpExecArray | null;
    while ((m = regex.exec(seq)) !== null) {
      sites.push({
        enzyme: enzyme.name,
        siteStart: m.index,
        position: m.index + offset,
        overhang: enzyme.overhang
      });
      regex.lastIndex = m.index + 1;   // allow overlapping sites
    }
  }
  return sites.sort((a, b) => a.position - b.position);
}

export type Fragment = {
  start: number;   // 1-based inclusive
  end: number;     // 1-based inclusive
  length: number;
  leftEnzyme: string | null;
  rightEnzyme: string | null;
};

/** Cuts a linear or circular sequence at the given sites. */
export function digest(seq: string, sites: CutSite[], circular = false): Fragment[] {
  if (!seq.length) return [];
  const unique = [...new Map(sites.map(s => [s.position, s])).values()]
    .filter(s => s.position > 0 && s.position < seq.length)
    .sort((a, b) => a.position - b.position);

  if (unique.length === 0) {
    return [{ start: 1, end: seq.length, length: seq.length, leftEnzyme: null, rightEnzyme: null }];
  }

  const fragments: Fragment[] = [];

  if (circular) {
    for (let i = 0; i < unique.length; i++) {
      const from = unique[i];
      const to = unique[(i + 1) % unique.length];
      const length = i === unique.length - 1
        ? seq.length - from.position + to.position
        : to.position - from.position;
      fragments.push({
        start: from.position + 1,
        end: i === unique.length - 1 ? to.position : to.position,
        length,
        leftEnzyme: from.enzyme,
        rightEnzyme: to.enzyme
      });
    }
    return fragments.sort((a, b) => b.length - a.length);
  }

  let previous = 0;
  let previousEnzyme: string | null = null;
  for (const site of unique) {
    fragments.push({
      start: previous + 1,
      end: site.position,
      length: site.position - previous,
      leftEnzyme: previousEnzyme,
      rightEnzyme: site.enzyme
    });
    previous = site.position;
    previousEnzyme = site.enzyme;
  }
  fragments.push({
    start: previous + 1,
    end: seq.length,
    length: seq.length - previous,
    leftEnzyme: previousEnzyme,
    rightEnzyme: null
  });

  return fragments.sort((a, b) => b.length - a.length);
}

/* ------------------------------------------------------------------- GEL -- */

/** A standard 1 kb ladder, in base pairs. */
export const LADDER_1KB = [10000, 8000, 6000, 5000, 4000, 3000, 2000, 1500, 1000, 750, 500, 250];
/** A 100 bp ladder for small fragments. */
export const LADDER_100BP = [1500, 1000, 900, 800, 700, 600, 500, 400, 300, 200, 100];

/**
 * Migration distance on an agarose gel.
 *
 * Over the useful range, distance travelled is close to linear in the log of
 * fragment length, so this maps a length onto 0 (well) … 1 (gel front).
 */
export function migration(length: number, minBp: number, maxBp: number) {
  const clamped = Math.min(Math.max(length, minBp), maxBp);
  const top = Math.log10(maxBp);
  const bottom = Math.log10(minBp);
  if (top === bottom) return 0.5;
  return (top - Math.log10(clamped)) / (top - bottom);
}

/** Higher agarose percentage resolves small fragments better. */
export const GEL_RANGES: Record<string, [number, number]> = {
  '0.7': [800, 20000],
  '1.0': [400, 10000],
  '1.5': [150, 4000],
  '2.0': [50, 2000]
};
