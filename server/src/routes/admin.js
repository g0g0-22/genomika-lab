import { Router } from 'express';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../db.js';
import { requireAdmin } from '../lib/auth.js';
import { localDate } from '../lib/dates.js';
import { validate, text, int, num, bool, oneOf, date, pattern, ref } from '../lib/validate.js';

const UPLOAD_DIR = process.env.UPLOAD_DIR
  || join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads');

export const admin = Router();
admin.use(requireAdmin);

const slugify = (s) => String(s).toLowerCase().trim()
  .replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 60) || `item-${Date.now()}`;

admin.get('/overview', (_req, res) => {
  res.json({
    counts: db.prepare(`SELECT
      (SELECT COUNT(*) FROM publications) publications,
      (SELECT COUNT(*) FROM people) people,
      (SELECT COUNT(*) FROM news) news,
      (SELECT COUNT(*) FROM datasets) datasets,
      (SELECT COUNT(*) FROM bookings WHERE status != 'cancelled') bookings,
      (SELECT COUNT(*) FROM applications) applications,
      (SELECT COUNT(*) FROM messages WHERE handled = 0) unread_messages,
      (SELECT COUNT(*) FROM rsvps) rsvps`).get(),
    recentApplications: db.prepare(
      `SELECT a.*, p.title_en AS position_en, p.title_mk AS position_mk FROM applications a
       JOIN positions p ON p.id = a.position_id ORDER BY a.created_at DESC LIMIT 20`).all(),
    messages: db.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 20').all(),
    upcomingBookings: db.prepare(
      `SELECT b.*, i.name_en AS instrument_en, i.name_mk AS instrument_mk,
              COALESCE(p.name_mk, b.user_name) AS user_name_mk,
              COALESCE(p.name_en, b.user_name) AS user_name_en
       FROM bookings b
       JOIN instruments i ON i.id = b.instrument_id
       LEFT JOIN users u ON u.id = b.user_id
       LEFT JOIN people p ON p.id = u.person_id
       WHERE b.status != 'cancelled' AND b.date >= date('now', 'localtime') ORDER BY b.date, b.start_hour LIMIT 20`).all(),
    rsvps: db.prepare(
      `SELECT r.*, e.title_en AS event_en, e.title_mk AS event_mk FROM rsvps r
       JOIN events e ON e.id = r.event_id ORDER BY r.created_at DESC LIMIT 20`).all()
  });
});

/* ------------------------------------------------------------- SCHEMAS */

const NEWS_TAGS = ['news', 'publication', 'grant', 'outreach', 'facility', 'award', 'people'];
const SENIORITY = ['faculty', 'postdoc', 'staff', 'phd', 'msc'];
const THIS_YEAR = new Date().getFullYear();

const PUBLICATION = {
  title: text({ required: true, max: 300 }),
  authors: text({ required: true, max: 500 }),
  venue: text({ required: true, max: 200 }),
  year: int({ min: 1900, max: THIS_YEAR + 1 }),
  type: oneOf(['article', 'conference', 'preprint']),
  doi: pattern(/^10\.\d{4,9}\/\S+$/, { max: 120 }),
  citations: int({ min: 0, max: 1_000_000 }),
  open_access: bool(),
  abstract: text({ max: 4000 }),
  group_id: ref('groups'),
  keywords: text({ max: 300 })
};
/* NOT NULL columns with schema defaults: an omitted value must not be sent as null. */
const PUBLICATION_DEFAULTS = { type: 'article', citations: 0, open_access: 1, year: THIS_YEAR };

const NEWS = {
  title_mk: text({ required: true, max: 300 }),
  title_en: text({ required: true, max: 300 }),
  excerpt_mk: text({ max: 600 }), excerpt_en: text({ max: 600 }),
  body_mk: text({ max: 8000 }), body_en: text({ max: 8000 }),
  date: date(),
  tag: oneOf(NEWS_TAGS)
};

