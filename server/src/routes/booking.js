import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../lib/auth.js';

export const booking = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

booking.get('/instruments', (req, res) => {
  const { category } = req.query;
  let sql = 'SELECT * FROM instruments WHERE 1=1';
  const params = [];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  res.json(db.prepare(`${sql} ORDER BY category, name_en`).all(...params));
});

booking.get('/instruments/:slug', (req, res) => {
  const row = db.prepare('SELECT * FROM instruments WHERE slug = ?').get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(row);
});

/** Occupancy for one instrument on one day, hour by hour. */
booking.get('/instruments/:slug/availability', (req, res) => {
  const instrument = db.prepare('SELECT * FROM instruments WHERE slug = ?').get(req.params.slug);
  if (!instrument) return res.status(404).json({ error: 'not_found' });
  const date = String(req.query.date || '');
  if (!DATE_RE.test(date)) return res.status(400).json({ error: 'invalid_date' });

  const rows = db.prepare(
    `SELECT b.id, b.start_hour, b.end_hour, b.purpose, b.status, b.user_name,
            COALESCE(p.name_mk, b.user_name) AS user_name_mk,
            COALESCE(p.name_en, b.user_name) AS user_name_en
     FROM bookings b
     LEFT JOIN users u ON u.id = b.user_id
     LEFT JOIN people p ON p.id = u.person_id
     WHERE b.instrument_id = ? AND b.date = ? AND b.status != 'cancelled'`
  ).all(instrument.id, date);

  /*
   * Whether an hour is free is public information — you need it to book.
   * Who booked it, and what for, is not: that would tell any visitor which
   * researcher is running which experiment and when. Identity is attached
   * only for signed-in callers.
   */
  const signedIn = Boolean(req.user);
  const slots = [];
  for (let h = instrument.open_from; h < instrument.open_to; h++) {
    const taken = rows.find(b => h >= b.start_hour && h < b.end_hour);
    slots.push({
      hour: h,
      free: !taken,
      booking: taken && signedIn
        ? { id: taken.id, user_name: taken.user_name, user_name_mk: taken.user_name_mk,
            user_name_en: taken.user_name_en, purpose: taken.purpose }
        : null
    });
  }
  res.json({ instrument, date, slots, bookings: signedIn ? rows : [] });
});

booking.get('/bookings/mine', requireAuth, (req, res) => {
  res.json(db.prepare(
    `SELECT b.*, i.slug AS instrument_slug, i.name_mk AS instrument_mk, i.name_en AS instrument_en
     FROM bookings b JOIN instruments i ON i.id = b.instrument_id
     WHERE b.user_id = ? OR b.user_email = ? ORDER BY b.date DESC, b.start_hour DESC`
  ).all(req.user.id, req.user.email));
});

booking.post('/bookings', requireAuth, (req, res) => {
  const { instrument_slug, date, start_hour, end_hour, purpose } = req.body || {};
  const instrument = db.prepare('SELECT * FROM instruments WHERE slug = ?').get(String(instrument_slug || ''));
  if (!instrument) return res.status(404).json({ error: 'unknown_instrument' });
  if (instrument.status !== 'available') return res.status(409).json({ error: 'instrument_unavailable' });
  if (!DATE_RE.test(String(date || ''))) return res.status(400).json({ error: 'invalid_date' });

  const s = Number(start_hour), e = Number(end_hour);
  if (!Number.isInteger(s) || !Number.isInteger(e) || e <= s) return res.status(400).json({ error: 'invalid_range' });
  if (s < instrument.open_from || e > instrument.open_to) return res.status(400).json({ error: 'outside_opening_hours' });
  if (e - s > instrument.max_hours) return res.status(400).json({ error: 'exceeds_max_hours', max_hours: instrument.max_hours });

  const today = new Date().toISOString().slice(0, 10);
  if (date < today) return res.status(400).json({ error: 'date_in_past' });

  // Overlap test: two intervals collide unless one ends before the other begins.
  const clash = db.prepare(
    `SELECT id, user_name, start_hour, end_hour FROM bookings
     WHERE instrument_id = ? AND date = ? AND status != 'cancelled' AND start_hour < ? AND end_hour > ?`
  ).get(instrument.id, date, e, s);
  if (clash) return res.status(409).json({ error: 'slot_taken', clash });

  // The account is linked to a person whose name is already known in both
  // languages; reconstructing one from the email address produced names like
  // "n avramovski". The address is only a fallback for unlinked accounts.
  const person = req.user.person_id
    ? db.prepare('SELECT name_en FROM people WHERE id = ?').get(req.user.person_id)
    : null;
  const displayName = person?.name_en || req.user.email.split('@')[0];

  const info = db.prepare(
    `INSERT INTO bookings (instrument_id,user_id,user_name,user_email,date,start_hour,end_hour,purpose,status)
     VALUES (?,?,?,?,?,?,?,?,'confirmed')`
  ).run(
    instrument.id, req.user.id, displayName,
    req.user.email, date, s, e, String(purpose || '').slice(0, 300)
  );

  res.status(201).json({
    ok: true,
    booking: db.prepare('SELECT * FROM bookings WHERE id = ?').get(info.lastInsertRowid),
    cost_eur: (e - s) * instrument.hourly_rate
  });
});

booking.delete('/bookings/:id', requireAuth, (req, res) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'not_found' });
  const owns = b.user_id === req.user.id || b.user_email === req.user.email;
  if (!owns && req.user.role !== 'admin') return res.status(403).json({ error: 'not_your_booking' });
  db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(b.id);
  res.json({ ok: true });
});
