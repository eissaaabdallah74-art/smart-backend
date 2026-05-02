const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payroll.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { requireFinanceorAdmin } = require('../middlewares/role.helpers');

router.use(authMiddleware, requireFinanceorAdmin);

router.get('/', payrollController.getAllPayrolls);
router.post('/generate', payrollController.generatePayroll);
router.post('/:id/pay', payrollController.markAsPaid);

module.exports = router;
