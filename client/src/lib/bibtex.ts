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

/**
 * Authors are stored as "Trajkovska A, Stefanovski M". BibTeX reads a name
 * without a comma as "First Last", so "Trajkovska A" would become a person
 * whose surname is "A". The comma form is unambiguous: "Trajkovska, A.".
 */
export function bibtexAuthors(authors: string) {
  return authors
    .split(',')
    .map(a => a.trim())
    .filter(Boolean)
    .map(name => {
      const parts = name.split(/\s+/);
      const initials = parts.slice(1).map(p => (p.endsWith('.') ? p : `${p}.`)).join(' ');
      return latexEscape(initials ? `${parts[0]}, ${initials}` : parts[0]);
    })
    .join(' and ');
}

/** Formats one record the way a BibTeX file expects it. */
export function toBibtex(pub: BibRecord) {
  const surname = pub.authors.split(',')[0].trim().split(/\s+/)[0].toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
  const word = pub.title.split(/\s+/).find(w => w.length > 3)?.toLowerCase().replace(/[^a-z]/g, '') || 'untitled';
  const key = `${surname}${pub.year}${word}`;
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
