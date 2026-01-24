// src/routes/loans.routes.js
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth.middleware');
const loansController = require('../controllers/loans.controller');

const {
  requireOperationManagerOrSupervisor,
  requireOperationStaff,
} = require('../middlewares/role.helpers');

// كل endpoints هنا protected
router.use(authMiddleware);

// staff (operation + admin) — بس الكنترولر بيقفل على senior/junior عملياً
router.post('/', requireOperationStaff, loansController.createLoanRequest);
router.get('/my', requireOperationStaff, loansController.getMyLoanRequests);

// managers/supervisors/admin
router.get('/', requireOperationManagerOrSupervisor, loansController.getLoans);
router.get('/pending', requireOperationManagerOrSupervisor, loansController.getPendingLoans);

router.patch('/:id/approve', requireOperationManagerOrSupervisor, loansController.approveLoan);
router.patch('/:id/reject', requireOperationManagerOrSupervisor, loansController.rejectLoan);

module.exports = router;
