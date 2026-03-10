// src/middlewares/client-scope.helpers.js

function canSeeAllClients(user) {
  if (!user) return false;

  // admin + crm + أي manager يشوفوا الكل
  if (user.role === 'admin') return true;
  if (user.role === 'crm') return true;
  if (user.position === 'manager') return true;

  return false;
}

function applyClientScopeWhere(where, user) {
  // where: object by reference
  if (!canSeeAllClients(user)) {
    where.account_manager_id = user.id; // field في DB
  }
  return where;
}

module.exports = {
  canSeeAllClients,
  applyClientScopeWhere,
};