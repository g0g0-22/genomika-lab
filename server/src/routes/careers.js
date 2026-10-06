import { Router } from 'express';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../db.js';

export const careers = Router();
const UPLOAD_DIR = process.env.UPLOAD_DIR
  || join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads');
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX_CV_BYTES = 4 * 1024 * 1024;
const ALLOWED_CV = ['application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

careers.get('/positions', (req, res) => {
  const open = req.query.open;
  let sql = `SELECT p.*, g.slug AS group_slug, g.name_mk AS group_name_mk, g.name_en AS group_name_en, g.accent
             FROM positions p LEFT JOIN groups g ON g.id = p.group_id WHERE 1=1`;
  if (open === 'true') sql += ' AND p.is_open = 1';
  res.json(db.prepare(`${sql} ORDER BY p.is_open DESC, p.deadline`).all());
});

careers.get('/positions/:slug', (req, res) => {
  const row = db.prepare(`SELECT p.*, g.slug AS group_slug, g.name_mk AS group_name_mk, g.name_en AS group_name_en, g.accent
                          FROM positions p LEFT JOIN groups g ON g.id = p.group_id WHERE p.slug = ?`).get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(row);
});

careers.post('/positions/:slug/apply', (req, res) => {
  const position = db.prepare('SELECT * FROM positions WHERE slug = ?').get(req.params.slug);
  if (!position) return res.status(404).json({ error: 'not_found' });
  if (!position.is_open) return res.status(409).json({ error: 'position_closed' });

  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const motivation = String(req.body?.motivation || '').trim();
  const errors = {};
  if (name.length < 2) errors.name = 'too_short';
  if (!EMAIL_RE.test(email)) errors.email = 'invalid';
  if (motivation.length < 40) errors.motivation = 'too_short';
  if (motivation.length > 4000) errors.motivation = 'too_long';

  const cv = req.body?.cv;
  let cvFilename = null, cvSize = null;
  if (cv?.data) {
    const buffer = Buffer.from(String(cv.data).split(',').pop(), 'base64');
    if (buffer.length > MAX_CV_BYTES) errors.cv = 'too_large';
    else if (cv.type && !ALLOWED_CV.includes(cv.type)) errors.cv = 'unsupported_type';
    else {
      const safe = String(cv.name || 'cv.pdf').replace(/[^\w.\-]+/g, '_').slice(-80);
      cvFilename = `${Date.now()}-${safe}`;
      cvSize = buffer.length;
      mkdirSync(UPLOAD_DIR, { recursive: true });
      writeFileSync(join(UPLOAD_DIR, cvFilename), buffer);
    }
  }

  if (Object.keys(errors).length) return res.status(400).json({ error: 'validation_failed', fields: errors });

  const info = db.prepare(
    'INSERT INTO applications (position_id,name,email,motivation,cv_filename,cv_size) VALUES (?,?,?,?,?,?)'
  ).run(position.id, name, email, motivation, cvFilename, cvSize);

  res.status(201).json({ ok: true, reference: `GL-${String(info.lastInsertRowid).padStart(5, '0')}` });
});

careers.post('/messages', (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const subject = String(req.body?.subject || '').trim();
  const body = String(req.body?.body || '').trim();
  const errors = {};
  if (name.length < 2) errors.name = 'too_short';
  if (!EMAIL_RE.test(email)) errors.email = 'invalid';
  if (subject.length < 3) errors.subject = 'too_short';
  if (body.length < 20) errors.body = 'too_short';
  if (body.length > 4000) errors.body = 'too_long';
  if (Object.keys(errors).length) return res.status(400).json({ error: 'validation_failed', fields: errors });

  const info = db.prepare('INSERT INTO messages (name,email,subject,body) VALUES (?,?,?,?)')
    .run(name, email, subject, body);
  res.status(201).json({ ok: true, reference: `MSG-${String(info.lastInsertRowid).padStart(5, '0')}` });
});
