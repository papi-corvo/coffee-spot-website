/* Removes staff rows that have no way to log in and are not used by any record.
   Usage:  node scripts/cleanup-staff.js           (preview only)
           node scripts/cleanup-staff.js --apply   (actually delete) */
const { db } = require('../src/db/db');

const apply = process.argv.includes('--apply');

const candidates = db.prepare(`
  SELECT id, name, role, created_at
  FROM staff
  WHERE (email IS NULL OR trim(email) = '')
    AND (employee_code IS NULL OR trim(employee_code) = '')
  ORDER BY id
`).all();

const usage = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM payments       WHERE staff_id  = @id) +
    (SELECT COUNT(*) FROM receipts       WHERE issued_by = @id) +
    (SELECT COUNT(*) FROM status_history WHERE staff_id  = @id) AS total
`);

if (!candidates.length) {
  console.log('Nothing to clean: every staff row has an email or an employee code.');
  process.exit(0);
}

const removable = [];
const kept = [];
for (const row of candidates) {
  const used = usage.get({ id: row.id }).total;
  if (used > 0) kept.push({ ...row, used });
  else removable.push(row);
}

console.log('Rows with no email and no employee code:');
for (const row of candidates) {
  const mark = removable.includes(row) ? 'DELETE' : 'KEEP  ';
  const used = usage.get({ id: row.id }).total;
  console.log(`  [${mark}] id=${row.id}  ${row.name} (${row.role})  linked records: ${used}`);
}

if (kept.length) {
  console.log('\nKept because past sales/history point at them. Reassign or accept them instead of deleting.');
}

if (!apply) {
  console.log(`\nPreview only. Re-run with --apply to delete ${removable.length} row(s).`);
  process.exit(0);
}

if (removable.length) {
  const del = db.prepare('DELETE FROM staff WHERE id = ?');
  db.transaction(() => {
    for (const row of removable) del.run(row.id);
  })();
  console.log(`\nDeleted ${removable.length} row(s).`);
}

console.log('\nStaff table now:');
for (const row of db.prepare('SELECT id, name, role, COALESCE(email, employee_code) AS login, active FROM staff ORDER BY id').all()) {
  console.log(`  id=${row.id}  ${row.name}  ${row.role}  login=${row.login || '(none)'}  active=${row.active}`);
}