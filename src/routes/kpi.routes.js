// src/routes/kpi.routes.js
const express = require('express');
const router = express.Router();
const kpiController = require('../controllers/kpi.controller');
const protect = require('../middlewares/auth.middleware');

// All KPI routes should be protected
router.use(protect);

// Get all available KPI Elements
router.get('/elements', kpiController.getAllKpiElements);

// Get a specific user's KPI configuration
router.get('/user-config/:authUserId', kpiController.getUserKpiConfig);

// Update/Set a specific user's KPI configuration (Admin/HR only ideally, but we rely on protect middleware for now)
router.post('/user-config/:authUserId', kpiController.updateUserKpiConfig);

// Submit manual evaluation (e.g. Vote)
router.post('/evaluate-manual', kpiController.submitManualEvaluation);

// Calculate monthly KPI for a user
router.get('/calculate/:authUserId', kpiController.calculateMonthlyKpi);

// Update KPI Element (Admin only ideally)
router.put('/elements/:id', kpiController.updateKpiElement);

// Create KPI Element
router.post('/elements', kpiController.createKpiElement);

// Delete KPI Element
router.delete('/elements/:id', kpiController.deleteKpiElement);

module.exports = router;
