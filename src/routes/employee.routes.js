// src/routes/employee.routes.js
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth.middleware');
const employeeController = require('../controllers/employee.controller');
const { requireHRorAdmin, requireFinanceorAdmin } = require('../middlewares/role.helpers');

// ============ Employees (HR/Admin) ============

// GET /api/employees?limit=&offset=&q=&department=&isWorking=&hasAccount=&includeAccount=
router.get('/', authMiddleware, requireHRorAdmin, employeeController.getEmployees);

// POST /api/employees
router.post('/', authMiddleware, requireHRorAdmin, employeeController.createEmployee);

// GET /api/employees/:id
router.get('/:id', authMiddleware, requireHRorAdmin, employeeController.getEmployeeById);

// PUT /api/employees/:id
router.put('/:id', authMiddleware, requireHRorAdmin, employeeController.updateEmployee);

// ============ Create Account for Employee (HR/Admin) ============
// POST /api/employees/:id/create-account
router.post('/:id/create-account', authMiddleware, requireHRorAdmin, employeeController.createAccountForEmployee);

// ============ Documents (HR/Admin) ============
// GET /api/employees/:id/documents
router.get('/:id/documents', authMiddleware, requireHRorAdmin, employeeController.listDocuments);

// PUT /api/employees/:id/documents  {documents:[...]}
router.put('/:id/documents', authMiddleware, requireHRorAdmin, employeeController.upsertDocuments);

// ============ Education (HR/Admin) ============
// GET /api/employees/:id/education
router.get('/:id/education', authMiddleware, requireHRorAdmin, employeeController.listEducation);

// PUT /api/employees/:id/education  {educations:[...]}
router.put('/:id/education', authMiddleware, requireHRorAdmin, employeeController.replaceEducation);

// ============ Evaluation (HR/Admin) ============
// POST /api/employees/:id/evaluation  {year, performanceRating, commitmentGrade}
router.post('/:id/evaluation', authMiddleware, requireHRorAdmin, employeeController.upsertEvaluation);

// ============ Payroll/Insurance (Finance/Admin) ============
// GET /api/employees/:id/payroll
router.get('/:id/payroll', authMiddleware, requireFinanceorAdmin, employeeController.getPayroll);

// PUT /api/employees/:id/payroll
router.put('/:id/payroll', authMiddleware, requireFinanceorAdmin, employeeController.upsertPayroll);

module.exports = router;
