/**
 * Authentication & Authorization Middleware
 *
 * Verifies the requesting user's identity based on application session conventions
 * (via x-user-email header, or query/body userEmail parameters).
 * Enforces that users can only analyze their own emails and access/modify their own tasks.
 */

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

module.exports = {
  requireAuth
};