const PERSON = {
  name_mk: text({ required: true, max: 120 }),
  name_en: text({ required: true, max: 120 }),
  role_mk: text({ max: 120 }), role_en: text({ max: 120 }),
  seniority: oneOf(SENIORITY),
  group_id: ref('groups'),
  email: pattern(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, { max: 254 }),
  orcid: pattern(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/),
  github: pattern(/^[A-Za-z0-9-]{1,39}$/),
  bio_mk: text({ max: 4000 }), bio_en: text({ max: 4000 }),
  interests: text({ max: 500 }),
  joined_year: int({ min: 1950, max: THIS_YEAR + 1 }),
  hue: int({ min: 0, max: 360 })
};
/* role_* are NOT NULL in the schema; an empty role is an empty string. */
const PERSON_DEFAULTS = { seniority: 'researcher', role_mk: '', role_en: '', hue: 140, joined_year: THIS_YEAR };

const DATASET = {
  title_mk: text({ required: true, max: 300 }), title_en: text({ required: true, max: 300 }),
  description_mk: text({ max: 4000 }), description_en: text({ max: 4000 }),
  format: text({ required: true, max: 60 }),
  size_mb: num({ min: 0, max: 10_000_000 }),
  license: text({ required: true, max: 60 }),
  year: int({ min: 1900, max: THIS_YEAR + 1 }),
  doi: pattern(/^10\.\d{4,9}\/\S+$/, { max: 120 }),
  organism: text({ max: 200 })
};

const invalid = (res, errors) => res.status(400).json({ error: 'validation_failed', fields: errors });
const isUnique = (err) => String(err?.code || err?.message).includes('UNIQUE');

/** Writes only the validated fields; never the raw request body. */
function update(table, id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  db.prepare(`UPDATE ${table} SET ${keys.map(k => `${k} = @${k}`).join(', ')} WHERE id = @id`).run({ ...fields, id });
}

