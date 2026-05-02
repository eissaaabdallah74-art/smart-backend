// src/middlewares/role.helpers.js

/**
 * Maps HTTP methods to permission action keys
 * @param {string} method 
 * @returns {'view' | 'add' | 'edit' | 'delete'}
 */
function getActionFromMethod(method) {
  switch (method.toUpperCase()) {
    case 'POST': return 'create';
    case 'PUT':
    case 'PATCH': return 'edit';
    case 'DELETE': return 'delete';
    case 'GET':
    default:
      return 'view';
  }
}

function isOperationManagerOrSupervisor(user) {
  if (!user) return false;

  // لو Admin نعتبره أعلى من Manager/Supervisor
  if (user.role === 'admin') return true;

  return (
    user.role === 'operation' &&
    (user.position === 'manager' || user.position === 'supervisor')
  );
}

function isOperationSeniorOrJunior(user) {
  if (!user) return false;
  return (
    user.role === 'operation' &&
    (user.position === 'senior' || user.position === 'junior')
  );
}

// Manager / Supervisor في Operations أو Admin
function requireOperationManagerOrSupervisor(req, res, next) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (user.role === 'admin' || isOperationManagerOrSupervisor(user)) {
    return next();
  }

  return res
    .status(403)
    .json({ message: 'Operation manager/supervisor or admin only' });
}

// أي حد من قسم Operations + Admin
function requireOperationStaff(req, res, next) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (user.role === 'operation' || user.role === 'admin') {
    return next();
  }

  return res.status(403).json({ message: 'Operation staff only' });
}

// ============ NEW: Generic / HR / Finance (إضافات بدون كسر القديم) ============

function requireRoles(...roles) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    // 1. Role match (Admin always allowed)
    if (roles.includes(user.role) || user.role === 'admin') return next();
    
    // 2. Granular permission match
    const perms = user.permissions;
    if (perms && perms.pages) {
      const paths = Object.keys(perms.pages);
      const currentPath = req.originalUrl.replace('/api/', '').split('?')[0];
      const requiredAction = getActionFromMethod(req.method);
      
      const hasAccess = paths.some(p => {
        const isMatch = (currentPath.startsWith(p) || p.startsWith(currentPath));
        return isMatch && perms.pages[p][requiredAction];
      });
      
      if (hasAccess) return next();
    }

    return res.status(403).json({ 
      message: `Forbidden: Current role or permissions do not allow ${req.method} on this resource.` 
    });
  };
}

function requireAdmin(req, res, next) {
  const user = req.user;
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  if (user.role === 'admin') return next();
  return res.status(403).json({ message: 'Admin access only' });
}

function requireHRorAdmin(req, res, next) {
  const user = req.user;
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  if (user.role === 'admin' || user.role === 'hr') return next();

  // Granular check: Allow if user has ANY hr-related permission WITH appropriate action
  const perms = user.permissions?.pages || {};
  const requiredAction = getActionFromMethod(req.method);
  
  const hasHR = Object.keys(perms).some(k => 
    k.startsWith('hr/') && perms[k][requiredAction]
  );

  if (hasHR) return next();
  return res.status(403).json({ message: 'HR/Admin access only' });
}

function requireFinanceorAdmin(req, res, next) {
  const user = req.user;
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  if (user.role === 'admin' || user.role === 'finance') return next();

  // Granular check: Allow if user has ANY finance-related permission WITH appropriate action
  const perms = user.permissions?.pages || {};
  const requiredAction = getActionFromMethod(req.method);

  const hasFinance = Object.keys(perms).some(k => 
    k.startsWith('finance') && perms[k][requiredAction]
  );

  if (hasFinance) return next();
  return res.status(403).json({ message: 'Finance/Admin access only' });
}

module.exports = {
  // old exports (unchanged)
  isOperationManagerOrSupervisor,
  isOperationSeniorOrJunior,
  requireOperationManagerOrSupervisor,
  requireOperationStaff,

  // new exports
  requireRoles,
  requireAdmin,
  requireHRorAdmin,
  requireFinanceorAdmin,
};
