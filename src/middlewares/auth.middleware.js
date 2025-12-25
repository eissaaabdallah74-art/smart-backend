// src/middlewares/auth.middleware.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';

  // نتوقع "Bearer <token>"
  const parts = authHeader.split(' ');
  const token = parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : null;

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // decoded: { id, email, role, position, iat, exp }
    req.user = decoded;
    next();
  } catch (err) {
    console.error('authMiddleware error:', err);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = authMiddleware;
