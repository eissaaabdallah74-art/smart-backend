// src/routes/zkteco.routes.js
const express = require("express");
const router = express.Router();
const zktecoController = require("../controllers/zkteco.controller");
const verifyToken = require("../middlewares/auth.middleware");
const { requireRoles } = require("../middlewares/role.helpers");

// Devices Management
router.post("/devices", verifyToken, requireRoles("admin"), zktecoController.createDevice);
router.get("/devices", verifyToken, requireRoles("admin", "hr", "operation"), zktecoController.getDevices);
router.patch("/devices/:id", verifyToken, requireRoles("admin"), zktecoController.updateDevice);
router.delete("/devices/:id", verifyToken, requireRoles("admin"), zktecoController.deleteDevice);

// ZKTeco Sync Actions
router.post("/devices/:id/test-connection", verifyToken, requireRoles("admin", "hr"), zktecoController.testConnection);
router.post("/devices/:id/sync-users", verifyToken, requireRoles("admin", "hr"), zktecoController.syncUsers);
router.post("/devices/:id/sync-logs", verifyToken, requireRoles("admin", "hr"), zktecoController.syncLogs);
router.post("/devices/:id/sync-all", verifyToken, requireRoles("admin", "hr"), zktecoController.syncAll);

// Data Access
router.get("/device-users", verifyToken, requireRoles("admin", "hr", "operation"), zktecoController.getDeviceUsers);
router.get("/raw-logs", verifyToken, requireRoles("admin", "hr", "operation"), zktecoController.getRawLogs);
router.get("/daily-summary", verifyToken, requireRoles("admin", "hr", "operation"), zktecoController.getDailySummary);

module.exports = router;
