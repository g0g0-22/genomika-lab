#!/usr/bin/env node
/**
 * Pull every Macedonian string in the project into one reviewable file, and
 * put a reviewed file back.
 *
 *   node scripts/i18n-review.mjs extract   > writes i18n-review.json
 *   node scripts/i18n-review.mjs apply     < reads  i18n-review.json
 *
 * Strings live in three places: the UI dictionary, the database seed, and a
 * handful hardcoded in components. Each entry carries the id of where it came
 * from and its original value, so `apply` can put an edit back exactly where
 * it belongs and refuse anything ambiguous.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REVIEW = join(ROOT, 'i18n-review.json');

const DICT = join(ROOT, 'client/src/i18n/dict.ts');
const SEED = join(ROOT, 'server/src/seed.js');

/** Macedonian hardcoded in components rather than held in the dictionary. */
const INLINE = [
  // Kept deliberately small: everything else now lives in the dictionary.
  // Verified against the source before each release of this script.
];

const read = (p) => readFileSync(p, 'utf8');

/* ------------------------------------------------------------- EXTRACT -- */

function extract() {
  const entries = [];

  // 1. UI dictionary. Parsed rather than imported so the script needs no
  //    TypeScript loader, and so extract and apply read the file the same way.
  //    Entries are `'key': ['mk', 'en'],` on one line or spread over three.
  const dictSrc = read(DICT);
  const entryRe = /'([a-zA-Z0-9._]+)':\s*\[\s*\n?\s*'((?:[^'\\]|\\.)*)',\s*\n?\s*'((?:[^'\\]|\\.)*)'\s*\n?\s*\]/g;
  for (const m of dictSrc.matchAll(entryRe)) {
    const [, key, mk, en] = m;
    entries.push({ id: `dict:${key}`, where: 'UI label', en: unesc(en), mk: unesc(mk) });
  }

  // 2. Seed content. Scanned over the whole document rather than line by line,
  //    because several records put slug, *_mk and *_en on one line. Each entry
  //    is identified by field name plus which occurrence of that field it is,
  //    so an edit can be put back without depending on line numbers.
  const seed = read(SEED);
  const seen = new Map();
  const mkRe = /(\w+)_mk:\s*'((?:[^'\\]|\\.)*)'/g;
  for (const m of seed.matchAll(mkRe)) {
    const [, field, mk] = m;
    const n = seen.get(field) ?? 0;
    seen.set(field, n + 1);

    // The English sibling is the next `<field>_en:` after this point.
    const after = seed.slice(m.index, m.index + 600);
    const e = after.match(new RegExp(`${field}_en:\\s*'((?:[^'\\\\]|\\\\.)*)'`));

    // Nearest preceding slug names the record for a human reviewer.
    const before = seed.slice(Math.max(0, m.index - 1200), m.index);
    const slugs = [...before.matchAll(/slug:\s*'([^']+)'/g)];
    const context = slugs.length ? slugs[slugs.length - 1][1] : 'record';

    entries.push({
      id: `seed:${field}:${n}`,
      where: `content · ${context} · ${field}`,
      en: e ? unesc(e[1]) : '',
      mk: unesc(mk)
    });
  }

  // 3. Hardcoded in components.
  INLINE.forEach((item, i) => {
    entries.push({ id: `inline:${i}`, where: `hardcoded · ${item.file}`, en: item.en, mk: item.mk });
  });

  writeFileSync(REVIEW, JSON.stringify({
    _instructions:
      'Review the "mk" value of every entry against its "en" counterpart. Edit ONLY the "mk" ' +
      'values. Do not add, remove, reorder or rename entries, and do not touch "id", "where" ' +
      'or "en". Keep any placeholder, punctuation and capitalisation conventions already used. ' +
      'Return the whole file in exactly this JSON shape.',
    _note:
      'Entries prefixed dict: are short UI labels — keep them terse. Entries prefixed seed: are ' +
      'prose for a fictional research laboratory — these matter most, and should read as if ' +
      'originally written in Macedonian rather than translated from the English.',
    _counts: {
      total: entries.length,
      dict: entries.filter(e => e.id.startsWith('dict:')).length,
      seed: entries.filter(e => e.id.startsWith('seed:')).length,
      inline: entries.filter(e => e.id.startsWith('inline:')).length
    },
    entries
  }, null, 2) + '\n');

  console.log(`wrote ${REVIEW}`);
  console.log(`  ${entries.length} strings — ${entries.filter(e => e.id.startsWith('dict:')).length} UI labels, ` +
              `${entries.filter(e => e.id.startsWith('seed:')).length} content, ` +
              `${entries.filter(e => e.id.startsWith('inline:')).length} hardcoded`);
  const missing = entries.filter(e => !e.en);
  if (missing.length) console.warn(`  note: ${missing.length} entries have no English counterpart`);
}

