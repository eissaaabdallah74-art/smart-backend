// src/routes/insurance-form2.routes.js
const express = require('express');
const router = express.Router();
const insuranceForm2Controller = require('../controllers/insurance-form2.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { requireHRorAdmin } = require('../middlewares/role.helpers');

router.use(authMiddleware);
router.use(requireHRorAdmin);

router.get('/status', insuranceForm2Controller.getEmployeesForm2Status);
router.post('/toggle', insuranceForm2Controller.toggleEmployeeForm2);

module.exports = router;
