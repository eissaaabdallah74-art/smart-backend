// src/routes/calls.routes.js
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth.middleware');
const {
  requireOperationManagerOrSupervisor,
  requireOperationStaff,
} = require('../middlewares/role.helpers');

const callController = require('../controllers/call.controller');

// كل routes دي محتاجة token
router.use(authMiddleware);

// ===== Operation Staff list (Manager/Supervisor/Admin) =====
router.get(
  '/operation-staff',
  requireOperationManagerOrSupervisor,
  callController.getOperationStaff
);

// ===== Manager / Supervisor / Admin Views =====

// GET /api/calls → list + filters + pagination
router.get(
  '/',
  requireOperationManagerOrSupervisor,
  callController.getAllCallsForManager
);

// GET /api/calls/by-assignee/:id
router.get(
  '/by-assignee/:id',
  requireOperationManagerOrSupervisor,
  callController.getCallsByAssignee
);

// POST /api/calls → create one
router.post(
  '/',
  requireOperationManagerOrSupervisor,
  callController.createCall
);

// POST /api/calls/import → bulk import
router.post(
  '/import',
  requireOperationManagerOrSupervisor,
  callController.bulkImportCalls
);

// PATCH /api/calls (بدون id) → error
router.patch('/', (req, res) =>
  res.status(400).json({ message: 'Missing call id' })
);

// PATCH /api/calls/:id → Manager/Supervisor/Admin أو Assignee (Operation)
router.patch('/:id', requireOperationStaff, callController.updateCall);

// DELETE /api/calls/:id → manager/supervisor/admin only
router.delete(
  '/:id',
  requireOperationManagerOrSupervisor,
  callController.deleteCall
);

// ===== Senior / Junior (او أي Operation) =====

// GET /api/calls/my/all → calls بتاعة اليوزر نفسه
router.get('/my/all', requireOperationStaff, callController.getMyCalls);


module.exports = router;
