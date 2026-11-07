const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db/db');
const { verifyAdmin } = require('../middleware/adminMiddleware');

const JWT_SECRET = process.env.JWT_SECRET || 'coffee-spot-secret-key';

router.post('/login', (req, res) => {
  try {
    const { employeeCode, pin } = req.body;

    if (!employeeCode || !pin) {
      return res.status(400).json({ error: 'Employee ID and PIN are required.' });
    }

    // Find staff by employee code
    const staff = db.prepare('SELECT * FROM staff WHERE employee_code = ? AND active = 1').get(employeeCode);
    if (!staff) {
      return res.status(401).json({ error: 'Invalid Employee ID or PIN.' });
    }

    // Compare provided PIN with hashed PIN
    const isMatch = bcrypt.compareSync(pin, staff.pin_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid Employee ID or PIN.' });
    }

    // Generate JWT token (expires in 12 hours)
    const token = jwt.sign(
      { id: staff.id, name: staff.name, role: staff.role },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    // Set token as HttpOnly cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 12 * 60 * 60 * 1000 // 12 hours
    });

    res.json({ 
      message: 'Login successful', 
      staff: { name: staff.name, role: staff.role } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST: Admin Login (Email + Password)
router.post('/admin-login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Find admin by email
    const admin = db.prepare('SELECT * FROM staff WHERE email = ? AND role = ? AND active = 1').get(email, 'admin');
    if (!admin) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Compare password
    const isMatch = bcrypt.compareSync(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: admin.id, name: admin.name, role: admin.role },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    // Set cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 12 * 60 * 60 * 1000
    });

    res.json({ message: 'Admin login successful', staff: { name: admin.name, role: admin.role } });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET: Check if the current user is a valid Admin
router.get('/me', verifyAdmin, (req, res) => {
  // If they reach here, the middleware verified they are an admin
  res.json({ staff: req.staff });
});

module.exports = router;