// src/routes/report.routes.js
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth.middleware');
const { requireOperationStaff } = require('../middlewares/role.helpers');

const reportController = require('../controllers/report.controller');

// كل routes محتاجة token
router.use(authMiddleware);

// calls/interviews report (operation)
router.get(
  '/operation-calls-interviews',
  requireOperationStaff,
  reportController.getOperationCallsInterviewsReport
);

// achievements report (operation)
router.get(
  '/operation-achievements',
  requireOperationStaff,
  reportController.getOperationAchievementsReport
);

// account managers fulfillment report
// صلاحياته جوه controller (admin/manager/supervisor أو crm self)
router.get(
  '/account-managers-fulfillment',
  reportController.getAccountManagersFulfillmentReport
);

module.exports = router;
