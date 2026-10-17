/**
 * Integration tests for the HTTP API.
 *
 *   npm test            (from server/)
 *
 * These drive the real middleware stack — authentication, authorisation,
 * validation, the error handler — against a throwaway database seeded with the
 * same content a deployment gets. Nothing is mocked: a test that passes here
 * describes what the deployed server actually does.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const workdir = mkdtempSync(join(tmpdir(), 'genomika-test-'));
process.env.DB_PATH = join(workdir, 'test.db');
process.env.UPLOAD_DIR = join(workdir, 'uploads');
process.env.JWT_SECRET = 'test-only-secret';
process.env.NODE_ENV = 'test';

const { migrate } = await import('../src/db.js');
migrate();
await import('../src/seed.js');
const { createApp } = await import('../src/app.js');

let server, base;

before(async () => {
  server = createApp({ quiet: true }).listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => {
  server?.close();
  rmSync(workdir, { recursive: true, force: true });
});

/* ------------------------------------------------------------- helpers -- */

/*
 * Per-client limits key on the caller's address, and every request here comes
 * from loopback. Each call therefore presents its own address from the range
 * reserved for benchmarking (RFC 2544), so a limit trips only in the tests
 * that pin an address on purpose.
 */
let nextClient = 0;
const freshClient = () => `198.18.${(++nextClient >> 8) & 255}.${nextClient & 255}`;

const call = (path, { token, method = 'GET', body, ip = freshClient(), raw } = {}) =>
  fetch(base + path, {
    method,
    headers: {
      ...(body !== undefined || raw ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Forwarded-For': ip
    },
    ...(raw !== undefined ? { body: raw } : body !== undefined ? { body: JSON.stringify(body) } : {})
  });

const json = async (...args) => {
  const res = await call(...args);
  return { status: res.status, body: await res.json().catch(() => null) };
};

const signIn = async (email, password = 'genomika2026') => {
  const { body } = await json('/auth/login', { method: 'POST', body: { email, password } });
  return body.token;
};

const { db } = await import('../src/db.js');
const jwt = (await import('jsonwebtoken')).default;

const dayFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/* ---------------------------------------------------------------- AUTH -- */

test('login succeeds with correct credentials and returns a usable token', async () => {
  const { status, body } = await json('/auth/login', {
    method: 'POST', body: { email: 'admin@genomika.mk', password: 'genomika2026' }
  });
  assert.equal(status, 200);
  assert.ok(body.token);
  assert.equal(body.user.role, 'admin');
  assert.equal(body.user.person.slug, 'ana-trajkovska');

  const me = await json('/auth/me', { token: body.token });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, 'admin@genomika.mk');
});

test('login rejects a wrong password and an unknown address identically', async () => {
  const wrong = await json('/auth/login', { method: 'POST', body: { email: 'admin@genomika.mk', password: 'nope' } });
  const absent = await json('/auth/login', { method: 'POST', body: { email: 'nobody@example.mk', password: 'nope' } });
  assert.equal(wrong.status, 401);
  assert.equal(absent.status, 401);
  assert.deepEqual(wrong.body, absent.body);   // no account enumeration
});

test('a forged or absent token is treated as anonymous, not trusted', async () => {
  assert.equal((await json('/auth/me')).status, 401);
  assert.equal((await json('/auth/me', { token: 'not.a.jwt' })).status, 401);
  const forged = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJhZG1pbiJ9.x';
  assert.equal((await json('/auth/me', { token: forged })).status, 401);
});

/* ------------------------------------------------------- AUTHORISATION -- */

test('the admin API is closed to anonymous and to non-admin accounts', async () => {
  assert.equal((await json('/admin/overview')).status, 401);

  const researcher = await signIn('n.avramovski@genomika.mk');
  assert.equal((await json('/admin/overview', { token: researcher })).status, 403);

  const admin = await signIn('admin@genomika.mk');
  assert.equal((await json('/admin/overview', { token: admin })).status, 200);
});

test('role comes from the database, so a token claiming admin does not grant it', async () => {
  // A correctly signed token for a researcher's account that asserts role: admin.
  const researcher = db.prepare("SELECT id, email FROM users WHERE role = 'researcher' LIMIT 1").get();
  const forged = jwt.sign({ sub: researcher.id, email: researcher.email, role: 'admin' }, process.env.JWT_SECRET);
  assert.equal((await json('/admin/overview', { token: forged })).status, 403);
  assert.equal((await json('/auth/me', { token: forged })).body.user.role, 'researcher');
});

