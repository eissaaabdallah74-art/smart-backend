// src/routes/drivers.routes.js
const express = require('express');
const router = express.Router();

const driverController = require('../controllers/driver.controller');

// GET /api/drivers
router.get('/', driverController.getAllDrivers);

// GET /api/drivers/blacklist/all
router.get('/blacklist/all', driverController.getBlacklistedDrivers);

// POST /api/drivers/:id/blacklist
router.post('/:id/blacklist', driverController.toggleBlacklist);

// ✅ POST /api/drivers/sync-from-interviews
router.post('/sync-from-interviews', driverController.syncDriversFromInterviews);

// POST /api/drivers/bulk
router.post('/bulk', driverController.bulkUpsertDrivers);

// POST /api/drivers/aliases/bulk
router.post('/aliases/bulk', driverController.bulkUpdateAliases);

// GET /api/drivers/attendance/daily
router.get('/attendance/daily', driverController.getDriverAttendances);

// PATCH /api/drivers/attendance/bulk-status
router.patch('/attendance/bulk-status', driverController.bulkUpdateAttendanceStatus);

// PATCH /api/drivers/attendance/:id/approval
router.patch('/attendance/:id/approval', driverController.updateAttendanceApproval);

// GET /api/drivers/:id
router.get('/:id', driverController.getDriverById);

// POST /api/drivers
router.post('/', driverController.createDriver);

// PUT /api/drivers/:id
router.put('/:id', driverController.updateDriver);

// PUT /api/drivers/:id/delay-balance
router.put('/:id/delay-balance', driverController.updateDelayBalance);

// DELETE /api/drivers/:id
router.delete('/:id', driverController.deleteDriver);

module.exports = router;
