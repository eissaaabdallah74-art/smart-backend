// src/routes/drivers.routes.js
const express = require('express');
const router = express.Router();

const driverController = require('../controllers/driver.controller');

// GET /api/drivers
router.get('/', driverController.getAllDrivers);

// ✅ POST /api/drivers/sync-from-interviews
router.post('/sync-from-interviews', driverController.syncDriversFromInterviews);

// POST /api/drivers/bulk
router.post('/bulk', driverController.bulkUpsertDrivers);

// GET /api/drivers/:id
router.get('/:id', driverController.getDriverById);

// POST /api/drivers
router.post('/', driverController.createDriver);

// PUT /api/drivers/:id
router.put('/:id', driverController.updateDriver);

// DELETE /api/drivers/:id
router.delete('/:id', driverController.deleteDriver);

module.exports = router;
