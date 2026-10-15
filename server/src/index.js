import { db, migrate } from './db.js';
import { createApp } from './app.js';

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

createApp().listen(PORT, () => {
  console.log(`GenomikaLab API  →  http://localhost:${PORT}/api/health`);
});
