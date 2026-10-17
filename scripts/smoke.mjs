#!/usr/bin/env node
/**
 * End-to-end check of a running deployment.
 *
 *   BASE_URL=http://localhost:8080 node scripts/smoke.mjs
 *
 * The unit and integration suites test the code in process. This tests the
 * thing that is actually deployed: requests go through nginx, across the
 * container network, into the api container and its volume. Every feature the
 * README advertises is exercised at least once. It writes demo records, so run
 * it against a disposable stack, never a live one with real data.
 *
 * Every record it creates carries this run's id and every booking it makes is
 * cancelled again, so runs do not collide. It is one client, as far as the
 * stack can tell, and its last section deliberately uses up that client's
 * sign-in and form allowances to prove the limits exist. A second run before
 * those windows close (one and ten minutes) stops at the first refusal and
 * says so.
 */
const BASE = (process.env.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const API = `${BASE}/api`;
// The stack's own seeded passwords (see server/src/lib/demo.js).
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'genomika2026';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'genomika2026';

const RUN = Date.now().toString(36);
const applicant = `applicant-${RUN}@example.mk`;

let passed = 0, failed = 0;
const failures = [];
let section = '';

const head = (name) => { section = name; console.log(`\n${name}`); };
const check = (label, ok, detail = '') => {
  if (ok) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; failures.push(`${section} — ${label}${detail ? ` (${detail})` : ''}`); console.log(`  ✗ ${label}${detail ? `  — ${detail}` : ''}`); }
};

let limitsExpected = false;

async function req(path, { token, method = 'GET', body, raw = false, headers = {} } = {}) {
  const url = path.startsWith('http') ? path : API + path;
  const res = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  if (res.status === 429 && !limitsExpected) {
    const wait = res.headers.get('retry-after');
    console.log(`\nRefused with 429 at ${method} ${path}: the rate-limit window from an earlier run is still open.`);
    console.log(`Run again ${wait ? `in ${wait} s` : 'in a few minutes'}.`);
    process.exit(2);
  }
  if (raw) return res;
  let data = null;
  try { data = await res.json(); } catch { /* not JSON */ }
  return { status: res.status, data, headers: res.headers };
}

const login = async (email) => (await req('/auth/login', { method: 'POST',
  body: { email, password: email.startsWith('admin@') || email.startsWith('f.') ? ADMIN_PASSWORD : DEMO_PASSWORD } })).data?.token;
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const pdf = (text) => `data:application/pdf;base64,${Buffer.concat([Buffer.from('%PDF-1.4 '), Buffer.from(text)]).toString('base64')}`;

