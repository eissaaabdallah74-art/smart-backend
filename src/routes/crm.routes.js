// src/routes/crm.routes.js
const express = require('express');
const router = express.Router();
const crmController = require('../controllers/crm.controller');
const { requireRoles } = require('../middlewares/role.helpers');

router.use(requireRoles('admin', 'crm'));

router.get('/day1-exceptions', crmController.getDay1Exceptions);
router.post('/day1-exceptions/:id/approve', crmController.approveDay1Exception);
router.post('/day1-exceptions/:id/reject', crmController.rejectDay1Exception);

module.exports = router;
