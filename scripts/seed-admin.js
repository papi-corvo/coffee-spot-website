const bcrypt = require('bcryptjs');
const { db } = require('../src/db/db');

const email = 'owner@coffeespot.com';
const rawPassword = 'admin123'; 

// Hash the password securely
const passwordHash = bcrypt.hashSync(rawPassword, 10);

try {
  // Check if admin already exists
  const existing = db.prepare('SELECT id FROM staff WHERE email = ?').get(email);
  if (existing) {
    console.log('Admin account already exists!');
  } else {
    db.prepare(`
      INSERT INTO staff (name, role, email, password_hash) 
      VALUES (?, ?, ?, ?)
    `).run('Owner Admin', 'admin', email, passwordHash);
    
    console.log('Test Admin created successfully!');
    console.log('Email:', email);
    console.log('Password:', rawPassword);
  }
} catch (error) {
  console.log('Error creating admin:', error.message);
}