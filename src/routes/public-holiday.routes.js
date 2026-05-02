// src/routes/public-holiday.routes.js
const express = require("express");
const router = express.Router();
const controller = require("../controllers/public-holiday.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireHRorAdmin } = require("../middlewares/role.helpers");

// All routes require HR or Admin
router.get("/", authMiddleware, requireHRorAdmin, controller.listHolidays);
router.post("/", authMiddleware, requireHRorAdmin, controller.createHoliday);
router.delete("/:id", authMiddleware, requireHRorAdmin, controller.deleteHoliday);

module.exports = router;
