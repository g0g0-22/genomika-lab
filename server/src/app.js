import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { authenticate, issueToken, publicUser, readToken, requireAuth,
         throttleKey, tooManyAttempts, recordFailure, clearAttempts } from './lib/auth.js';
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

  /*
   * nginx and the platform's ingress sit in front of this process. Trusting the
   * private-network hops lets req.ip resolve to the real client: Express reads
   * X-Forwarded-For from the right and stops at the first address that is not
   * a trusted proxy, so a value a client forges on the left is never reached.
   */
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  app.use(cors());
  app.use(express.json({ limit: '6mb' }));
  app.use(readToken);

  // A repeated query key (?group=a&group=b) arrives as an array, which every
  // handler here would pass straight into SQL and fail on. Keep the first.
  app.use((req, _res, next) => {
    for (const [key, value] of Object.entries(req.query)) {
      if (Array.isArray(value)) req.query[key] = value[0];
      else if (value !== null && typeof value === 'object') delete req.query[key];
    }
    next();
  });

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
    const key = throttleKey(req);
    if (tooManyAttempts(key)) return res.status(429).json({ error: 'too_many_attempts' });

    const user = authenticate(req.body?.email, req.body?.password);
    if (!user) {
      recordFailure(key);
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    clearAttempts(key);
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
    // Client errors raised by middleware — malformed JSON, an oversized body —
    // carry their own status. Reporting those as 500 blamed the server for a
    // bad request.
    const status = err.status || err.statusCode;
    if (status >= 400 && status < 500) {
      const error = err.type === 'entity.too.large' ? 'payload_too_large'
        : err.type === 'entity.parse.failed' ? 'malformed_json'
        : 'bad_request';
      return res.status(status).json({ error });
    }
    // Logged in full server-side; the client is told only that it failed.
    if (!quiet) console.error(err);
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