/* ------------------------------------------------------------- BOOKING -- */

test('booking requires authentication', async () => {
  const { status } = await json('/bookings', {
    method: 'POST',
    body: { instrument_slug: 'qpcr-station', date: dayFromNow(5), start_hour: 9, end_hour: 10 }
  });
  assert.equal(status, 401);
});

test('a booking is created, and an overlapping one is refused with the clash', async () => {
  const token = await signIn('n.avramovski@genomika.mk');
  const date = dayFromNow(9);

  const first = await json('/bookings', {
    token, method: 'POST',
    body: { instrument_slug: 'qpcr-station', date, start_hour: 9, end_hour: 12, purpose: 'first' }
  });
  assert.equal(first.status, 201);
  assert.equal(first.body.cost_eur, 36);          // 3 hours x 12 EUR

  for (const [start, end, label] of [[11, 13, 'overlaps the tail'],
                                     [8, 10, 'overlaps the head'],
                                     [10, 11, 'falls wholly inside'],
                                     [8, 12, 'wholly contains it']]) {
    const clash = await json('/bookings', {
      token, method: 'POST', body: { instrument_slug: 'qpcr-station', date, start_hour: start, end_hour: end }
    });
    assert.equal(clash.status, 409, label);
    assert.equal(clash.body.error, 'slot_taken');
    assert.ok(clash.body.clash, 'the conflicting booking is reported back');
  }

  // Abutting slots are not overlaps.
  const after = await json('/bookings', {
    token, method: 'POST', body: { instrument_slug: 'qpcr-station', date, start_hour: 12, end_hour: 14 }
  });
  assert.equal(after.status, 201, 'a booking starting exactly when another ends is allowed');
});

test('booking rejects durations, hours and dates outside the instrument rules', async () => {
  const token = await signIn('n.avramovski@genomika.mk');

  const tooLong = await json('/bookings', {
    token, method: 'POST',
    body: { instrument_slug: 'qpcr-station', date: dayFromNow(11), start_hour: 8, end_hour: 16 }
  });
  assert.equal(tooLong.status, 400);
  assert.equal(tooLong.body.error, 'exceeds_max_hours');

  const tooEarly = await json('/bookings', {
    token, method: 'POST',
    body: { instrument_slug: 'qpcr-station', date: dayFromNow(11), start_hour: 5, end_hour: 7 }
  });
  assert.equal(tooEarly.status, 400);
  assert.equal(tooEarly.body.error, 'outside_opening_hours');

  const backwards = await json('/bookings', {
    token, method: 'POST',
    body: { instrument_slug: 'qpcr-station', date: dayFromNow(11), start_hour: 14, end_hour: 11 }
  });
  assert.equal(backwards.status, 400);
  assert.equal(backwards.body.error, 'invalid_range');

  const past = await json('/bookings', {
    token, method: 'POST',
    body: { instrument_slug: 'qpcr-station', date: dayFromNow(-3), start_hour: 9, end_hour: 10 }
  });
  assert.equal(past.status, 400);
  assert.equal(past.body.error, 'date_in_past');
});

test('an instrument under maintenance cannot be booked', async () => {
  const token = await signIn('n.avramovski@genomika.mk');
  const { status, body } = await json('/bookings', {
    token, method: 'POST',
    body: { instrument_slug: 'bioanalyzer', date: dayFromNow(12), start_hour: 9, end_hour: 10 }
  });
  assert.equal(status, 409);
  assert.equal(body.error, 'instrument_unavailable');
});

test('a booking can be cancelled by its owner and by nobody else', async () => {
  const owner = await signIn('n.avramovski@genomika.mk');
  const other = await signIn('s.jovanoska@genomika.mk');
  const date = dayFromNow(14);

  const made = await json('/bookings', {
    token: owner, method: 'POST',
    body: { instrument_slug: 'qpcr-station', date, start_hour: 9, end_hour: 11, purpose: 'ownership' }
  });
  const id = made.body.booking.id;

  assert.equal((await json(`/bookings/${id}`, { token: other, method: 'DELETE' })).status, 403);
  assert.equal((await json(`/bookings/${id}`, { method: 'DELETE' })).status, 401);
  assert.equal((await json(`/bookings/${id}`, { token: owner, method: 'DELETE' })).status, 200);

  // The slot is free again once cancelled.
  const reuse = await json('/bookings', {
    token: other, method: 'POST', body: { instrument_slug: 'qpcr-station', date, start_hour: 9, end_hour: 11 }
  });
  assert.equal(reuse.status, 201);
});

