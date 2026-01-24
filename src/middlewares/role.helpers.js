// src/middlewares/role.helpers.js

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

    if (roles.includes(user.role)) return next();
    return res.status(403).json({ message: 'Forbidden' });
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
  return res.status(403).json({ message: 'HR/Admin access only' });
}

function requireFinanceorAdmin(req, res, next) {
  const user = req.user;
  if (!user) return res.status(401).json({ message: 'Unauthorized' });

  if (user.role === 'admin' || user.role === 'finance') return next();
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
