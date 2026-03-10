const express = require('express');
const router = express.Router();

const driverLoanController = require('../controllers/driver-loan.controller');

// GET /api/driver-loans
router.get('/', driverLoanController.getAllDriverLoans);

// GET /api/driver-loans/:id
router.get('/:id', driverLoanController.getDriverLoanById);

// POST /api/driver-loans
router.post('/', driverLoanController.createDriverLoan);

// PUT /api/driver-loans/:id
router.put('/:id', driverLoanController.updateDriverLoan);

// DELETE /api/driver-loans/:id
router.delete('/:id', driverLoanController.deleteDriverLoan);

module.exports = router;