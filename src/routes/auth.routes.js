// src/routes/auth.routes.js
const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const {
  requireOperationManagerOrSupervisor,
} = require('../middlewares/role.helpers');

// Middleware بسيط للـ admin فقط
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Admin access only' });
}

// ===== Auth: Login =====
// POST /api/auth/login
router.post('/login', authController.login);

// ===== Admin: CRUD Accounts =====
// كل اللي تحت هنا محتاج token + admin

// GET /api/auth/users  + فلاتر اختيارية ?role=&active=&q=
router.get('/users', authMiddleware, requireAdmin, authController.getAllUsers);

// GET /api/auth/users/:id
router.get(
  '/users/:id',
  authMiddleware,
  requireAdmin,
  authController.getUserById
);

// POST /api/auth/users
router.post(
  '/users',
  authMiddleware,
  requireAdmin,
  authController.createUser
);

// PUT /api/auth/users/:id
router.put(
  '/users/:id',
  authMiddleware,
  requireAdmin,
  authController.updateUser
);

// DELETE /api/auth/users/:id
router.delete(
  '/users/:id',
  authMiddleware,
  requireAdmin,
  authController.deleteUser
);

// ===== Operation Manager/Supervisor + Admin: Operation Staff =====
// GET /api/auth/operation/staff?active=true
router.get(
  '/operation/staff',
  authMiddleware,
  requireOperationManagerOrSupervisor,
  authController.getOperationStaff
);

module.exports = router;
