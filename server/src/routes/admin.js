import { Router } from 'express';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../db.js';
import { requireAdmin } from '../lib/auth.js';

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
       WHERE b.status != 'cancelled' AND b.date >= date('now') ORDER BY b.date, b.start_hour LIMIT 20`).all(),
    rsvps: db.prepare(
      `SELECT r.*, e.title_en AS event_en, e.title_mk AS event_mk FROM rsvps r
       JOIN events e ON e.id = r.event_id ORDER BY r.created_at DESC LIMIT 20`).all()
  });
});

/* ------------------------------------------------------ PUBLICATIONS CRUD */
const PUB_FIELDS = ['title','authors','venue','year','type','doi','citations','open_access','abstract','group_id','keywords'];

/*
 * Columns that are NOT NULL with a default. Passing an explicit null defeats
 * the default and raises a constraint error, so an omitted field has to fall
 * back to the same value the schema would have used.
 */
const PUB_DEFAULTS = { type: 'article', citations: 0, open_access: 1, year: new Date().getFullYear() };

admin.post('/publications', (req, res) => {
  const b = req.body || {};
  if (!String(b.title || '').trim()) return res.status(400).json({ error: 'title_required' });
  if (!String(b.authors || '').trim()) return res.status(400).json({ error: 'authors_required' });
  const values = PUB_FIELDS.map(f => b[f] ?? PUB_DEFAULTS[f] ?? null);
  const info = db.prepare(
    `INSERT INTO publications (${PUB_FIELDS.join(',')}) VALUES (${PUB_FIELDS.map(() => '?').join(',')})`
  ).run(...values);
  res.status(201).json(db.prepare('SELECT * FROM publications WHERE id = ?').get(info.lastInsertRowid));
});

admin.put('/publications/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM publications WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const merged = { ...existing, ...req.body };
  db.prepare(`UPDATE publications SET ${PUB_FIELDS.map(f => `${f} = @${f}`).join(', ')} WHERE id = @id`)
    .run({ ...merged, id: existing.id });
  res.json(db.prepare('SELECT * FROM publications WHERE id = ?').get(existing.id));
});

admin.delete('/publications/:id', (req, res) => {
  const info = db.prepare('DELETE FROM publications WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

/* --------------------------------------------------------------- NEWS CRUD */
const NEWS_FIELDS = ['slug','title_mk','title_en','excerpt_mk','excerpt_en','body_mk','body_en','date','tag'];

admin.post('/news', (req, res) => {
  const b = req.body || {};
  if (!String(b.title_en || '').trim() || !String(b.title_mk || '').trim())
    return res.status(400).json({ error: 'both_titles_required' });
  const row = { ...Object.fromEntries(NEWS_FIELDS.map(f => [f, b[f] ?? null])) };
  row.slug = b.slug ? slugify(b.slug) : slugify(b.title_en);
  row.date = b.date || new Date().toISOString().slice(0, 10);
  row.tag = b.tag || 'news';
  try {
    const info = db.prepare(`INSERT INTO news (${NEWS_FIELDS.join(',')}) VALUES (${NEWS_FIELDS.map(f => `@${f}`).join(',')})`).run(row);
    res.status(201).json(db.prepare('SELECT * FROM news WHERE id = ?').get(info.lastInsertRowid));
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) return res.status(409).json({ error: 'slug_taken' });
    throw err;
  }
});

admin.put('/news/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM news WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const merged = { ...existing, ...req.body, id: existing.id };
  db.prepare(`UPDATE news SET ${NEWS_FIELDS.map(f => `${f} = @${f}`).join(', ')} WHERE id = @id`).run(merged);
  res.json(db.prepare('SELECT * FROM news WHERE id = ?').get(existing.id));
});

admin.delete('/news/:id', (req, res) => {
  const info = db.prepare('DELETE FROM news WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

/* ------------------------------------------------------------- DATASETS */
admin.put('/datasets/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM datasets WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const fields = ['title_mk','title_en','description_mk','description_en','format','size_mb','license','year','doi','organism'];
  const merged = { ...existing, ...req.body, id: existing.id };
  db.prepare(`UPDATE datasets SET ${fields.map(f => `${f} = @${f}`).join(', ')} WHERE id = @id`).run(merged);
  res.json(db.prepare('SELECT * FROM datasets WHERE id = ?').get(existing.id));
});

/* ---------------------------------------------------------------- PEOPLE */
const PERSON_FIELDS = ['slug','name_mk','name_en','role_mk','role_en','seniority','group_id','email','orcid','github','bio_mk','bio_en','interests','joined_year','hue'];

admin.post('/people', (req, res) => {
  const b = req.body || {};
  if (!String(b.name_en || '').trim()) return res.status(400).json({ error: 'name_required' });
  const row = Object.fromEntries(PERSON_FIELDS.map(f => [f, b[f] ?? null]));
  row.slug = b.slug ? slugify(b.slug) : slugify(b.name_en);
  row.seniority = b.seniority || 'researcher';
  row.hue = Number(b.hue) || 140;
  row.joined_year = Number(b.joined_year) || new Date().getFullYear();
  try {
    const info = db.prepare(`INSERT INTO people (${PERSON_FIELDS.join(',')}) VALUES (${PERSON_FIELDS.map(f => `@${f}`).join(',')})`).run(row);
    res.status(201).json(db.prepare('SELECT * FROM people WHERE id = ?').get(info.lastInsertRowid));
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) return res.status(409).json({ error: 'slug_taken' });
    throw err;
  }
});

admin.put('/people/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM people WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const merged = { ...existing, ...req.body, id: existing.id };
  db.prepare(`UPDATE people SET ${PERSON_FIELDS.map(f => `${f} = @${f}`).join(', ')} WHERE id = @id`).run(merged);
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
