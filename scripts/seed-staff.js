const bcrypt = require('bcryptjs');
const { db } = require('../src/db/db');

const rawPin = '1234'; // The PIN for testing
const pinHash = bcrypt.hashSync(rawPin, 10); // 10 salt rounds

try {
  db.prepare(`
    INSERT INTO staff (name, role, employee_code, pin_hash) 
    VALUES (?, ?, ?, ?)
  `).run('Maria S.', 'admin', 'EMP-001', pinHash);
  
  console.log('✅ Test staff created!');
  console.log('Employee Code: EMP-001');
  console.log('PIN: 1234');
} catch (error) {
  console.log('⚠️ Staff might already exist:', error.message);
}