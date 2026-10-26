/* =====================================================================
   db/db.js — the ONLY file that opens the database.
   Everything else does:  const { db } = require('./db/db');
   On first load it creates the data file and runs any new migration
   from db/migrations/ (001_init.sql, 002_..., in order, once each).
   ===================================================================== */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const DB_FILE = process.env.COFFEESPOT_DB || path.join(__dirname, '..', 'data', 'coffeespot.db');
if (DB_FILE !== ':memory:') fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');   // safer + faster for a web server
db.pragma('foreign_keys = ON');    // SQLite ignores foreign keys unless you ask

function migrate() {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name       TEXT PRIMARY KEY,
    checksum   TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`);

  const dir = path.join(__dirname, 'migrations');
  const done = new Map(db.prepare('SELECT name, checksum FROM schema_migrations').all().map((r) => [r.name, r.checksum]));
  const applied = [];

  for (const file of fs.readdirSync(dir).filter((f) => /^\d+.*\.sql$/.test(f)).sort()) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');

    if (done.has(file)) {
      if (done.get(file) !== checksum) {
        throw new Error(`Migration ${file} was changed after it was applied. Do not edit it; add a new numbered file instead.`);
      }
      continue;
    }
    db.transaction(() => {            // all-or-nothing: a failed migration leaves no half-built tables
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (name, checksum) VALUES (?, ?)').run(file, checksum);
    })();
    applied.push(file);
  }
  return applied;
}

const applied = migrate();
if (applied.length) console.log('[db] applied migrations:', applied.join(', '));

module.exports = { db, migrate, DB_FILE };