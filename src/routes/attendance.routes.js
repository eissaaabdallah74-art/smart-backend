const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth.middleware');
const { requireHRorAdmin } = require('../middlewares/role.helpers');

const attendanceController = require('../controllers/attendance.controller');

// All attendance endpoints are HR/Admin for now (salary view guarded inside controller)
router.use(authMiddleware, requireHRorAdmin);

// import
router.post(
  '/import',
  attendanceController.uploadMiddleware,
  attendanceController.importSheet
);

router.get('/imports', attendanceController.listImports);
router.get('/monthly-summary', attendanceController.getMonthlySummary);

// ✅ NEW: unmatched rows (mapping screen depends on it)
router.get('/unmatched', attendanceController.getUnmatchedRows);

// ✅ NEW: frontend-friendly mapping endpoint
router.post('/mapping', attendanceController.upsertMappingFromBody);

// keep old endpoint (backward compatible)
router.put('/mapping/:employeeId', attendanceController.upsertMapping);

// employee month details
router.get('/employee/:employeeId', attendanceController.getEmployeeMonthDetails);

// ✅ NEW: toggle exception for an auto item (AttendanceDay)
router.patch('/employee/:employeeId/items/:itemId', attendanceController.toggleEmployeeItemException);

// ✅ NEW: recompute month for latest done import
router.post('/recompute', attendanceController.recomputeMonth);

// excuses
router.post('/excuses', attendanceController.createExcuse);
router.put('/excuses/:id', attendanceController.updateExcuse);
router.get('/excuses', attendanceController.listExcuses);


// ✅ NEW: manual adjustment items
router.post('/employee/:employeeId/manual', attendanceController.addEmployeeManualItem);
router.delete('/employee/:employeeId/manual/:manualId', attendanceController.deleteEmployeeManualItem);


module.exports = router;
