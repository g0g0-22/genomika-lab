import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { authenticate, issueToken, publicUser, readToken, requireAuth } from './lib/auth.js';
import { content } from './routes/content.js';
import { events } from './routes/events.js';
import { booking } from './routes/booking.js';
import { careers } from './routes/careers.js';
import { admin } from './routes/admin.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Builds the application without binding a port, so the test suite can drive
 * the real middleware stack — auth, validation, error handling and all — in
 * process rather than against a server it has to spawn.
 */
export function createApp({ quiet = false } = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '6mb' }));
  app.use(readToken);

  /* Small request log — helpful when demonstrating the system live. */
  if (!quiet) {
    app.use((req, _res, next) => {
      if (req.path.startsWith('/api')) console.log(`${req.method} ${req.path}`);
      next();
    });
  }

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

  /*
   * Local convenience only. In Docker the nginx web tier serves the client and
   * this directory does not exist inside the api image, so the block is skipped.
   * It keeps `npm start` serving the whole site from one process for anyone
   * running the project without containers.
   */
  const clientDist = join(__dirname, '..', '..', 'client', 'dist');
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(join(clientDist, 'index.html')));
  }

  app.use('/api', (_req, res) => res.status(404).json({ error: 'unknown_endpoint' }));

  app.use((err, _req, res, _next) => {
    if (!quiet) console.error(err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  });

  return app;
}
