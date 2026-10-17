import { Router } from 'express';
import { db } from '../db.js';

export const content = Router();

/* ---------------------------------------------------------------- GROUPS */
content.get('/groups', (_req, res) => {
  const groups = db.prepare('SELECT * FROM groups ORDER BY founded').all();
  const counts = db.prepare('SELECT group_id, COUNT(*) n FROM people GROUP BY group_id').all();
  const pubCounts = db.prepare('SELECT group_id, COUNT(*) n FROM publications GROUP BY group_id').all();
  const byId = (rows) => Object.fromEntries(rows.map(r => [r.group_id, r.n]));
  const members = byId(counts), papers = byId(pubCounts);
  res.json(groups.map(g => ({ ...g, member_count: members[g.id] ?? 0, publication_count: papers[g.id] ?? 0 })));
});

content.get('/groups/:slug', (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE slug = ?').get(req.params.slug);
  if (!group) return res.status(404).json({ error: 'not_found' });
  res.json({
    ...group,
    people: db.prepare('SELECT * FROM people WHERE group_id = ? ORDER BY joined_year').all(group.id),
    projects: db.prepare('SELECT * FROM projects_live WHERE group_id = ? ORDER BY start_date DESC').all(group.id),
    publications: db.prepare('SELECT * FROM publications WHERE group_id = ? ORDER BY year DESC, citations DESC').all(group.id)
  });
});