test('availability discloses occupancy to anyone but identity only to signed-in callers', async () => {
  const token = await signIn('n.avramovski@genomika.mk');
  const date = dayFromNow(16);
  await json('/bookings', {
    token, method: 'POST',
    body: { instrument_slug: 'qpcr-station', date, start_hour: 10, end_hour: 12, purpose: 'confidential' }
  });

  const anon = await json(`/instruments/qpcr-station/availability?date=${date}`);
  assert.equal(anon.status, 200);
  const takenAnon = anon.body.slots.find(s => s.hour === 10);
  assert.equal(takenAnon.free, false, 'occupancy is public — it has to be, to book');
  assert.equal(takenAnon.booking, null, 'but the booker is not named');
  assert.deepEqual(anon.body.bookings, [], 'and the raw rows are withheld');
  assert.ok(!JSON.stringify(anon.body).includes('confidential'));
  assert.ok(!JSON.stringify(anon.body).includes('@genomika.mk'));

  const authed = await json(`/instruments/qpcr-station/availability?date=${date}`, { token });
  assert.ok(authed.body.slots.find(s => s.hour === 10).booking.user_name);
});

test('a booking carries the booker\'s real name in both languages', async () => {
  const token = await signIn('n.avramovski@genomika.mk');
  const date = dayFromNow(18);
  await json('/bookings', { token, method: 'POST',
    body: { instrument_slug: 'hpc-cluster', date, start_hour: 9, end_hour: 10, purpose: 'name check' } });
  const slot = (await json(`/instruments/hpc-cluster/availability?date=${date}`, { token })).body.slots.find(s => s.hour === 9);
  // Previously reconstructed from the address: "n avramovski".
  assert.equal(slot.booking.user_name_en, 'Nikola Avramovski');
  assert.equal(slot.booking.user_name_mk, 'Никола Аврамовски');
});

test('the unauthenticated week endpoint is gone', async () => {
  const { status } = await json(`/bookings/week?from=${dayFromNow(0)}`);
  assert.equal(status, 404);
});

/* ---------------------------------------------------------------- RSVP -- */

test('an event refuses registrations once it is full', async () => {
  const id = (await json('/events?scope=upcoming')).body.at(-1).id;
  db.prepare('UPDATE events SET capacity = 2 WHERE id = ?').run(id);
  for (const n of [1, 2]) {
    assert.equal((await json(`/events/${id}/rsvp`, { method: 'POST', body: { name: `Guest ${n}`, email: `cap${n}@example.mk` } })).status, 201);
  }
  const third = await json(`/events/${id}/rsvp`, { method: 'POST', body: { name: 'Guest 3', email: 'cap3@example.mk' } });
  assert.equal(third.status, 409);
  assert.equal(third.body.error, 'event_full');
});

test('event registration validates and deduplicates', async () => {
  const events = (await json('/events?scope=upcoming')).body;
  assert.ok(events.length > 0);
  const id = events[0].id;

  assert.equal((await json(`/events/${id}/rsvp`, {
    method: 'POST', body: { name: 'Marija Ilieva', email: 'marija@example.mk' } })).status, 201);

  const duplicate = await json(`/events/${id}/rsvp`, {
    method: 'POST', body: { name: 'Marija Ilieva', email: 'marija@example.mk' } });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error, 'already_registered');

  assert.equal((await json(`/events/${id}/rsvp`, {
    method: 'POST', body: { name: 'Valid Name', email: 'not-an-email' } })).body.error, 'invalid_email');
  assert.equal((await json(`/events/${id}/rsvp`, {
    method: 'POST', body: { name: 'A', email: 'a@b.mk' } })).body.error, 'invalid_name');
});

test('upcoming and past partition the events, with no event in both', async () => {
  const upcoming = (await json('/events?scope=upcoming')).body;
  const past = (await json('/events?scope=past')).body;
  const all = (await json('/events?scope=all')).body;

  assert.equal(upcoming.length + past.length, all.length);
  assert.ok(past.length >= 1, 'there is at least one past event to partition');
  assert.ok(upcoming.length >= 1);
  const overlap = upcoming.filter(u => past.some(p => p.id === u.id));
  assert.deepEqual(overlap, [], 'an event cannot be both upcoming and past');

  const now = Date.now();
  upcoming.forEach(e => assert.ok(new Date(e.starts_at).getTime() >= now - 60_000, `${e.title_en} is genuinely ahead`));
  past.forEach(e => assert.ok(new Date(e.starts_at).getTime() < now + 60_000));
});

