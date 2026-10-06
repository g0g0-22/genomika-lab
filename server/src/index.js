import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { db, migrate } from './db.js';
import { authenticate, issueToken, publicUser, readToken, requireAuth } from './lib/auth.js';
import { content } from './routes/content.js';
import { events } from './routes/events.js';
import { booking } from './routes/booking.js';
import { careers } from './routes/careers.js';
import { admin } from './routes/admin.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4000;

migrate();

/*
 * A fresh deployment starts with no database file at all — the repository does
 * not carry one. Seed it on first boot so the stack comes up populated, and
 * never touch it again once it holds data.
 */
if (db.prepare('SELECT COUNT(*) n FROM groups').get().n === 0) {
  if (process.env.AUTO_SEED === 'false') {
    console.warn('\n  Database is empty and AUTO_SEED=false. Run:  npm run seed\n');
  } else {
    console.log('Empty database detected — seeding demonstration content…');
    await import('./seed.js');
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '6mb' }));
app.use(readToken);

/* Small request log — helpful when demonstrating the system live. */
app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) console.log(`${req.method} ${req.path}`);
  next();
});

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'genomika-lab', time: new Date().toISOString() }));

/* ------------------------------------------------------------------ AUTH */
app.post('/api/auth/login', (req, res) => {
  const user = authenticate(req.body?.email, req.body?.password);
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });
  res.json({ token: issueToken(user), user: publicUser(user) });
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

/* ---------------------------------------------------------------- ROUTES */
app.use('/api', content);
app.use('/api', events);
app.use('/api', booking);
app.use('/api', careers);
app.use('/api/admin', admin);

/* Serve the built client when it exists, so one process serves the whole site. */
const clientDist = join(__dirname, '..', '..', 'client', 'dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(join(clientDist, 'index.html')));
}

app.use('/api', (_req, res) => res.status(404).json({ error: 'unknown_endpoint' }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`GenomikaLab API  →  http://localhost:${PORT}/api/health`);
});
