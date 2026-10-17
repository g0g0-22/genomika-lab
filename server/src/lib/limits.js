/**
 * Per-client rate limiting and input caps for the public, unauthenticated
 * write endpoints — contact, event registration and job applications.
 *
 * In-memory, which is right for a single-process deployment like this one and
 * would need a shared store if the API were ever scaled out.
 */
export function rateLimit({ limit, windowMs }) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now - entry.first > windowMs) hits.set(key, { first: now, count: 1 });
    else if (++entry.count > limit) {
      res.set('Retry-After', String(Math.ceil((entry.first + windowMs - now) / 1000)));
      return res.status(429).json({ error: 'too_many_requests' });
    }
    if (hits.size > 5000) for (const [k, v] of hits) if (now - v.first > windowMs) hits.delete(k);
    next();
  };
}

/** Upper bounds on free-text fields, so one request cannot store megabytes. */
export const MAX = { name: 120, email: 254, subject: 200, text: 4000 };

export const tooLong = (value, max) => String(value ?? '').length > max;