test('an event that has already happened takes no registrations', async () => {
  const [held] = (await json('/events?scope=past')).body;
  const res = await json(`/events/${held.id}/rsvp`, { method: 'POST', body: { name: 'Late Guest', email: 'late@example.mk' } });
  assert.equal(res.status, 409);
  assert.equal(res.body.error, 'event_past');
});

test('the calendar export is valid iCalendar in UTC', async () => {
  const id = (await json('/events?scope=upcoming')).body[0].id;
  const res = await call(`/events/${id}/ics`);
  const text = await res.text();
  assert.match(res.headers.get('content-type'), /text\/calendar/);
  assert.match(text, /^BEGIN:VCALENDAR/);
  assert.match(text, /END:VCALENDAR\s*$/);
  assert.match(text, /DTSTART:\d{8}T\d{6}Z/, 'DTSTART carries an explicit UTC marker');
  assert.match(text, /DTEND:\d{8}T\d{6}Z/);
});

/* --------------------------------------------------------- APPLICATIONS -- */

test('an application is accepted and returns a reference', async () => {
  const { status, body } = await json('/positions/phd-pangenome/apply', {
    method: 'POST',
    body: { name: 'Ana Nikolova', email: 'ana@example.mk',
            motivation: 'I have been writing alignment code since my second year and want to work on graph pangenomes.' }
  });
  assert.equal(status, 201);
  assert.match(body.reference, /^GL-\d{5}$/);
});

test('application validation reports every offending field at once', async () => {
  const { status, body } = await json('/positions/phd-pangenome/apply', {
    method: 'POST', body: { name: 'X', email: 'bad', motivation: 'short' }
  });
  assert.equal(status, 400);
  assert.equal(body.error, 'validation_failed');
  assert.deepEqual(Object.keys(body.fields).sort(), ['email', 'motivation', 'name']);
});

test('a closed position accepts nothing', async () => {
  const { status, body } = await json('/positions/postdoc-structure/apply', {
    method: 'POST',
    body: { name: 'Ana Nikolova', email: 'ana@example.mk',
            motivation: 'A motivation letter comfortably past the minimum length requirement.' }
  });
  assert.equal(status, 409);
  assert.equal(body.error, 'position_closed');
});

test('a rejected upload leaves nothing on disk', async () => {
  const before = existsSync(process.env.UPLOAD_DIR) ? readdirSync(process.env.UPLOAD_DIR).length : 0;

  // Valid 1 MB PDF, but the motivation is too short: the whole request must fail
  // without the file ever being written.
  const payload = Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.alloc(1024 * 1024)]).toString('base64');
  const rejected = await json('/positions/phd-pangenome/apply', {
    method: 'POST',
    body: { name: 'Ana', email: 'ana@example.mk', motivation: 'too short',
            cv: { name: 'cv.pdf', type: 'application/pdf', size: 1048584, data: `data:application/pdf;base64,${payload}` } }
  });
  assert.equal(rejected.status, 400);

  const after = existsSync(process.env.UPLOAD_DIR) ? readdirSync(process.env.UPLOAD_DIR).length : 0;
  assert.equal(after, before, 'a failed application must not leave an orphaned file behind');
});

test('an upload is rejected when its bytes do not match its declared type', async () => {
  const notAPdf = Buffer.from('<script>this is not a document</script>').toString('base64');
  const { status, body } = await json('/positions/phd-pangenome/apply', {
    method: 'POST',
    body: { name: 'Ana Nikolova', email: 'ana@example.mk',
            motivation: 'A motivation letter comfortably past the minimum length requirement.',
            cv: { name: 'cv.pdf', type: 'application/pdf', size: 40, data: `data:application/pdf;base64,${notAPdf}` } }
  });
  assert.equal(status, 400);
  assert.equal(body.fields.cv, 'unsupported_type');
});

test('omitting the declared type does not skip the type check', async () => {
  const notAPdf = Buffer.from('plain text pretending to be a CV').toString('base64');
  const { status, body } = await json('/positions/phd-pangenome/apply', {
    method: 'POST',
    body: { name: 'Ana Nikolova', email: 'ana@example.mk',
            motivation: 'A motivation letter comfortably past the minimum length requirement.',
            cv: { name: 'cv.pdf', data: `data:application/octet-stream;base64,${notAPdf}` } }
  });
  assert.equal(status, 400);
  assert.equal(body.fields.cv, 'unsupported_type');
});

