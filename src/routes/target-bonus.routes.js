// src/routes/target-bonus.routes.js
const express = require('express');
const router = express.Router();

const targetBonusController = require('../controllers/target-bonus.controller');
const { requireHRorAdmin, requireOperationOrAdmin } = require('../middlewares/role.helpers');

// Routes for target bonuses (Admin/HR/Operation can view and evaluate, Admin/HR can modify)
router.get('/', targetBonusController.getAllRules);
router.post('/', requireHRorAdmin, targetBonusController.createRule);
router.put('/:id', requireHRorAdmin, targetBonusController.updateRule);
router.delete('/:id', requireHRorAdmin, targetBonusController.deleteRule);
router.get('/evaluate/:id', targetBonusController.evaluateRule);

module.exports = router;
