const express = require('express');
const router = express.Router();
const controller = require('../controllers/driver-portal.controller');

router.get('/profile', controller.getProfile);
router.get('/financial-requests', controller.getFinancialRequestsHistory);
router.post('/financial-requests', controller.createFinancialRequest);

router.get('/loans', controller.getLoans);
router.post('/loans', controller.createLoan);

router.get('/complaints', controller.getComplaints);
router.post('/complaints', controller.createComplaint);

router.get('/payroll', controller.getPayrollBreakdowns);

router.get('/notifications', controller.getNotifications);
router.post('/notifications/:id/read', controller.markNotificationRead);

module.exports = router;
