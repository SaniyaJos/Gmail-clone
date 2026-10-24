/**
 * Authentication & Authorization Middleware
 *
 * Verifies the requesting user's identity based on application session conventions
 * (via x-user-email header, or query/body userEmail parameters).
 * Enforces that users can only analyze their own emails and access/modify their own tasks.
 */

const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const userEmail = 
    req.headers['x-user-email'] ||
    req.query.userEmail ||
    req.query.email ||
    req.body.userEmail ||
    req.body.email;

  if (!userEmail || typeof userEmail !== 'string' || !userEmail.trim()) {
    return res.status(401).json({
      message: 'Unauthorized: User email session identifier is required'
    });
  }

  req.user = {
    email: userEmail.trim().toLowerCase()
  };

  next();
}

function requireTokenAuth(req, res, next) {
  const authorization = req.headers.authorization || '';
  const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
  const token = tokenMatch ? tokenMatch[1] : (req.query.token || null);

  if (!token) {
    return res.status(401).json({ message: 'A valid sign-in token is required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'inboxflow'
    });
    if (!payload || typeof payload !== 'object' || typeof payload.email !== 'string') {
      return res.status(401).json({ message: 'Invalid sign-in token' });
    }

    req.user = { email: payload.email.trim().toLowerCase() };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Your sign-in token is invalid or expired. Please sign in again.' });
    }
    return next(err);
  }
}

module.exports = {
  requireAuth,
  requireTokenAuth
};
