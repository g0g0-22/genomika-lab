import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../db.js';
import { rateLimit, MAX, tooLong } from '../lib/limits.js';
import { localDate } from '../lib/dates.js';

// Public writes: a handful per client every ten minutes is ample for a person.
const publicWrites = rateLimit({ limit: 10, windowMs: 10 * 60_000 });

export const careers = Router();
const UPLOAD_DIR = process.env.UPLOAD_DIR
  || join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads');
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX_CV_BYTES = 4 * 1024 * 1024;
/*
 * The accepted formats. A file must agree with itself on all three counts:
 * its extension picks the format, its declared type must be that format's,
 * and its bytes must look like that format. A leading-bytes check alone
 * accepted page.html starting with %PDF, and any zip renamed to .docx.
 *
 * This is still not a parser — a well-formed document can carry a macro — so
 * the file is also stored under a random name with the extension we chose,
 * and only ever handed back as a download.
 */
const startsWith = (buffer, bytes) => bytes.every((byte, i) => buffer[i] === byte);
const CV_FORMATS = {
  pdf: {
    type: 'application/pdf',
    looksRight: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-'
  },
  docx: {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    // A zip whose directory names the Word main part.
    looksRight: (b) => startsWith(b, [0x50, 0x4B, 0x03, 0x04]) && b.includes('word/document.xml')
  },
  doc: {
    type: 'application/msword',
    looksRight: (b) => startsWith(b, [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])  // OLE2 container
  }
};

/** The name the applicant gave, reduced to something safe to show and to offer as a filename. */
const displayName = (name) =>
  String(name || 'cv').split(/[\\/]/).pop().replace(/[^\p{L}\p{N}._ -]+/gu, '_').slice(-120) || 'cv';

careers.get('/positions', (req, res) => {
  const open = req.query.open;
  let sql = `SELECT p.*, g.slug AS group_slug, g.name_mk AS group_name_mk, g.name_en AS group_name_en, g.accent
             FROM positions p LEFT JOIN groups g ON g.id = p.group_id WHERE 1=1`;
  const today = localDate();
  const rows = db.prepare(`${sql} ORDER BY p.is_open DESC, p.deadline`).all()
    .map(p => ({ ...p, is_open: p.is_open && p.deadline >= today ? 1 : 0 }));
  res.json(open === 'true' ? rows.filter(p => p.is_open) : rows);
});

careers.post('/positions/:slug/apply', publicWrites, (req, res) => {
  const position = db.prepare('SELECT * FROM positions WHERE slug = ?').get(req.params.slug);
  if (!position) return res.status(404).json({ error: 'not_found' });
  // A deadline in the past closes a position even if nobody flipped the flag.
  const today = localDate();
  if (!position.is_open || position.deadline < today) return res.status(409).json({ error: 'position_closed' });

  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const motivation = String(req.body?.motivation || '').trim();
  const errors = {};
  if (name.length < 2) errors.name = 'too_short';
  else if (tooLong(name, MAX.name)) errors.name = 'too_long';
  if (!EMAIL_RE.test(email) || tooLong(email, MAX.email)) errors.email = 'invalid';
  if (motivation.length < 40) errors.motivation = 'too_short';
  if (motivation.length > 4000) errors.motivation = 'too_long';

  /*
   * Nothing reaches the disk until every check has passed. Writing first and
   * validating afterwards let an unauthenticated caller leave orphaned files
   * on the volume by failing a different field on purpose.
   *
   * The declared type and the name are attacker-supplied, so neither is
   * trusted on its own: see CV_FORMATS.
   */
  const cv = req.body?.cv;
  let cvFilename = null, cvOriginal = null, cvSize = null, cvBuffer = null;

  if (cv?.data) {
    let buffer;
    try {
      buffer = Buffer.from(String(cv.data).split(',').pop(), 'base64');
    } catch {
      buffer = Buffer.alloc(0);
    }

    const extension = String(cv.name || '').toLowerCase().match(/\.([a-z]+)$/)?.[1];
    const format = Object.hasOwn(CV_FORMATS, extension ?? '') ? CV_FORMATS[extension] : null;

    if (buffer.length === 0) errors.cv = 'unreadable';
    else if (buffer.length > MAX_CV_BYTES) errors.cv = 'too_large';
    else if (!format || cv.type !== format.type || !format.looksRight(buffer)) errors.cv = 'unsupported_type';
    else {
      cvFilename = `${randomUUID()}.${extension}`;
      cvOriginal = displayName(cv.name);
      cvSize = buffer.length;
      cvBuffer = buffer;
    }
  }

  if (Object.keys(errors).length) return res.status(400).json({ error: 'validation_failed', fields: errors });

  if (cvBuffer) {
    mkdirSync(UPLOAD_DIR, { recursive: true });
    writeFileSync(join(UPLOAD_DIR, cvFilename), cvBuffer);
  }

  const info = db.prepare(
    'INSERT INTO applications (position_id,name,email,motivation,cv_filename,cv_original_name,cv_size) VALUES (?,?,?,?,?,?,?)'
  ).run(position.id, name, email, motivation, cvFilename, cvOriginal, cvSize);

  res.status(201).json({ ok: true, reference: `GL-${String(info.lastInsertRowid).padStart(5, '0')}` });
});

careers.post('/messages', publicWrites, (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const subject = String(req.body?.subject || '').trim();
  const body = String(req.body?.body || '').trim();
  const errors = {};
  if (name.length < 2) errors.name = 'too_short';
  else if (tooLong(name, MAX.name)) errors.name = 'too_long';
  if (!EMAIL_RE.test(email) || tooLong(email, MAX.email)) errors.email = 'invalid';
  if (subject.length < 3) errors.subject = 'too_short';
  else if (tooLong(subject, MAX.subject)) errors.subject = 'too_long';
  if (body.length < 20) errors.body = 'too_short';
  if (body.length > 4000) errors.body = 'too_long';
  if (Object.keys(errors).length) return res.status(400).json({ error: 'validation_failed', fields: errors });

  const info = db.prepare('INSERT INTO messages (name,email,subject,body) VALUES (?,?,?,?)')
    .run(name, email, subject, body);
  res.status(201).json({ ok: true, reference: `MSG-${String(info.lastInsertRowid).padStart(5, '0')}` });
});
