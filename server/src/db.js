import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.DB_PATH || join(__dirname, '..', 'genomika.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function migrate() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'researcher',
    person_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name_mk TEXT NOT NULL, name_en TEXT NOT NULL,
    tagline_mk TEXT, tagline_en TEXT,
    description_mk TEXT, description_en TEXT,
    accent TEXT NOT NULL DEFAULT 'lime',
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
