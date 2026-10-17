import { Router } from 'express';
import { db } from '../db.js';
import { rateLimit, MAX, tooLong } from '../lib/limits.js';

const registrations = rateLimit({ limit: 10, windowMs: 10 * 60_000 });

export const events = Router();

const withCounts = (row) => ({
  ...row,
  rsvp_count: db.prepare('SELECT COUNT(*) n FROM rsvps WHERE event_id = ?').get(row.id).n
});

events.get('/events', (req, res) => {
  const { kind, scope = 'upcoming' } = req.query;
  let sql = 'SELECT * FROM events WHERE 1=1';
  const params = [];
  if (kind) { sql += ' AND kind = ?'; params.push(kind); }
  // Both sides go through datetime() so a stored UTC instant and SQLite's own
  // UTC clock are compared as times, not as strings in two different shapes.
  if (scope === 'upcoming') sql += " AND datetime(starts_at) >= datetime('now')";
  if (scope === 'past') sql += " AND datetime(starts_at) < datetime('now')";
  const dir = scope === 'past' ? 'DESC' : 'ASC';
  res.json(db.prepare(`${sql} ORDER BY starts_at ${dir}`).all(...params).map(withCounts));
});

events.get('/events/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(withCounts(row));
});

events.post('/events/:id/rsvp', registrations, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'not_found' });

  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (name.length < 2 || tooLong(name, MAX.name)) return res.status(400).json({ error: 'invalid_name' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || tooLong(email, MAX.email)) return res.status(400).json({ error: 'invalid_email' });
  if (new Date(event.starts_at) < new Date()) return res.status(409).json({ error: 'event_past' });

  const taken = db.prepare('SELECT COUNT(*) n FROM rsvps WHERE event_id = ?').get(event.id).n;
  if (taken >= event.capacity) return res.status(409).json({ error: 'event_full' });

  try {
    db.prepare('INSERT INTO rsvps (event_id, name, email) VALUES (?,?,?)').run(event.id, name, email);
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) return res.status(409).json({ error: 'already_registered' });
    throw err;
  }
  res.status(201).json({ ok: true, event_id: event.id, remaining: event.capacity - taken - 1 });
});

/** RFC 5545 folds content lines longer than 75 octets onto continuation lines. */
function foldLine(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts = [];
  let start = 0;
  while (start < bytes.length) {
    let end = Math.min(start + (parts.length ? 74 : 75), bytes.length);
    while (end < bytes.length && (bytes[end] & 0xC0) === 0x80) end--;   // never split a UTF-8 character
    parts.push(bytes.subarray(start, end).toString('utf8'));
    start = end;
  }
  return parts.join('\r\n ');
}

/** Calendar export — a real .ics file any calendar app can import. */
events.get('/events/:id/ics', (req, res) => {
  const e = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!e) return res.status(404).json({ error: 'not_found' });
  const lang = req.query.lang === 'mk' ? 'mk' : 'en';
  // A location stored as "Македонски / English" is split to the requested side.
  const location = e.location.includes(' / ') ? e.location.split(' / ')[lang === 'mk' ? 0 : 1] : e.location;
  // Stored values already carry a Z, so stripping separators yields the
  // UTC form iCalendar expects: 20261021T120000Z.
  const stamp = (s) => s.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const escape = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GenomikaLab//Events//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:event-${e.id}@genomika.mk`,
    `DTSTAMP:${stamp(new Date().toISOString().slice(0, 19))}Z`,
    `DTSTART:${stamp(e.starts_at)}`,
    `DTEND:${stamp(e.ends_at)}`,
    `SUMMARY:${escape(e[`title_${lang}`])}`,
    `DESCRIPTION:${escape(e[`description_${lang}`])}`,
    `LOCATION:${escape(location)}`,
    'END:VEVENT', 'END:VCALENDAR'
  ].map(foldLine).join('\r\n') + '\r\n';
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="genomika-event-${e.id}.ics"`);
  res.send(ics);
});
