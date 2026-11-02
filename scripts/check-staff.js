const { db } = require('../src/db/db');
const staff = db.prepare('SELECT * FROM staff').all();
console.log(staff);