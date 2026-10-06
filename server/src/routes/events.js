import { Router } from 'express';
import { db } from '../db.js';

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
  if (scope === 'upcoming') sql += " AND starts_at >= datetime('now')";
  if (scope === 'past') sql += " AND starts_at < datetime('now')";
  const dir = scope === 'past' ? 'DESC' : 'ASC';
  res.json(db.prepare(`${sql} ORDER BY starts_at ${dir}`).all(...params).map(withCounts));
});

events.get('/events/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(withCounts(row));
});

events.post('/events/:id/rsvp', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'not_found' });

  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (name.length < 2) return res.status(400).json({ error: 'invalid_name' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'invalid_email' });

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

/** Calendar export — a real .ics file any calendar app can import. */
events.get('/events/:id/ics', (req, res) => {
  const e = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!e) return res.status(404).json({ error: 'not_found' });
  const stamp = (s) => s.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const escape = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GenomikaLab//Events//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:event-${e.id}@genomika.mk`,
    `DTSTAMP:${stamp(new Date().toISOString().slice(0, 19))}Z`,
    `DTSTART:${stamp(e.starts_at)}`,
    `DTEND:${stamp(e.ends_at)}`,
    `SUMMARY:${escape(e.title_en)}`,
    `DESCRIPTION:${escape(e.description_en)}`,
    `LOCATION:${escape(e.location)}`,
    'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n');
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="genomika-event-${e.id}.ics"`);
  res.send(ics);
});