test('an accepted upload is written exactly once', async () => {
  const pdf = Buffer.concat([Buffer.from('%PDF-1.4 '), Buffer.from('a real enough document')]).toString('base64');
  const { status } = await json('/positions/intern-summer/apply', {
    method: 'POST',
    body: { name: 'Bojan Petrov', email: 'bojan@example.mk',
            motivation: 'A motivation letter comfortably past the minimum length requirement.',
            cv: { name: 'cv.pdf', type: 'application/pdf', size: 32, data: `data:application/pdf;base64,${pdf}` } }
  });
  assert.equal(status, 201);
  const files = readdirSync(process.env.UPLOAD_DIR);
  assert.equal(files.length, 1);
  assert.match(files[0], /-cv\.pdf$/);
});

test('failed sign-ins throttle the client that made them, and nobody else', async () => {
  const attacker = '203.0.113.7';
  let throttledAt = null;
  for (let i = 1; i <= 12 && !throttledAt; i++) {
    const { status } = await json('/auth/login', { ip: attacker, method: 'POST', body: { email: 'admin@genomika.mk', password: 'wrong' } });
    if (status === 429) throttledAt = i;
  }
  assert.ok(throttledAt && throttledAt <= 9, `guessing refused by the ninth attempt (at ${throttledAt})`);

  // The account the attacker was guessing still works for its owner elsewhere —
  // keying on the account would have locked them out.
  const owner = await json('/auth/login', { ip: '203.0.113.50', method: 'POST', body: { email: 'admin@genomika.mk', password: 'genomika2026' } });
  assert.equal(owner.status, 200);
});

test('a successful sign-in resets that client\'s failure count', async () => {
  const ip = '203.0.113.21';
  const attempt = (password) => json('/auth/login', { ip, method: 'POST', body: { email: 's.jovanoska@genomika.mk', password } });
  for (let i = 0; i < 7; i++) assert.equal((await attempt('wrong')).status, 401);
  assert.equal((await attempt('genomika2026')).status, 200);
  // Seven more failures would have been fifteen in one window without the reset.
  for (let i = 0; i < 7; i++) assert.equal((await attempt('wrong')).status, 401, `failure ${i + 1} after reset`);
});

test('an administrator can download a stored CV, and only an administrator', async () => {
  const pdf = Buffer.concat([Buffer.from('%PDF-1.4 '), Buffer.from('downloadable')]).toString('base64');
  const applied = await json('/positions/rse-webtools/apply', {
    method: 'POST',
    body: { name: 'Downloadable Candidate', email: 'dl@example.mk',
            motivation: 'A motivation letter comfortably past the minimum length requirement.',
            cv: { name: 'mycv.pdf', type: 'application/pdf', size: 24, data: `data:application/pdf;base64,${pdf}` } }
  });
  assert.equal(applied.status, 201);

  const token = await signIn('admin@genomika.mk');
  const list = (await json('/admin/overview', { token })).body.recentApplications;
  const row = list.find(a => a.email === 'dl@example.mk');
  assert.ok(row?.cv_filename, 'the filename is recorded');

  assert.equal((await call(`/admin/applications/${row.id}/cv`)).status, 401);
  const researcher = await signIn('n.avramovski@genomika.mk');
  assert.equal((await call(`/admin/applications/${row.id}/cv`, { token: researcher })).status, 403);

  const res = await call(`/admin/applications/${row.id}/cv`, { token });
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /^%PDF-1\.4/, 'the stored bytes come back');
  const reference = `GL-${String(row.id).padStart(5, '0')}`;
  assert.match(res.headers.get('content-disposition'), new RegExp(`filename="${reference}-mycv\\.pdf"`),
    'named by reference and original name, not by storage key');
});

test('a CV download is refused for an application that has none', async () => {
  const token = await signIn('admin@genomika.mk');
  const applied = await json('/positions/intern-summer/apply', {
    method: 'POST',
    body: { name: 'No Attachment', email: 'noattach@example.mk',
            motivation: 'A motivation letter comfortably past the minimum length requirement.' }
  });
  assert.equal(applied.status, 201);
  const list = (await json('/admin/overview', { token })).body.recentApplications;
  const row = list.find(a => a.email === 'noattach@example.mk');
  const { status, body } = await json(`/admin/applications/${row.id}/cv`, { token });
  assert.equal(status, 404);
  assert.equal(body.error, 'no_cv_attached');
});

test('admin inbox actions report a missing record instead of claiming success', async () => {
  const token = await signIn('admin@genomika.mk');
  assert.equal((await json('/admin/messages/999999/handled', { token, method: 'PUT', body: { handled: true } })).status, 404);
  assert.equal((await json('/admin/applications/999999/status', { token, method: 'PUT', body: { status: 'shortlisted' } })).status, 404);
});