/* ---------------------------------------------------------------- PEOPLE */
content.get('/people', (req, res) => {
  const { group, seniority, q } = req.query;
  let sql = `SELECT p.*, g.slug AS group_slug, g.name_mk AS group_name_mk, g.name_en AS group_name_en, g.accent
             FROM people p LEFT JOIN groups g ON g.id = p.group_id WHERE 1=1`;
  const params = [];
  if (group) { sql += ' AND g.slug = ?'; params.push(group); }
  if (seniority) { sql += ' AND p.seniority = ?'; params.push(seniority); }
  if (q) { sql += ' AND (p.name_mk LIKE ? OR p.name_en LIKE ? OR p.interests LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const order = `CASE p.seniority WHEN 'faculty' THEN 0 WHEN 'postdoc' THEN 1 WHEN 'staff' THEN 2 WHEN 'phd' THEN 3 ELSE 4 END`;
  res.json(db.prepare(`${sql} ORDER BY ${order}, p.joined_year`).all(...params));
});

content.get('/people/:slug', (req, res) => {
  const person = db.prepare(`SELECT p.*, g.slug AS group_slug, g.name_mk AS group_name_mk, g.name_en AS group_name_en, g.accent
                             FROM people p LEFT JOIN groups g ON g.id = p.group_id WHERE p.slug = ?`).get(req.params.slug);
  if (!person) return res.status(404).json({ error: 'not_found' });
  res.json({
    ...person,
    publications: db.prepare(`SELECT pub.* FROM publications pub
      JOIN publication_authors pa ON pa.publication_id = pub.id
      WHERE pa.person_id = ? ORDER BY pub.year DESC`).all(person.id),
    projects: db.prepare(`SELECT pr.*, pm.role AS member_role FROM projects_live pr
      JOIN project_members pm ON pm.project_id = pr.id
      WHERE pm.person_id = ? ORDER BY pr.start_date DESC`).all(person.id)
  });
});

/* -------------------------------------------------------------- PROJECTS */
content.get('/projects', (req, res) => {
  const { group, status } = req.query;
  let sql = `SELECT pr.*, g.slug AS group_slug, g.name_mk AS group_name_mk, g.name_en AS group_name_en, g.accent
             FROM projects_live pr LEFT JOIN groups g ON g.id = pr.group_id WHERE 1=1`;
  const params = [];
  if (group) { sql += ' AND g.slug = ?'; params.push(group); }
  if (status) { sql += ' AND pr.status = ?'; params.push(status); }
  const rows = db.prepare(`${sql} ORDER BY pr.start_date DESC`).all(...params);
  const memberStmt = db.prepare(`SELECT p.id, p.slug, p.name_mk, p.name_en, p.hue, pm.role
                                 FROM project_members pm JOIN people p ON p.id = pm.person_id
                                 WHERE pm.project_id = ?`);
  res.json(rows.map(r => ({ ...r, members: memberStmt.all(r.id) })));
});

/* ---------------------------------------------------------- PUBLICATIONS */
content.get('/publications', (req, res) => {
  const { q = '', year, group, type, sort = 'year', order = 'desc', page = '1', limit = '10', openAccess } = req.query;
  const params = [];
  let where = ' WHERE 1=1';
  if (q) {
    where += ' AND (pub.title LIKE ? OR pub.authors LIKE ? OR pub.venue LIKE ? OR pub.keywords LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (year) { where += ' AND pub.year = ?'; params.push(Number(year)); }
  if (type) { where += ' AND pub.type = ?'; params.push(type); }
  if (openAccess === 'true') where += ' AND pub.open_access = 1';
  if (group) { where += ' AND g.slug = ?'; params.push(group); }

  const sortCol = { year: 'pub.year', citations: 'pub.citations', title: 'pub.title' }[sort] || 'pub.year';
  const dir = order === 'asc' ? 'ASC' : 'DESC';
  const per = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const p = Math.max(Number(page) || 1, 1);

  const base = ' FROM publications pub LEFT JOIN groups g ON g.id = pub.group_id' + where;
  const total = db.prepare(`SELECT COUNT(*) n${base}`).get(...params).n;
  const items = db.prepare(
    `SELECT pub.*, g.slug AS group_slug, g.name_mk AS group_name_mk, g.name_en AS group_name_en, g.accent${base}
     ORDER BY ${sortCol} ${dir}, pub.citations DESC LIMIT ? OFFSET ?`
  ).all(...params, per, (p - 1) * per);

  res.json({ items, total, page: p, pages: Math.max(Math.ceil(total / per), 1), limit: per });
});

content.get('/publications/facets', (_req, res) => {
  res.json({
    years: db.prepare('SELECT year, COUNT(*) n FROM publications GROUP BY year ORDER BY year DESC').all(),
    types: db.prepare('SELECT type, COUNT(*) n FROM publications GROUP BY type ORDER BY n DESC').all(),
    venues: db.prepare('SELECT venue, COUNT(*) n FROM publications GROUP BY venue ORDER BY n DESC LIMIT 10').all()
  });
});

/* -------------------------------------------------------------- DATASETS */
content.get('/datasets', (req, res) => {
  const { q = '', format, license } = req.query;
  let sql = 'SELECT * FROM datasets WHERE 1=1';
  const params = [];
  if (q) { sql += ' AND (title_mk LIKE ? OR title_en LIKE ? OR organism LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (format) { sql += ' AND format = ?'; params.push(format); }
  if (license) { sql += ' AND license = ?'; params.push(license); }
  res.json(db.prepare(`${sql} ORDER BY year DESC, downloads DESC`).all(...params));
});

content.get('/datasets/:slug', (req, res) => {
  const row = db.prepare('SELECT * FROM datasets WHERE slug = ?').get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(row);
});

content.get('/datasets/:slug/download', (req, res) => {
  const row = db.prepare('SELECT * FROM datasets WHERE slug = ?').get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'not_found' });
  db.prepare('UPDATE datasets SET downloads = downloads + 1 WHERE id = ?').run(row.id);
  const mk = req.query.lang === 'mk';
  const header = mk
    ? `# ${row.title_mk}\n# ${row.doi}  |  ${row.license}\n# Демонстрациски извадок — ГеномикаЛаб\n`
    : `# ${row.title_en}\n# ${row.doi}  |  ${row.license}\n# Demonstration excerpt — GenomikaLab\n`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${row.slug}-excerpt.csv"`);
  res.send(header + (row.preview_csv || ''));
});

/* ------------------------------------------------------------------ NEWS */
content.get('/news', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 50);
  res.json(db.prepare('SELECT * FROM news ORDER BY date DESC LIMIT ?').all(limit));
});

content.get('/news/:slug', (req, res) => {
  const row = db.prepare('SELECT * FROM news WHERE slug = ?').get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(row);
});