function insert(table, fields) {
  const keys = Object.keys(fields);
  return db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(k => `@${k}`).join(',')})`).run(fields);
}

/* NOT NULL columns refuse an explicit null, so a field cleared to null on
   update is only written when the column allows it. */
const withoutNulls = (fields, nullable) =>
  Object.fromEntries(Object.entries(fields).filter(([k, v]) => v !== null || nullable.includes(k)));

/* ------------------------------------------------------ PUBLICATIONS CRUD */

admin.post('/publications', (req, res) => {
  const { value, errors, ok } = validate(PUBLICATION, req.body);
  if (!ok) return invalid(res, errors);
  const fields = { ...value };
  for (const [k, v] of Object.entries(PUBLICATION_DEFAULTS)) if (fields[k] === null) fields[k] = v;
  const info = insert('publications', fields);
  res.status(201).json(db.prepare('SELECT * FROM publications WHERE id = ?').get(info.lastInsertRowid));
});

admin.put('/publications/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM publications WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const { value, errors, ok } = validate(PUBLICATION, req.body, { partial: true });
  if (!ok) return invalid(res, errors);
  update('publications', existing.id, withoutNulls(value, ['doi', 'abstract', 'group_id', 'keywords']));
  res.json(db.prepare('SELECT * FROM publications WHERE id = ?').get(existing.id));
});

admin.delete('/publications/:id', (req, res) => {
  const info = db.prepare('DELETE FROM publications WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

/* --------------------------------------------------------------- NEWS CRUD */

admin.post('/news', (req, res) => {
  const { value, errors, ok } = validate(NEWS, req.body);
  if (!ok) return invalid(res, errors);
  const fields = {
    ...value,
    slug: req.body?.slug ? slugify(req.body.slug) : slugify(value.title_en),
    date: value.date || localDate(),
    tag: value.tag || 'news'
  };
  try {
    const info = insert('news', fields);
    res.status(201).json(db.prepare('SELECT * FROM news WHERE id = ?').get(info.lastInsertRowid));
  } catch (err) {
    if (isUnique(err)) return res.status(409).json({ error: 'slug_taken' });
    throw err;
  }
});

admin.put('/news/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM news WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const { value, errors, ok } = validate(NEWS, req.body, { partial: true });
  if (!ok) return invalid(res, errors);
  const fields = withoutNulls(value, ['excerpt_mk', 'excerpt_en', 'body_mk', 'body_en']);
  if (req.body?.slug) fields.slug = slugify(req.body.slug);
  try {
    update('news', existing.id, fields);
  } catch (err) {
    // Creating with a taken slug was a 409; updating to one was a 500.
    if (isUnique(err)) return res.status(409).json({ error: 'slug_taken' });
    throw err;
  }
  res.json(db.prepare('SELECT * FROM news WHERE id = ?').get(existing.id));
});

admin.delete('/news/:id', (req, res) => {
  const info = db.prepare('DELETE FROM news WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

/* ------------------------------------------------------------- DATASETS */

admin.put('/datasets/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM datasets WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const { value, errors, ok } = validate(DATASET, req.body, { partial: true });
  if (!ok) return invalid(res, errors);
  update('datasets', existing.id, withoutNulls(value, ['description_mk', 'description_en', 'doi', 'organism']));
  res.json(db.prepare('SELECT * FROM datasets WHERE id = ?').get(existing.id));
});

/* ---------------------------------------------------------------- PEOPLE */

admin.post('/people', (req, res) => {
  const { value, errors, ok } = validate(PERSON, req.body);
  if (!ok) return invalid(res, errors);
  const fields = { ...value, slug: req.body?.slug ? slugify(req.body.slug) : slugify(value.name_en) };
  for (const [k, v] of Object.entries(PERSON_DEFAULTS)) if (fields[k] === null || fields[k] === undefined) fields[k] = v;
  try {
    const info = insert('people', fields);
    res.status(201).json(db.prepare('SELECT * FROM people WHERE id = ?').get(info.lastInsertRowid));
  } catch (err) {
    if (isUnique(err)) return res.status(409).json({ error: 'slug_taken' });
    throw err;
  }
});

admin.put('/people/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM people WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const { value, errors, ok } = validate(PERSON, req.body, { partial: true });
  if (!ok) return invalid(res, errors);
  try {
    update('people', existing.id, withoutNulls(value,
      ['group_id', 'email', 'orcid', 'github', 'bio_mk', 'bio_en', 'interests', 'joined_year']));
  } catch (err) {
    if (isUnique(err)) return res.status(409).json({ error: 'slug_taken' });
    throw err;
  }
  res.json(db.prepare('SELECT * FROM people WHERE id = ?').get(existing.id));
});

admin.delete('/people/:id', (req, res) => {
  const info = db.prepare('DELETE FROM people WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

/**
 * Serves a stored CV to an administrator. The filename comes from the database
 * rather than the URL, but it is still resolved and checked for containment:
 * a stored value must never be able to address a file outside the upload
 * directory, however it got there.
 */
admin.get('/applications/:id/cv', (req, res) => {
  const row = db.prepare('SELECT cv_filename FROM applications WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  if (!row.cv_filename) return res.status(404).json({ error: 'no_cv_attached' });

  const target = resolve(UPLOAD_DIR, row.cv_filename);
  if (!target.startsWith(resolve(UPLOAD_DIR) + '/')) return res.status(400).json({ error: 'invalid_path' });
  if (!existsSync(target)) return res.status(410).json({ error: 'file_missing' });

  res.download(target, row.cv_filename);
});

/* ---------------------------------------------------------- INBOX ACTIONS */
admin.put('/messages/:id/handled', (req, res) => {
  const info = db.prepare('UPDATE messages SET handled = ? WHERE id = ?')
    .run(req.body?.handled ? 1 : 0, req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

admin.put('/applications/:id/status', (req, res) => {
  const allowed = ['received', 'shortlisted', 'rejected', 'invited'];
  const status = String(req.body?.status || '');
  if (!allowed.includes(status)) return res.status(400).json({ error: 'invalid_status' });
  const info = db.prepare('UPDATE applications SET status = ? WHERE id = ?').run(status, req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});
