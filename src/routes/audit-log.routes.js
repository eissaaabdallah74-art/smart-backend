// src/routes/audit-log.routes.js
const express = require('express');
const router = express.Router();
const auditLogsController = require('../controllers/audit-log.controller');

// GET /api/audit-logs?entity=Interview&entityId=123&limit=5
router.get('/', auditLogsController.listAuditLogs);

module.exports = router;
