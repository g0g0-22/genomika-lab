import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';

/*
 * There is deliberately no usable default. A signing secret that ships in the
 * repository is not a secret: anyone holding the source could mint an admin
 * token. Outside development the process refuses to start without one.
 */
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('FATAL: JWT_SECRET is not set. Refusing to start with an unsigned-equivalent secret.');
  process.exit(1);
}
// In development a missing secret becomes a random one for this process only:
// tokens stop working on restart, which is harmless, and nothing guessable ships.
export const JWT_SECRET = process.env.JWT_SECRET || randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) console.warn('JWT_SECRET not set: using a random per-process secret (development only).');
const TOKEN_TTL = '8h';

/*
 * Failed sign-ins are throttled per client address. bcryptjs compares
 * synchronously, so an unthrottled endpoint is both a guessing surface and a
 * way to occupy the event loop.
 *
 * The key is the client alone, never the account. Keying on the account let
 * anyone lock any user out by failing their address eight times; keyed on the
 * client, an attacker can only ever throttle themselves. This depends on
 * `trust proxy` being set in app.js — behind nginx, req.ip is otherwise the
 * proxy's own address and every visitor would share one counter.
 */
const ATTEMPT_LIMIT = 8;
const ATTEMPT_WINDOW_MS = 60_000;
const attempts = new Map();

export function throttleKey(req) {
  return req.ip ?? 'unknown';
}

export function tooManyAttempts(key) {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > ATTEMPT_WINDOW_MS) { attempts.delete(key); return false; }
  return entry.count >= ATTEMPT_LIMIT;
}

export function recordFailure(key) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.first > ATTEMPT_WINDOW_MS) attempts.set(key, { first: now, count: 1 });
  else entry.count++;

  // The map is bounded so a stream of distinct addresses cannot grow it forever.
  if (attempts.size > 5000) {
    for (const [k, v] of attempts) if (now - v.first > ATTEMPT_WINDOW_MS) attempts.delete(k);
  }
}

export const clearAttempts = (key) => attempts.delete(key);

/*
 * An unknown address still costs one bcrypt comparison, against a hash of the
 * same cost as the real ones. Returning early made a wrong address answer
 * measurably faster than a wrong password, which told a caller which
 * addresses have accounts.
 */
const DECOY_HASH = bcrypt.hashSync(randomBytes(16).toString('hex'), 10);

export function authenticate(email, password) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').toLowerCase().trim());
  const matches = bcrypt.compareSync(String(password || ''), user?.password_hash ?? DECOY_HASH);
  return user && matches ? user : null;
}

export function issueToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function publicUser(user) {
  const person = user.person_id
    ? db.prepare('SELECT id, slug, name_mk, name_en, role_mk, role_en FROM people WHERE id = ?').get(user.person_id)
    : null;
  return { id: user.id, email: user.email, role: user.role, person };
}

/** Attaches req.user when a valid bearer token is present. Never rejects. */
export function readToken(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
      if (user) req.user = user;
    } catch { /* expired or forged token — treated as anonymous */ }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'authentication_required' });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'authentication_required' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'admin_only' });
  next();
}