/* ------------------------------------------------------- WEB TIER ------ */
head('Web tier (nginx)');
{
  const res = await req(`${BASE}/`, { raw: true });
  const html = await res.text();
  check('index.html is served', res.status === 200 && /<title>GenomikaLab/.test(html));
  check('index.html is not cached', /no-cache/.test(res.headers.get('cache-control') || ''));

  const asset = html.match(/\/assets\/[^"]+\.js/)?.[0];
  const js = await req(`${BASE}${asset}`, { raw: true, headers: { 'Accept-Encoding': 'gzip' } });
  check('hashed assets are gzip-compressed', js.headers.get('content-encoding') === 'gzip');
  check('hashed assets are cached immutably', /immutable/.test(js.headers.get('cache-control') || ''));
  check('exactly one Cache-Control header on assets', (js.headers.get('cache-control') || '').split(',').filter(p => /max-age/.test(p)).length === 1);

  const csp = res.headers.get('content-security-policy') || '';
  check('Content-Security-Policy on the shell', /default-src 'self'/.test(csp) && /script-src 'self'/.test(csp) && /frame-ancestors 'none'/.test(csp));
  check('security headers on the shell', res.headers.get('x-content-type-options') === 'nosniff' && res.headers.get('x-frame-options') === 'DENY');
  check('security headers on assets too', Boolean(js.headers.get('content-security-policy')) && js.headers.get('x-content-type-options') === 'nosniff');
  check('server version not disclosed', !/\d/.test(res.headers.get('server') || ''));
  check('no third-party origins in the shell', !/fonts\.googleapis|fonts\.gstatic|cdn\./.test(html));

  for (const route of ['/research', '/research/comparative-genomics', '/team', '/team/ana-trajkovska',
                       '/publications', '/datasets', '/tools', '/tools/toolkit', '/tools/gel',
                       '/facilities', '/events', '/news', '/careers', '/contact', '/metrics',
                       '/login', '/admin', '/no-such-page']) {
    const r = await req(`${BASE}${route}`, { raw: true });
    check(`client route ${route}`, r.status === 200);
  }
  check('web tier healthcheck', (await req(`${BASE}/healthz`, { raw: true })).status === 200);
}

head('API through the proxy');
{
  const h = await req('/health');
  check('/api/health proxies to the api tier', h.status === 200 && h.data?.ok === true);
  const nf = await req('/definitely-not-a-route');
  check('unknown API path is a JSON 404', nf.status === 404 && nf.data?.error === 'unknown_endpoint');
}

/* --------------------------------------------------------- CONTENT ----- */
head('Research, team and content');
{
  const groups = (await req('/groups')).data;
  check('three research groups', groups?.length === 3);
  const g = await req(`/groups/${groups[0].slug}`);
  check('group detail carries people, projects and publications',
    g.data?.people?.length > 0 && g.data?.projects?.length > 0 && g.data?.publications?.length > 0);
  check('unknown group is 404', (await req('/groups/nope')).status === 404);

  const people = (await req('/people')).data;
  check('ten people', people?.length === 10);
  check('people filter by group', (await req('/people?group=microbiome-ml')).data.every(p => p.group_slug === 'microbiome-ml'));
  check('people search by interest', (await req('/people?q=метагеномика')).data.length > 0);
  const person = await req('/people/ana-trajkovska');
  check('person detail has publications and projects', person.data?.publications?.length > 0 && person.data?.projects?.length > 0);

  const projects = (await req('/projects')).data;
  check('six projects with members', projects?.length === 6 && projects.every(p => Array.isArray(p.members)));
  check('project status filter', (await req('/projects?status=completed')).data.every(p => p.status === 'completed'));

  const news = (await req('/news')).data;
  check('news items', news?.length >= 6);
  check('news detail', (await req(`/news/${news[0].slug}`)).status === 200);

  const metrics = (await req('/metrics')).data;
  check('metrics totals', metrics?.totals?.publications === 22 && metrics?.totals?.people === 10);
  check('metrics series', metrics?.publicationsPerYear?.length > 0 && metrics?.byGroup?.length === 3 && metrics?.funding?.length === 6);
  const net = (await req('/network')).data;
  check('collaboration network has nodes and links', net?.nodes?.length > 10 && net?.links?.length > 10);
  check('every network link points at an existing node', net.links.every(l =>
    net.nodes.some(n => n.id === l.source) && net.nodes.some(n => n.id === l.target)));
  check('partner institutions', metrics?.partners?.length === 10);
}

head('Publications');
{
  const all = (await req('/publications?limit=50')).data;
  check('22 publications', all?.total === 22);
  const p1 = (await req('/publications?limit=5&page=1&sort=citations&order=desc')).data;
  const p2 = (await req('/publications?limit=5&page=2&sort=citations&order=desc')).data;
  check('paging does not repeat records', !p1.items.some(a => p2.items.some(b => b.id === a.id)));
  check('sorted by citations, descending', p1.items.every((x, i, a) => i === 0 || a[i - 1].citations >= x.citations));
  check('search', (await req('/publications?q=pangenome')).data.total > 0);
  check('open-access filter', (await req('/publications?openAccess=true&limit=50')).data.items.every(i => i.open_access === 1));
  check('year filter', (await req('/publications?year=2024&limit=50')).data.items.every(i => i.year === 2024));
  const facets = (await req('/publications/facets')).data;
  check('facets', facets?.years?.length > 0 && facets?.types?.length > 0);
  check('SQL metacharacters are inert', (await req(`/publications?q=${encodeURIComponent("' OR 1=1 --")}`)).data.total === 0);
}

head('Datasets');
{
  const ds = (await req('/datasets')).data;
  check('six datasets', ds?.length === 6);
  const before = ds[0].downloads;
  const dl = await req(`/datasets/${ds[0].slug}/download`, { raw: true });
  const csv = await dl.text();
  check('CSV download', dl.status === 200 && /text\/csv/.test(dl.headers.get('content-type')) && csv.split('\n').length > 3);
  check('download sets an attachment filename', /attachment; filename=/.test(dl.headers.get('content-disposition') || ''));
  const after = (await req(`/datasets/${ds[0].slug}`)).data.downloads;
  await (await req(`/datasets/${ds[0].slug}/download`, { raw: true })).text();
  const again = (await req(`/datasets/${ds[0].slug}`)).data.downloads;
  // Once per visitor per day: the first run today counts, a repeat does not.
  check('download counter counts a visitor once a day', after - before <= 1 && again === after);
}

/* ---------------------------------------------------------- EVENTS ----- */
head('Events');
{
  const up = (await req('/events?scope=upcoming')).data;
  const past = (await req('/events?scope=past')).data;
  const all = (await req('/events?scope=all')).data;
  check('upcoming + past = all, with no overlap',
    up.length + past.length === all.length && !up.some(u => past.some(p => p.id === u.id)));
  check('upcoming events are in the future', up.every(e => new Date(e.starts_at) > new Date()));
  const id = up[0].id;
  const rsvp = { name: 'Smoke Tester', email: `smoke-${RUN}@example.mk` };
  check('RSVP accepted', (await req(`/events/${id}/rsvp`, { method: 'POST', body: rsvp })).status === 201);
  check('duplicate RSVP refused', (await req(`/events/${id}/rsvp`, { method: 'POST', body: rsvp })).data?.error === 'already_registered');
  check('RSVP to a past event refused', (await req(`/events/${past[0].id}/rsvp`, { method: 'POST', body: rsvp })).data?.error === 'event_past');
  check('invalid RSVP refused', (await req(`/events/${id}/rsvp`, { method: 'POST', body: { name: 'Valid Name', email: 'nope' } })).status === 400);
  check('RSVP count reflects the registration', (await req(`/events/${id}`)).data.rsvp_count >= 1);
  const ics = await req(`/events/${id}/ics`, { raw: true });
  const text = await ics.text();
  check('iCalendar export', /text\/calendar/.test(ics.headers.get('content-type')) && /DTSTART:\d{8}T\d{6}Z/.test(text) && /END:VCALENDAR/.test(text));
  check('iCalendar lines end in CRLF and are folded to 75 octets',
    text.endsWith('\r\n') && text.split('\r\n').every(line => Buffer.byteLength(line) <= 75));
  const icsMk = await (await req(`/events/${id}/ics?lang=mk`, { raw: true })).text();
  check('iCalendar export in Macedonian', /[а-шА-Ш]/.test(icsMk) && icsMk !== text);
}

/* --------------------------------------------------------- CAREERS ----- */
head('Careers and contact');
{
  const positions = (await req('/positions')).data;
  check('positions listed, open first', positions?.length === 5 && positions[0].is_open === 1);
  check('open filter', (await req('/positions?open=true')).data.every(p => p.is_open === 1));
  const good = await req('/positions/phd-pangenome/apply', { method: 'POST', body: {
    name: 'Smoke Applicant', email: applicant,
    motivation: 'I am applying through the deployment smoke test, which needs a long enough letter.',
    cv: { name: 'smoke-cv.pdf', type: 'application/pdf', size: 30, data: pdf('smoke test cv') } } });
  check('application with a PDF accepted', good.status === 201 && /^GL-\d{5}$/.test(good.data?.reference));
  const badBytes = await req('/positions/phd-pangenome/apply', { method: 'POST', body: {
    name: 'Smoke Applicant', email: `applicant2-${RUN}@example.mk`,
    motivation: 'I am applying through the deployment smoke test, which needs a long enough letter.',
    cv: { name: 'x.pdf', type: 'application/pdf', size: 10, data: `data:application/pdf;base64,${Buffer.from('not a pdf').toString('base64')}` } } });
  check('upload whose bytes are not a PDF refused', badBytes.data?.fields?.cv === 'unsupported_type');
  check('invalid application reports every field', Object.keys((await req('/positions/phd-pangenome/apply', {
    method: 'POST', body: { name: 'X', email: 'y', motivation: 'z' } })).data?.fields || {}).length === 3);
  check('closed position refuses', (await req('/positions/postdoc-structure/apply', { method: 'POST', body: {
    name: 'Smoke Applicant', email: `closed-${RUN}@example.mk`, motivation: 'A long enough motivation letter for the closed position.' } })).data?.error === 'position_closed');
  check('over-long field refused', (await req('/messages', { method: 'POST', body: {
    name: 'N'.repeat(500), email: `long-${RUN}@example.mk`, subject: 'Too long', body: 'This name is far longer than any real name.' } })).data?.fields?.name === 'too_long');
  const msg = await req('/messages', { method: 'POST', body: {
    name: 'Smoke Tester', email: `smoke-${RUN}@example.mk`, subject: `Smoke test ${RUN}`, body: 'This message comes from the deployment smoke test.' } });
  check('contact message accepted', msg.status === 201 && /^MSG-\d{5}$/.test(msg.data?.reference));
  check('invalid contact message refused', (await req('/messages', { method: 'POST', body: { name: 'X' } })).status === 400);

}

/* ------------------------------------------------------------ AUTH ----- */
head('Authentication');
let admin, researcher, other;
{
  admin = await login('admin@genomika.mk');
  researcher = await login('n.avramovski@genomika.mk');
  other = await login('s.jovanoska@genomika.mk');
  check('demo accounts sign in', Boolean(admin && researcher && other));
  check('/auth/me returns the account', (await req('/auth/me', { token: admin })).data?.user?.role === 'admin');
  check('wrong password refused', (await req('/auth/login', { method: 'POST', body: { email: 'smoke-probe@example.mk', password: 'x' } })).status === 401);
  check('forged token refused', (await req('/auth/me', { token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjF9.x' })).status === 401);
  check('a token cannot grant itself a role', (await req('/admin/overview', {
    token: 'eyJhbGciOiJub25lIn0.eyJzdWIiOjEsInJvbGUiOiJhZG1pbiJ9.' })).status === 401);
}

/* --------------------------------------------------------- BOOKING ----- */
head('Instrument booking');
{
  const instruments = (await req('/instruments')).data;
  check('six instruments', instruments?.length === 6);
  const date = day(20);
  check('booking requires sign-in', (await req('/bookings', { method: 'POST', body: { instrument_slug: 'qpcr-station', date, start_hour: 9, end_hour: 10 } })).status === 401);
  const made = await req('/bookings', { token: researcher, method: 'POST', body: { instrument_slug: 'qpcr-station', date, start_hour: 9, end_hour: 12, purpose: 'smoke booking' } });
  check('booking created with a cost', made.status === 201 && made.data?.cost_eur === 36);
  check('overlap refused with the clash', (await req('/bookings', { token: other, method: 'POST', body: { instrument_slug: 'qpcr-station', date, start_hour: 11, end_hour: 13 } })).data?.error === 'slot_taken');
  const adjacent = await req('/bookings', { token: other, method: 'POST', body: { instrument_slug: 'qpcr-station', date, start_hour: 12, end_hour: 13 } });
  check('adjacent slot allowed', adjacent.status === 201);
  check('over the duration cap refused', (await req('/bookings', { token: researcher, method: 'POST', body: { instrument_slug: 'qpcr-station', date: day(21), start_hour: 8, end_hour: 16 } })).data?.error === 'exceeds_max_hours');
  check('outside opening hours refused', (await req('/bookings', { token: researcher, method: 'POST', body: { instrument_slug: 'qpcr-station', date: day(21), start_hour: 5, end_hour: 6 } })).data?.error === 'outside_opening_hours');
  check('past date refused', (await req('/bookings', { token: researcher, method: 'POST', body: { instrument_slug: 'qpcr-station', date: day(-2), start_hour: 9, end_hour: 10 } })).data?.error === 'date_in_past');
  check('impossible calendar date refused', (await req('/bookings', { token: researcher, method: 'POST', body: { instrument_slug: 'qpcr-station', date: '2027-02-30', start_hour: 9, end_hour: 10 } })).status === 400);
  check('booking beyond the horizon refused', (await req('/bookings', { token: researcher, method: 'POST', body: { instrument_slug: 'qpcr-station', date: day(400), start_hour: 9, end_hour: 10 } })).data?.error === 'too_far_ahead');
  check('an untrained researcher cannot book an instrument that requires training', (await req('/bookings', { token: researcher, method: 'POST', body: { instrument_slug: 'illumina-nextseq', date: day(21), start_hour: 9, end_hour: 10 } })).data?.error === 'training_required');
  check('instrument under maintenance refused', (await req('/bookings', { token: researcher, method: 'POST', body: { instrument_slug: 'bioanalyzer', date: day(21), start_hour: 9, end_hour: 10 } })).data?.error === 'instrument_unavailable');

  const anon = (await req(`/instruments/qpcr-station/availability?date=${date}`)).data;
  check('anonymous availability shows occupancy', anon.slots.find(s => s.hour === 10)?.free === false);
  check('anonymous availability hides who booked', !JSON.stringify(anon).includes('smoke booking') && anon.slots.every(s => s.booking === null));
  const authed = (await req(`/instruments/qpcr-station/availability?date=${date}`, { token: researcher })).data;
  const booker = authed.slots.find(s => s.hour === 10)?.booking;
  check('signed-in availability names the booker in both languages', Boolean(booker?.user_name_mk && booker?.user_name_en));

  const mine = (await req('/bookings/mine', { token: researcher })).data;
  const smoke = mine.find(b => b.purpose === 'smoke booking' && b.date === date && b.status !== 'cancelled');
  check('my bookings lists it', Boolean(smoke));
  check('another user cannot cancel it', (await req(`/bookings/${smoke.id}`, { token: other, method: 'DELETE' })).status === 403);
  check('the owner can cancel it', (await req(`/bookings/${smoke.id}`, { token: researcher, method: 'DELETE' })).status === 200);
  check('the adjacent booking is cancelled too', (await req(`/bookings/${adjacent.data?.booking?.id}`, { token: other, method: 'DELETE' })).status === 200);
  check('the cancelled slot is free again', (await req(`/instruments/qpcr-station/availability?date=${date}`)).data.slots.find(s => s.hour === 10)?.free === true);
  check('removed week endpoint stays removed', (await req(`/bookings/week?from=${date}`)).status === 404);
}

/* ----------------------------------------------------------- ADMIN ----- */
head('Administration');
{
  check('admin closed to anonymous', (await req('/admin/overview')).status === 401);
  check('admin closed to researchers', (await req('/admin/overview', { token: researcher })).status === 403);
  const ov = await req('/admin/overview', { token: admin });
  check('admin overview', ov.status === 200 && ov.data?.counts?.applications >= 1 && ov.data?.counts?.unread_messages >= 1);

  const title = `Smoke publication ${RUN}`;
  const pub = await req('/admin/publications', { token: admin, method: 'POST', body: { title, authors: 'Tester T', venue: 'Smoke Journal', year: 2026 } });
  check('publication created (type defaulted)', pub.status === 201 && pub.data?.type === 'article');
  check('publication updated', (await req(`/admin/publications/${pub.data.id}`, { token: admin, method: 'PUT', body: { citations: 5 } })).data?.citations === 5);
  check('publication appears publicly', (await req(`/publications?q=${encodeURIComponent(title)}`)).data.total === 1);
  check('invalid publication refused', (await req('/admin/publications', { token: admin, method: 'POST', body: { title: 'Bad year', authors: 'T', venue: 'V', year: 'soon' } })).status === 400);
  check('publication deleted', (await req(`/admin/publications/${pub.data.id}`, { token: admin, method: 'DELETE' })).status === 200);

  const news = await req('/admin/news', { token: admin, method: 'POST', body: { title_mk: 'Смоук вест', title_en: `Smoke news ${RUN}`, tag: 'news' } });
  check('news created with a slug', news.status === 201 && news.data?.slug === `smoke-news-${RUN}`);
  check('duplicate slug refused', (await req('/admin/news', { token: admin, method: 'POST', body: { title_mk: 'Смоук вест', title_en: `Smoke news ${RUN}`, tag: 'news' } })).data?.error === 'slug_taken');
  check('news needs both languages', (await req('/admin/news', { token: admin, method: 'POST', body: { title_en: 'Only English' } })).status === 400);
  check('news deleted', (await req(`/admin/news/${news.data.id}`, { token: admin, method: 'DELETE' })).status === 200);

  const person = await req('/admin/people', { token: admin, method: 'POST', body: { name_mk: 'Смоук Тестер', name_en: `Smoke Tester ${RUN}`, role_mk: 'Тестер', role_en: 'Tester' } });
  check('person created', person.status === 201);
  check('person deleted', (await req(`/admin/people/${person.data.id}`, { token: admin, method: 'DELETE' })).status === 200);

  const app = ov.data.recentApplications.find(a => a.email === applicant);
  check('application status updated', (await req(`/admin/applications/${app.id}/status`, { token: admin, method: 'PUT', body: { status: 'shortlisted' } })).status === 200);
  const cv = await req(`/admin/applications/${app.id}/cv`, { token: admin, raw: true });
  const bytes = Buffer.from(await cv.arrayBuffer());
  check('stored CV downloads intact', cv.status === 200 && bytes.subarray(0, 5).toString() === '%PDF-');
  check('CV is named by application reference', /filename="GL-\d{5}-smoke-cv\.pdf"/.test(cv.headers.get('content-disposition') || ''));
  check('CV download closed to researchers', (await req(`/admin/applications/${app.id}/cv`, { token: researcher, raw: true })).status === 403);
  const msg = ov.data.messages.find(m => m.subject === `Smoke test ${RUN}`);
  check('message marked handled', (await req(`/admin/messages/${msg.id}/handled`, { token: admin, method: 'PUT', body: { handled: true } })).status === 200);
  check('missing record is a 404, not a fake success', (await req('/admin/messages/999999/handled', { token: admin, method: 'PUT', body: { handled: true } })).status === 404);
}

/* ------------------------------------------------------ ABUSE LIMITS --- */
// Last, because each check uses up this client's allowance for a while.
head('Abuse limits');
{
  limitsExpected = true;
  check('a forged X-Forwarded-For does not make a new client', await (async () => {
    // nginx believes X-Forwarded-For only from proxies on its own network, so
    // these requests all count against the same client however they are labelled.
    let limited = false;
    for (let i = 0; i < 12 && !limited; i++) {
      limited = (await req('/messages', { method: 'POST', headers: { 'X-Forwarded-For': `203.0.113.${i + 1}` },
        body: { name: 'X' } })).status === 429;
    }
    return limited;
  })());
  let throttled = false;
  for (let i = 0; i < 12 && !throttled; i++) {
    throttled = (await req('/auth/login', { method: 'POST', body: { email: 'throttle-smoke@example.mk', password: 'x' } })).status === 429;
  }
  check('repeated sign-in failures are throttled', throttled);
  check('a throttled client is refused even with the right password',
    (await req('/auth/login', { method: 'POST', body: { email: 'admin@genomika.mk', password: ADMIN_PASSWORD } })).status === 429);
}

/* --------------------------------------------------------- SUMMARY ----- */
console.log(`\n${passed} passed, ${failed} failed  —  ${BASE}`);
if (failed) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  ✗ ${f}`));
  process.exit(1);
}
