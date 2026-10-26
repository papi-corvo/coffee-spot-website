/* db/settings.js — read shop settings (name, address, TIN, VAT, discount rates ...) from the database. */
const { db } = require('./db');

function get(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}
function getInt(key, fallback = 0) {
  const n = parseInt(get(key), 10);
  return Number.isFinite(n) ? n : fallback;
}
function all() {
  return Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]));
}
module.exports = { get, getInt, all };