test('a malformed body is a 400 and an oversized one a 413 — not a 500', async () => {
  const malformed = await call('/messages', { method: 'POST', raw: '{ not json' });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error, 'malformed_json');

  const huge = await call('/messages', { method: 'POST', raw: JSON.stringify({ body: 'x'.repeat(7 * 1024 * 1024) }) });
  assert.equal(huge.status, 413);
  const text = await huge.text();
  assert.ok(!/node_modules|\/Users\/|at Object/.test(text), 'no stack or path detail reaches the client');
});

test('a repeated query parameter is handled, not a 500', async () => {
  assert.equal((await json('/people?group=microbiome-ml&group=comparative-genomics')).status, 200);
  assert.equal((await json('/publications?year=2024&year=2025')).status, 200);
});

/* ------------------------------------------------------------- MESSAGES -- */

test('the contact form validates before storing', async () => {
  const bad = await json('/messages', { method: 'POST', body: { name: 'X', email: 'nope', subject: 'a', body: 'short' } });
  assert.equal(bad.status, 400);
  assert.deepEqual(Object.keys(bad.body.fields).sort(), ['body', 'email', 'name', 'subject']);

  const good = await json('/messages', {
    method: 'POST',
    body: { name: 'Petar Stojanov', email: 'petar@example.mk', subject: 'Collaboration',
            body: 'We would like to discuss a joint sampling campaign next spring.' }
  });
  assert.equal(good.status, 201);
  assert.match(good.body.reference, /^MSG-\d{5}$/);
});

/* --------------------------------------------------------- PUBLICATIONS -- */

test('publication search, filtering, sorting and paging agree with each other', async () => {
  const all = (await json('/publications?limit=50')).body;
  assert.equal(all.total, all.items.length);

  const page1 = (await json('/publications?limit=5&page=1&sort=year&order=desc')).body;
  const page2 = (await json('/publications?limit=5&page=2&sort=year&order=desc')).body;
  assert.equal(page1.items.length, 5);
  assert.equal(page1.pages, Math.ceil(all.total / 5));
  assert.deepEqual(page1.items.filter(i => page2.items.some(j => j.id === i.id)), [], 'pages do not overlap');

  const years = page1.items.map(i => i.year);
  assert.deepEqual(years, [...years].sort((a, b) => b - a), 'descending by year');

  const oa = (await json('/publications?openAccess=true&limit=50')).body;
  assert.ok(oa.items.every(i => i.open_access === 1));

  const filtered = (await json('/publications?group=microbiome-ml&limit=50')).body;
  assert.ok(filtered.total > 0 && filtered.total < all.total);
  assert.ok(filtered.items.every(i => i.group_slug === 'microbiome-ml'));

  const searched = (await json('/publications?q=pangenome&limit=50')).body;
  assert.ok(searched.total > 0);
  assert.ok(searched.items.every(i =>
    `${i.title} ${i.authors} ${i.venue} ${i.keywords}`.toLowerCase().includes('pangenome')));
});

test('a search term containing SQL metacharacters is treated as text', async () => {
  const { status, body } = await json(`/publications?q=${encodeURIComponent("'; DROP TABLE publications;--")}`);
  assert.equal(status, 200);
  assert.equal(body.total, 0);
  const still = (await json('/publications?limit=1')).body;
  assert.ok(still.total > 0, 'the table is still there');
});

/* ------------------------------------------------------------ ADMIN CRUD -- */

