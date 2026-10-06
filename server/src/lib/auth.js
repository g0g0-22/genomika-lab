import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';

const DEV_SECRET = 'genomika-lab-dev-secret-change-me';
export const JWT_SECRET = process.env.JWT_SECRET || DEV_SECRET;

if (JWT_SECRET === DEV_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('WARNING: JWT_SECRET is unset — tokens are signed with the public development secret.');
}
const TOKEN_TTL = '8h';

export function authenticate(email, password) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').toLowerCase().trim());
  if (!user) return null;
  if (!bcrypt.compareSync(String(password || ''), user.password_hash)) return null;
  return user;
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