/* --------------------------------------------------------------- METRICS */
content.get('/metrics', (_req, res) => {
  res.json({
    totals: db.prepare(`SELECT
        (SELECT COUNT(*) FROM people) people,
        (SELECT COUNT(*) FROM publications) publications,
        (SELECT SUM(citations) FROM publications) citations,
        (SELECT COUNT(*) FROM projects_live WHERE status='active') active_projects,
        (SELECT COALESCE(SUM(budget_eur), 0) FROM projects_live WHERE status='active') active_funding,
        (SELECT COUNT(*) FROM datasets) datasets,
        (SELECT SUM(downloads) FROM datasets) dataset_downloads,
        (SELECT COUNT(*) FROM partners) partners`).get(),
    publicationsPerYear: db.prepare('SELECT year, COUNT(*) n, SUM(citations) citations FROM publications GROUP BY year ORDER BY year').all(),
    byGroup: db.prepare(`SELECT g.slug, g.name_mk, g.name_en, g.accent, COUNT(pub.id) n, COALESCE(SUM(pub.citations),0) citations
                         FROM groups g LEFT JOIN publications pub ON pub.group_id = g.id GROUP BY g.id`).all(),
    openAccessShare: db.prepare('SELECT open_access, COUNT(*) n FROM publications GROUP BY open_access').all(),
    partners: db.prepare('SELECT * FROM partners ORDER BY joint_papers DESC').all(),
    funding: db.prepare(`SELECT slug, title_mk, title_en, funder, budget_eur, start_date, end_date, status
                         FROM projects_live ORDER BY start_date`).all(),
    topCited: db.prepare('SELECT title, year, venue, citations, doi FROM publications ORDER BY citations DESC LIMIT 5').all()
  });
});

/* ------------------------------------------------- COLLABORATION NETWORK */
content.get('/network', (_req, res) => {
  const people = db.prepare('SELECT id, slug, name_mk, name_en, hue, seniority, group_id FROM people').all();
  const groups = db.prepare('SELECT id, slug, name_mk, name_en, accent FROM groups').all();
  const projects = db.prepare('SELECT id, slug, title_mk, title_en, group_id, status FROM projects_live').all();

  const nodes = [
    ...groups.map(g => ({ id: `g${g.id}`, kind: 'group', label_mk: g.name_mk, label_en: g.name_en, accent: g.accent, weight: 14 })),
    ...people.map(p => ({ id: `p${p.id}`, kind: 'person', slug: p.slug, label_mk: p.name_mk, label_en: p.name_en, hue: p.hue, seniority: p.seniority, weight: 8 })),
    ...projects.map(pr => ({ id: `r${pr.id}`, kind: 'project', slug: pr.slug, label_mk: pr.title_mk, label_en: pr.title_en, status: pr.status, weight: 10 }))
  ];

  const links = [];
  people.forEach(p => { if (p.group_id) links.push({ source: `p${p.id}`, target: `g${p.group_id}`, kind: 'affiliation', weight: 1 }); });
  projects.forEach(pr => { if (pr.group_id) links.push({ source: `r${pr.id}`, target: `g${pr.group_id}`, kind: 'owns', weight: 1 }); });
  db.prepare('SELECT project_id, person_id FROM project_members').all()
    .forEach(m => links.push({ source: `p${m.person_id}`, target: `r${m.project_id}`, kind: 'works_on', weight: 2 }));

  // Co-authorship strength between people
  const coauthor = db.prepare(`SELECT a.person_id AS a, b.person_id AS b, COUNT(*) AS n
    FROM publication_authors a JOIN publication_authors b
      ON a.publication_id = b.publication_id AND a.person_id < b.person_id
    GROUP BY a.person_id, b.person_id`).all();
  coauthor.forEach(c => links.push({ source: `p${c.a}`, target: `p${c.b}`, kind: 'coauthor', weight: c.n }));

  res.json({ nodes, links });
});

/* -------------------------------------------------------------- PARTNERS */
content.get('/partners', (_req, res) => {
  res.json(db.prepare('SELECT * FROM partners ORDER BY joint_papers DESC').all());
});
