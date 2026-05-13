const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payroll.controller');
const payrollSettingController = require('../controllers/payroll-setting.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Protect all routes
router.use(authMiddleware);

router.get('/list', payrollController.getPayrollList);
router.post('/update', payrollController.updatePayroll);
router.post('/calculate', payrollController.calculatePreview);

// Settings
router.get('/settings', payrollSettingController.getSettings);
router.put('/settings', payrollSettingController.updateSettings);
router.post('/settings/reset', payrollSettingController.resetDefaults);

module.exports = router;
