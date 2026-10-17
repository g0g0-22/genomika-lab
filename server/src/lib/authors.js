import { db } from '../db.js';

/*
 * A publication's author line is free text ("Trajkovska A, Micevski F"),
 * because papers have co-authors from outside the lab. The members of the lab
 * named in it are linked to their profiles in publication_authors, which is
 * what person pages and the collaboration network read. The seed and the
 * admin API both go through here, so a paper added by hand is linked exactly
 * as a seeded one is.
 */

const TITLES = /\b(Prof|Dr|Doc)\.\s*/gi;

/** "Prof. Ana Trajkovska" → { surname: 'trajkovska', initial: 'a' } */
function profileKey(fullName) {
  const words = fullName.replace(TITLES, '').trim().split(/\s+/);
  return { surname: words.at(-1).toLowerCase(), initial: words[0][0].toLowerCase() };
}

/** "Trajkovska A", "van der Berg JM" → surname, then the first initial. */
function citationKey(author) {
  const words = author.trim().split(/\s+/);
  if (words.length < 2) return null;
  return { surname: words.slice(0, -1).join(' ').toLowerCase(), initial: words.at(-1)[0].toLowerCase() };
}

/** The lab members named in an author line, each with their position in it. */
export function labMembersIn(authors) {
  const people = db.prepare('SELECT id, name_en FROM people').all()
    .map(p => ({ id: p.id, ...profileKey(p.name_en) }));
  return String(authors ?? '').split(',').flatMap((author, position) => {
    const key = citationKey(author);
    const person = key && people.find(p => p.surname === key.surname && p.initial === key.initial);
    return person ? [{ personId: person.id, position }] : [];
  });
}

/** Replaces a publication's links with the members its author line names. */
export function linkAuthors(publicationId, authors) {
  db.prepare('DELETE FROM publication_authors WHERE publication_id = ?').run(publicationId);
  const link = db.prepare(
    'INSERT OR IGNORE INTO publication_authors (publication_id, person_id, position) VALUES (?, ?, ?)');
  for (const { personId, position } of labMembersIn(authors)) link.run(publicationId, personId, position);
}
