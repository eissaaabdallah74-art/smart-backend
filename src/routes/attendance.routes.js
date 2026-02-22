// src/routes/attendance.routes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const { requireHRorAdmin } = require("../middlewares/role.helpers");
const attendanceController = require("../controllers/attendance.controller");

// HR/Admin only
router.use(authMiddleware, requireHRorAdmin);

// import
router.post(
  "/import",
  attendanceController.uploadMiddleware,
  attendanceController.importSheet
);

router.get("/imports", attendanceController.listImports);
router.get("/monthly-summary", attendanceController.getMonthlySummary);

// unmatched + mapping
router.get("/unmatched", attendanceController.getUnmatchedRows);
router.post("/mapping", attendanceController.upsertMappingFromBody);
router.put("/mapping/:employeeId", attendanceController.upsertMapping);

// employee month details + exception toggle
router.get("/employee/:employeeId", attendanceController.getEmployeeMonthDetails);
router.patch(
  "/employee/:employeeId/items/:itemId",
  attendanceController.toggleEmployeeItemException
);

// recompute
router.post("/recompute", attendanceController.recomputeMonth);

// manual adjustment items
router.post("/employee/:employeeId/manual", attendanceController.addEmployeeManualItem);
router.delete(
  "/employee/:employeeId/manual/:manualId",
  attendanceController.deleteEmployeeManualItem
);

module.exports = router;
