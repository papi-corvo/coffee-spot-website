const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'coffee-spot-secret-key';

function verifyAdmin(req, res, next) {
  const token = req.cookies.auth_token;
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // The Bouncer Check: Are they an admin?
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden. Admin access required.' });
    }

    req.staff = decoded; 
    next(); 
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

module.exports = { verifyAdmin };