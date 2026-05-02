// src/middlewares/permission.middleware.js

/**
 * Middleware to check granular permissions and access expiration.
 * @param {string} page - The page/resource being accessed (e.g., 'drivers', 'interviews').
 * @param {string} action - The action being performed ('view', 'create', 'edit', 'delete').
 */
function requirePermission(page, action = 'view') {
  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // 1. Check for access expiration
    if (user.accessExpiresAt) {
      const expirationDate = new Date(user.accessExpiresAt);
      if (expirationDate < new Date()) {
        return res.status(403).json({ 
          message: 'Your access has expired. Please contact the administrator.',
          expired: true 
        });
      }
    }

    // 2. Admin bypass
    if (user.role === 'admin') {
      return next();
    }

    // 3. User must be active
    if (!user.isActive) {
      return res.status(403).json({ message: 'User account is inactive.' });
    }

    // 4. Check granular permissions
    // Expected structure in user.permissions: 
    // { "pages": { "drivers": { "view": true, "create": false, ... } } }
    const permissions = user.permissions;
    
    if (!permissions || !permissions.pages) {
        // If no permissions are set, fallback to role-based (optional, but safer for existing users)
        // For now, let's be strict if the middleware is used.
        return res.status(403).json({ message: `Access denied for page: ${page}` });
    }

    const pageConfig = permissions.pages[page];
    if (!pageConfig || !pageConfig[action]) {
      return res.status(403).json({ message: `You do not have permission to ${action} on ${page}.` });
    }

    next();
  };
}

module.exports = {
  requirePermission
};
