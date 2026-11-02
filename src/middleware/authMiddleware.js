const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'coffee-spot-secret-key';

function verifyToken(req, res, next) {
  // Read the token from the HttpOnly cookie
  const token = req.cookies.auth_token;
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. Please log in.' });
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    req.staff = decoded; // Attach staff info so we know who is making the request
    next(); // Let them in!
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

module.exports = { verifyToken };