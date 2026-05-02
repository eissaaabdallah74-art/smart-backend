// src/routes/auth.routes.js
const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const {
  requireOperationManagerOrSupervisor,
} = require("../middlewares/role.helpers");

// Middleware بسيط للـ admin فقط
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === "admin") {
    return next();
  }
  return res.status(403).json({ message: "Admin access only" });
}

// POST /api/auth/login
router.post("/login", authController.login);

// GET /api/auth/me (Moved to top for priority)
router.get("/me", authMiddleware, authController.getMe);

// ===== Admin: CRUD Accounts =====
// كل اللي تحت هنا محتاج token + admin

// GET /api/auth/users  + فلاتر اختيارية ?role=&active=&q=&includeEmployee=true
router.get("/users", authMiddleware, requireAdmin, authController.getAllUsers);

// GET /api/auth/users/:id/target-performance
router.get(
  "/users/:id/target-performance",
  authMiddleware,
  requireAdmin,
  authController.getUserPerformance
);

// GET /api/auth/users/:id   + optional ?includeEmployee=true
router.get(
  "/users/:id",
  authMiddleware,
  requireAdmin,
  authController.getUserById
);

// POST /api/auth/users   (+ optional employeeId)
router.post(
  "/users",
  authMiddleware,
  requireAdmin,
  authController.createUser
);

// PUT /api/auth/users/:id   (+ optional employeeId)
router.put(
  "/users/:id",
  authMiddleware,
  requireAdmin,
  authController.updateUser
);

// DELETE /api/auth/users/:id
router.delete(
  "/users/:id",
  authMiddleware,
  requireAdmin,
  authController.deleteUser
);



// ===== Admin: Employees dropdown for Users =====
// GET /api/auth/employees/available?q=&isWorking=&department=&includeLinked=
router.get(
  "/employees/available",
  authMiddleware,
  requireAdmin,
  authController.getAvailableEmployees
);

// ===== Operation Manager/Supervisor + Admin: Operation Staff =====
// GET /api/auth/operation/staff?active=true
router.get(
  "/operation/staff",
  authMiddleware,
  requireOperationManagerOrSupervisor,
  authController.getOperationStaff
);

module.exports = router;
