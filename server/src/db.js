import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.DB_PATH || join(__dirname, '..', 'genomika.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/*
 * Schema versioning. CREATE TABLE IF NOT EXISTS builds a fresh database but can
 * never change an existing one, and the database lives on a volume that
 * survives every redeploy. Each change after the baseline is appended to
 * MIGRATIONS and runs once, in order, recorded in SQLite's own user_version.
 */
const MIGRATIONS = [
  // 1 — baseline: the schema created below. Never edited; later changes are new steps.
  () => {},

  // 2 — interests in both languages; uploaded CVs keep their original name
  //     apart from the storage key; who is trained on which instrument; and
  //     projects lose the stored status that projects_live now derives.
  () => db.exec(`
    ALTER TABLE people RENAME COLUMN interests TO interests_mk;
    ALTER TABLE people ADD COLUMN interests_en TEXT;
    ALTER TABLE applications ADD COLUMN cv_original_name TEXT;
    CREATE TABLE instrument_training (
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      instrument_id INTEGER NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
      granted_at    TEXT NOT NULL DEFAULT (date('now', 'localtime')),
      PRIMARY KEY (user_id, instrument_id)
    );
    ALTER TABLE projects DROP COLUMN status;
  `)
];

export function migrate() {
  createBaseline();
  const current = db.pragma('user_version', { simple: true });
  for (let version = current; version < MIGRATIONS.length; version++) {
    db.transaction(() => {
      MIGRATIONS[version]();
      db.pragma(`user_version = ${version + 1}`);
    })();
  }
}

function createBaseline() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'researcher',
    person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name_mk TEXT NOT NULL, name_en TEXT NOT NULL,
    tagline_mk TEXT, tagline_en TEXT,
    description_mk TEXT, description_en TEXT,
    accent TEXT NOT NULL DEFAULT 'green',
    founded INTEGER
  );

  CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name_mk TEXT NOT NULL, name_en TEXT NOT NULL,
    role_mk TEXT NOT NULL, role_en TEXT NOT NULL,
    seniority TEXT NOT NULL DEFAULT 'researcher',
    group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
    email TEXT, orcid TEXT, github TEXT,
    bio_mk TEXT, bio_en TEXT,
    interests TEXT,
    joined_year INTEGER,
    hue INTEGER NOT NULL DEFAULT 140
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title_mk TEXT NOT NULL, title_en TEXT NOT NULL,
    abstract_mk TEXT, abstract_en TEXT,
    group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active',
    funder TEXT, grant_code TEXT,
    budget_eur INTEGER,
    start_date TEXT, end_date TEXT
  );

  CREATE TABLE IF NOT EXISTS project_members (
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    role TEXT,
    PRIMARY KEY (project_id, person_id)
  );

  CREATE TABLE IF NOT EXISTS publications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    authors TEXT NOT NULL,
    venue TEXT NOT NULL,
    year INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'article',
    doi TEXT,
    citations INTEGER NOT NULL DEFAULT 0,
    open_access INTEGER NOT NULL DEFAULT 1,
    abstract TEXT,
    group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
    keywords TEXT
  );

  CREATE TABLE IF NOT EXISTS publication_authors (
    publication_id INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
    person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (publication_id, person_id)
  );

  CREATE TABLE IF NOT EXISTS datasets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title_mk TEXT NOT NULL, title_en TEXT NOT NULL,
    description_mk TEXT, description_en TEXT,
    format TEXT NOT NULL,
    size_mb REAL NOT NULL,
    license TEXT NOT NULL,
    year INTEGER NOT NULL,
    downloads INTEGER NOT NULL DEFAULT 0,
    doi TEXT,
    organism TEXT,
    rows_count INTEGER,
    preview_csv TEXT
  );

  CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title_mk TEXT NOT NULL, title_en TEXT NOT NULL,
    excerpt_mk TEXT, excerpt_en TEXT,
    body_mk TEXT, body_en TEXT,
    date TEXT NOT NULL,
    tag TEXT NOT NULL DEFAULT 'news'
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title_mk TEXT NOT NULL, title_en TEXT NOT NULL,
    description_mk TEXT, description_en TEXT,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    location TEXT NOT NULL,
    speaker TEXT,
    affiliation TEXT,
    capacity INTEGER NOT NULL DEFAULT 40,
    kind TEXT NOT NULL DEFAULT 'seminar'
  );

  CREATE TABLE IF NOT EXISTS rsvps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(event_id, email)
  );

  CREATE TABLE IF NOT EXISTS instruments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name_mk TEXT NOT NULL, name_en TEXT NOT NULL,
    description_mk TEXT, description_en TEXT,
    category TEXT NOT NULL,
    location TEXT NOT NULL,
    hourly_rate INTEGER NOT NULL DEFAULT 0,
    requires_training INTEGER NOT NULL DEFAULT 0,
    open_from INTEGER NOT NULL DEFAULT 8,
    open_to INTEGER NOT NULL DEFAULT 20,
    max_hours INTEGER NOT NULL DEFAULT 4,
    status TEXT NOT NULL DEFAULT 'available'
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instrument_id INTEGER NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_name TEXT NOT NULL,
    user_email TEXT NOT NULL,
    date TEXT NOT NULL,
    start_hour INTEGER NOT NULL,
    end_hour INTEGER NOT NULL,
    purpose TEXT,
    status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(instrument_id, date);

  CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title_mk TEXT NOT NULL, title_en TEXT NOT NULL,
    kind TEXT NOT NULL,
    group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
    description_mk TEXT, description_en TEXT,
    requirements_mk TEXT, requirements_en TEXT,
    deadline TEXT NOT NULL,
    is_open INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    motivation TEXT NOT NULL,
    cv_filename TEXT,
    cv_size INTEGER,
    status TEXT NOT NULL DEFAULT 'received',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    handled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  /*
   * A project's status follows from its dates. Storing it meant the stored
   * value went stale on its own — a project kept saying "active" months after
   * it ended. Every read goes through this view instead.
   */
  DROP VIEW IF EXISTS projects_live;
  CREATE VIEW projects_live AS
    SELECT id, slug, title_mk, title_en, abstract_mk, abstract_en, group_id,
           funder, grant_code, budget_eur, start_date, end_date,
           CASE WHEN date('now', 'localtime') < start_date THEN 'planned'
                WHEN date('now', 'localtime') > end_date   THEN 'completed'
                ELSE 'active' END AS status
    FROM projects;

  CREATE TABLE IF NOT EXISTS partners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    joint_papers INTEGER NOT NULL DEFAULT 1
  );
  `);
}
