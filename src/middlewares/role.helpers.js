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

module.exports = {
  isOperationManagerOrSupervisor,
  isOperationSeniorOrJunior,
  requireOperationManagerOrSupervisor,
  requireOperationStaff,
};