test('an administrator can create, amend and delete a publication', async () => {
  const token = await signIn('admin@genomika.mk');

  const created = await json('/admin/publications', {
    token, method: 'POST',
    body: { title: 'A test record', authors: 'Tester T', venue: 'Journal of Testing', year: 2026 }
  });
  assert.equal(created.status, 201);
  const id = created.body.id;

  const updated = await json(`/admin/publications/${id}`, {
    token, method: 'PUT', body: { title: 'A test record, amended' }
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.title, 'A test record, amended');
  assert.equal(updated.body.venue, 'Journal of Testing', 'untouched fields survive a partial update');

  assert.equal((await json(`/admin/publications/${id}`, { token, method: 'DELETE' })).status, 200);
  assert.equal((await json(`/admin/publications/${id}`, { token, method: 'DELETE' })).status, 404);
});

test('admin creation refuses incomplete records', async () => {
  const token = await signIn('admin@genomika.mk');
  assert.equal((await json('/admin/publications', { token, method: 'POST', body: { authors: 'X' } })).status, 400);
  assert.equal((await json('/admin/news', { token, method: 'POST', body: { title_en: 'Only English' } })).status, 400);
});

/* --------------------------------------------------------- PROTECTIONS -- */

test('public write endpoints are rate limited per client', async () => {
  const ip = '203.0.113.90';
  const send = () => json('/messages', { ip, method: 'POST',
    body: { name: 'Rate Tester', email: 'rate@example.mk', subject: 'Limit check', body: 'A message long enough to be accepted by validation.' } });
  let limitedAt = null;
  for (let i = 1; i <= 15 && !limitedAt; i++) if ((await send()).status === 429) limitedAt = i;
  assert.ok(limitedAt && limitedAt <= 11, `limited by the eleventh message (at ${limitedAt})`);
  // Another client is unaffected.
  assert.equal((await json('/messages', { method: 'POST',
    body: { name: 'Other Client', email: 'other@example.mk', subject: 'Unaffected', body: 'A message long enough to be accepted by validation.' } })).status, 201);
});

test('free-text fields are length-capped', async () => {
  const long = await json('/messages', { method: 'POST',
    body: { name: 'N'.repeat(500), email: 'cap@example.mk', subject: 'S'.repeat(500), body: 'A message long enough to be accepted by validation.' } });
  assert.equal(long.status, 400);
  assert.equal(long.body.fields.name, 'too_long');
  assert.equal(long.body.fields.subject, 'too_long');
});

test('a booking date must be a real calendar date within the booking horizon', async () => {
  const token = await signIn('n.avramovski@genomika.mk');
  const book = (date, start_hour = 9, end_hour = 10) => json('/bookings', { token, method: 'POST',
    body: { instrument_slug: 'qpcr-station', date, start_hour, end_hour } });
  assert.equal((await book('2099-99-99')).body.error, 'invalid_date');
  assert.equal((await book('2026-02-30')).body.error, 'invalid_date');
  assert.equal((await book('9999-12-31')).body.error, 'too_far_ahead');
  assert.equal((await json('/instruments/qpcr-station/availability?date=2026-13-01')).status, 400);
});

test('an hour that has already started today cannot be booked', async () => {
  const token = await signIn('n.avramovski@genomika.mk');
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const hour = now.getHours();
  // The HPC cluster is open around the clock, so the current hour is always in range.
  const { body } = await json('/bookings', { token, method: 'POST',
    body: { instrument_slug: 'hpc-cluster', date: today, start_hour: hour, end_hour: hour + 1 } });
  assert.equal(body.error, hour + 1 > 24 ? 'outside_opening_hours' : 'date_in_past');
});

test('a booking that has already ended cannot be cancelled', async () => {
  const token = await signIn('n.avramovski@genomika.mk');
  const me = (await json('/auth/me', { token })).body.user;
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const date = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  const { lastInsertRowid: id } = db.prepare(
    `INSERT INTO bookings (instrument_id,user_id,user_name,user_email,date,start_hour,end_hour,purpose,status)
     VALUES ((SELECT id FROM instruments WHERE slug = 'qpcr-station'),?,?,?,?,9,10,'finished run','confirmed')`
  ).run(me.id, 'Nikola Avramovski', me.email, date);

  const res = await json(`/bookings/${id}`, { token, method: 'DELETE' });
  assert.equal(res.status, 409);
  assert.equal(res.body.error, 'booking_finished');
});

test('the admin overview lists only bookings still to come, named in both languages', async () => {
  const token = await signIn('admin@genomika.mk');
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (now.getHours() > 0) {
    db.prepare(`INSERT INTO bookings (instrument_id,user_id,user_name,user_email,date,start_hour,end_hour,purpose,status)
                VALUES ((SELECT id FROM instruments WHERE slug = 'hpc-cluster'),NULL,'Early Bird','early@example.mk',?,0,?,'already over','confirmed')`)
      .run(today, now.getHours());
  }
  const { upcomingBookings } = (await json('/admin/overview', { token })).body;
  assert.ok(!upcomingBookings.some(b => b.purpose === 'already over'), 'a booking that ended earlier today is not upcoming');

  // Ivana has a staff profile but no login; her booking still carries her Macedonian name.
  const ivana = upcomingBookings.find(b => b.user_email === 'i.petrushevska@genomika.mk');
  assert.ok(ivana, 'the seeded booking is listed');
  assert.match(ivana.user_name_mk, /Ивана/);
});

test('availability marks the hours that can no longer be booked', async () => {
  const now = new Date();
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);

  const today = (await json(`/instruments/hpc-cluster/availability?date=${iso(now)}`)).body.slots;
  today.forEach(s => assert.equal(s.past, s.hour <= now.getHours(), `hour ${s.hour} today`));
  assert.ok((await json(`/instruments/hpc-cluster/availability?date=${iso(yesterday)}`)).body.slots.every(s => s.past));
  assert.ok((await json(`/instruments/hpc-cluster/availability?date=${iso(tomorrow)}`)).body.slots.every(s => !s.past));
});