/* --------------------------------------------------------------- APPLY -- */

function apply() {
  const reviewed = JSON.parse(read(REVIEW));
  const original = JSON.parse(read(REVIEW + '.orig'));
  const before = new Map(original.entries.map(e => [e.id, e.mk]));

  const changed = reviewed.entries.filter(e => before.has(e.id) && before.get(e.id) !== e.mk);
  if (!changed.length) { console.log('no changes to apply'); return; }

  const files = { dict: read(DICT), seed: read(SEED) };
  const inlineFiles = new Map();
  const applied = [], skipped = [];

  for (const entry of changed) {
    const old = before.get(entry.id);
    const [kind] = entry.id.split(':');

    if (kind === 'dict') {
      const key = entry.id.slice(5);
      // Replace only the first quoted value after this key.
      const re = new RegExp(`('${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':\\s*\\[\\s*\\n?\\s*')((?:[^'\\\\]|\\\\.)*)(')`);
      if (!re.test(files.dict)) { skipped.push([entry.id, 'key not found']); continue; }
      files.dict = files.dict.replace(re, (_, a, _v, c) => a + esc(entry.mk) + c);
      applied.push(entry.id);

    } else if (kind === 'seed') {
      const [, field, nth] = entry.id.split(':');
      const matches = [...files.seed.matchAll(new RegExp(`${field}_mk:\\s*'((?:[^'\\\\]|\\\\.)*)'`, 'g'))];
      const hit = matches[Number(nth)];
      if (!hit) { skipped.push([entry.id, 'occurrence not found']); continue; }
      if (unesc(hit[1]) !== old) { skipped.push([entry.id, 'source changed since extract']); continue; }
      const replacement = `${field}_mk: '${esc(entry.mk)}'`;
      files.seed = files.seed.slice(0, hit.index) + replacement + files.seed.slice(hit.index + hit[0].length);
      applied.push(entry.id);

    } else {
      const item = INLINE[Number(entry.id.split(':')[1])];
      const path = join(ROOT, item.file);
      if (!inlineFiles.has(path)) inlineFiles.set(path, read(path));
      const text = inlineFiles.get(path);
      const hits = text.split(old).length - 1;
      if (hits !== 1) { skipped.push([entry.id, `${hits} matches, refusing`]); continue; }
      inlineFiles.set(path, text.replace(old, entry.mk));
      applied.push(entry.id);
    }
  }

  writeFileSync(DICT, files.dict);
  writeFileSync(SEED, files.seed);
  for (const [path, text] of inlineFiles) writeFileSync(path, text);

  console.log(`applied ${applied.length} of ${changed.length} changed strings`);
  if (skipped.length) {
    console.warn('skipped:');
    for (const [id, why] of skipped) console.warn(`  ${id} — ${why}`);
  }
}

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const unesc = (s) => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\');

const cmd = process.argv[2];
if (cmd === 'extract') extract();
else if (cmd === 'apply') apply();
else { console.error('usage: i18n-review.mjs extract | apply'); process.exit(1); }
