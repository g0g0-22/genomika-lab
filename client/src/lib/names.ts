const TITLE = /^(?:проф\.|д-р|prof\.|dr\.)\s*/i;

/**
 * Two initials for an avatar. Titles are stripped one after another: a name
 * like "проф. д-р Ана Трајковска" carries two, and stripping only the first
 * produced "дА".
 */
export function initials(name: string) {
  let rest = name.trim();
  while (TITLE.test(rest)) rest = rest.replace(TITLE, '');
  return rest.split(/\s+/).map(word => word[0] ?? '').slice(0, 2).join('').toUpperCase();
}