test('one person cannot hold more than twenty upcoming bookings', async () => {
  const token = await signIn('s.jovanoska@genomika.mk');
  let refused = null;
  for (let day = 30; day < 60 && !refused; day++) {
    const { status, body } = await json('/bookings', { token, method: 'POST',
      body: { instrument_slug: 'visualisation-wall', date: dayFromNow(day), start_hour: 9, end_hour: 10 } });
    if (status === 409) refused = body.error;
  }
  assert.equal(refused, 'quota_exceeded');
});

test('administrative writes validate every field instead of storing what they are sent', async () => {
  const token = await signIn('admin@genomika.mk');
  const id = (await json('/publications?limit=1')).body.items[0].id;
  const put = (body) => json(`/admin/publications/${id}`, { token, method: 'PUT', body });

  assert.equal((await put({ year: 'not a year' })).body.fields.year, 'not_an_integer');
  assert.equal((await put({ title: null })).body.fields.title, 'required');
  assert.equal((await put({ type: 'novel' })).body.fields.type, 'not_allowed');
  assert.equal((await put({ group_id: 999 })).body.fields.group_id, 'does_not_exist');
  assert.equal((await put({ open_access: true })).status, 200, 'a real boolean is accepted');

  const stored = db.prepare('SELECT year, open_access FROM publications WHERE id = ?').get(id);
  assert.equal(typeof stored.year, 'number', 'the integer column still holds an integer');
  assert.equal(stored.open_access, 1);

  const unknown = await put({ citations: 3, not_a_column: 'x' });
  assert.equal(unknown.status, 200, 'unknown fields are ignored, not written');
});

test('renaming a news item onto a taken slug is a conflict, not a crash', async () => {
  const token = await signIn('admin@genomika.mk');
  const [a, b] = (await json('/news')).body;
  const res = await json(`/admin/news/${a.id}`, { token, method: 'PUT', body: { slug: b.slug } });
  assert.equal(res.status, 409);
  assert.equal(res.body.error, 'slug_taken');
});

test('project status follows from its dates rather than a stored value', async () => {
  const projects = (await json('/projects')).body;
  const today = new Date().toISOString().slice(0, 10);
  for (const p of projects) {
    const expected = today < p.start_date ? 'planned' : today > p.end_date ? 'completed' : 'active';
    assert.equal(p.status, expected, `${p.slug}: ${p.start_date} → ${p.end_date}`);
  }
});

test('a position past its deadline is closed even if its flag says open', async () => {
  const slug = 'rse-webtools';
  db.prepare("UPDATE positions SET deadline = '2020-01-01', is_open = 1 WHERE slug = ?").run(slug);
  const listed = (await json('/positions')).body.find(p => p.slug === slug);
  assert.equal(listed.is_open, 0);
  const apply = await json(`/positions/${slug}/apply`, { method: 'POST',
    body: { name: 'Late Applicant', email: 'late@example.mk', motivation: 'A motivation letter comfortably past the minimum length requirement.' } });
  assert.equal(apply.status, 409);
  assert.equal(apply.body.error, 'position_closed');
});

/* --------------------------------------------------------------- SHAPE -- */

test('an unknown API path is a JSON 404, not an HTML error page', async () => {
  const res = await call('/no-such-endpoint');
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, 'unknown_endpoint');
});

test('every seeded record carries both languages', async () => {
  for (const [path, fields] of [['/groups', ['name', 'tagline', 'description']],
                                ['/people', ['name', 'role']],
                                ['/datasets', ['title', 'description']],
                                ['/news', ['title', 'excerpt']]]) {
    const rows = (await json(path)).body;
    assert.ok(rows.length > 0, path);
    for (const row of rows) {
      for (const field of fields) {
        assert.ok(row[`${field}_mk`]?.trim(), `${path} ${row.id} is missing ${field}_mk`);
        assert.ok(row[`${field}_en`]?.trim(), `${path} ${row.id} is missing ${field}_en`);
      }
    }
  }
});
