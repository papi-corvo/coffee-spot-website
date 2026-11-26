const jwt = require('jsonwebtoken');
const { db } = require('../db/db');

function verifyToken(req, res, next) {
  const token = req.cookies.auth_token;
  if (!token) {
    return res.status(401).json({ error: 'Access denied. Please log in.' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET is missing. Add it to .env and restart the server.');
    return res.status(500).json({ error: 'Server is not configured for logins.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }

  const staff = db.prepare('SELECT id, name, role, active FROM staff WHERE id = ?').get(decoded.id);
  if (!staff) {
    return res.status(401).json({ error: 'This account no longer exists. Please log in again.' });
  }
  if (staff.active !== 1) {
    return res.status(403).json({ error: 'This account has been deactivated.' });
  }

  req.staff = { id: staff.id, name: staff.name, role: staff.role };
  next();
}

module.exports = { verifyToken };