/**
 * BibTeX export for publication records.
 *
 * Kept out of the page component so it can be tested directly: a citation
 * file that a reference manager misreads is a quiet failure that no one
 * notices until a paper is submitted with the wrong author names.
 */

export type BibRecord = {
  title: string;
  authors: string;
  venue: string;
  year: number;
  type: string;
  doi?: string | null;
};

/*
 * Characters that LaTeX treats as commands. An unescaped "&" or "%" in a
 * title breaks compilation of the whole bibliography, not just one entry.
 */
const LATEX_SPECIALS: Record<string, string> = {
  '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '&': '\\&', '%': '\\%',
  '$': '\\$', '#': '\\#', '_': '\\_', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}'
};
export const latexEscape = (text: string) => text.replace(/[\\{}&%$#_~^]/g, ch => LATEX_SPECIALS[ch]);

/*
 * One author as stored: the surname, which may carry particles ("van der
 * Berg"), then the initials ("J", "JM", "J.M."). Anything without trailing
 * initials — a consortium, say — is kept whole as a surname.
 */
function splitAuthor(name: string) {
  const parts = name.trim().split(/\s+/);
  const last = parts.at(-1) ?? '';
  const isInitials = parts.length > 1 && /^(?:\p{Lu}\.?){1,4}$/u.test(last);
  return isInitials
    ? { surname: parts.slice(0, -1).join(' '), initials: last.replace(/\./g, '').split('') }
    : { surname: parts.join(' '), initials: [] as string[] };
}

/**
 * Authors are stored as "Trajkovska A, Stefanovski M". BibTeX reads a name
 * without a comma as "First Last", so "Trajkovska A" would become a person
 * whose surname is "A". The comma form is unambiguous — "Trajkovska, A." —
 * and keeps a particle with its surname: "van der Berg, J.".
 */
export function bibtexAuthors(authors: string) {
  return authors
    .split(',')
    .map(a => a.trim())
    .filter(Boolean)
    .map(name => {
      const { surname, initials } = splitAuthor(name);
      return latexEscape(initials.length ? `${surname}, ${initials.map(i => `${i}.`).join(' ')}` : surname);
    })
    .join(' and ');
}

/* Citation keys must be plain ASCII; Macedonian names are transliterated. */
const MK_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ѓ: 'gj', е: 'e', ж: 'zh', з: 'z', ѕ: 'dz', и: 'i',
  ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm', н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r', с: 's',
  т: 't', ќ: 'kj', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', џ: 'dzh', ш: 'sh'
};
const keyPart = (text: string) =>
  [...text.toLowerCase()].map(ch => MK_LATIN[ch] ?? ch).join('')
    .normalize('NFD').replace(/[^a-z]/g, '');

/** surname + year + first significant title word, e.g. "trajkovska2025graph". */
export function citationKey(pub: BibRecord) {
  const surname = splitAuthor(pub.authors.split(',')[0] ?? '').surname.split(/\s+/).at(-1) ?? '';
  const word = pub.title.split(/\s+/).find(w => keyPart(w).length > 3) ?? '';
  return `${keyPart(surname) || 'anon'}${pub.year}${keyPart(word) || 'untitled'}`;
}

/** Formats one record the way a BibTeX file expects it. */
export function toBibtex(pub: BibRecord, key = citationKey(pub)) {
  const entry = pub.type === 'conference' ? 'inproceedings' : pub.type === 'preprint' ? 'misc' : 'article';
  const field = pub.type === 'conference' ? 'booktitle' : pub.type === 'preprint' ? 'howpublished' : 'journal';
  return [
    `@${entry}{${key},`,
    `  title   = {${latexEscape(pub.title)}},`,
    `  author  = {${bibtexAuthors(pub.authors)}},`,
    `  ${field.padEnd(7)} = {${latexEscape(pub.venue)}},`,
    `  year    = {${pub.year}},`,
    pub.doi ? `  doi     = {${pub.doi}},` : null,
    `  note    = {GenomikaLab demonstration record}`,
    '}'
  ].filter(Boolean).join('\n');
}

/**
 * A whole bibliography. Two papers with the same first author, year and
 * opening word would share a key, and BibTeX silently keeps only the first;
 * repeats get a, b, c … as reference managers do.
 */
export function toBibtexFile(pubs: BibRecord[]) {
  const seen = new Map<string, number>();
  return pubs.map(pub => {
    const key = citationKey(pub);
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    return toBibtex(pub, n === 0 ? key : `${key}${String.fromCharCode(96 + n)}`);
  }).join('\n\n');
}
