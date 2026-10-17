import express from 'express';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { authenticate, issueToken, publicUser, readToken, requireAuth,
         throttleKey, tooManyAttempts, recordFailure, clearAttempts } from './lib/auth.js';
import { listedDemoLogins } from './lib/demo.js';
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

  app.disable('x-powered-by');

  /*
   * Exactly one proxy sits in front of this process: the nginx web tier, which
   * replaces X-Forwarded-For with the single client address it has itself
   * established (see client/nginx.conf). Trusting one hop therefore makes
   * req.ip that address. Trusting whole private ranges instead let a client's
   * own X-Forwarded-For through whenever the hop before nginx was private.
   *
   * No CORS middleware: the browser only ever talks to the origin nginx serves,
   * and the Vite dev server proxies /api, so cross-origin access is never needed.
   */
  app.set('trust proxy', 1);

  // Only a CV upload carries a large body; everything else is a few fields.
  const smallJson = express.json({ limit: '100kb' });
  const uploadJson = express.json({ limit: '6mb' });
  app.use((req, res, next) =>
    (/^\/api\/positions\/[^/]+\/apply$/.test(req.path) ? uploadJson : smallJson)(req, res, next));
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

  // The demo logins this deployment chooses to advertise (DEMO_LOGINS); often none.
  app.get('/api/auth/demo', (_req, res) => res.json({ accounts: listedDemoLogins() }));

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
