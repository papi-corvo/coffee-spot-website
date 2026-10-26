/* Run:  node db/check.js     Shows that the database exists and lists its tables. */
const { db, DB_FILE } = require('../src/db/db');

console.log('Database file :', DB_FILE);
console.log('Journal mode  :', db.pragma('journal_mode', { simple: true }));
console.log('Foreign keys  :', db.pragma('foreign_keys', { simple: true }) ? 'ON' : 'OFF');
console.log('Migrations    :', db.prepare('SELECT name FROM schema_migrations ORDER BY name').all().map((r) => r.name).join(', '));
console.log('\nTables:');
for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()) {
  const n = db.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).get().n;
  console.log('  ' + name.padEnd(22) + n + ' row(s)');
}