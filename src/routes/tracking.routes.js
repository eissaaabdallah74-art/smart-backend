// src/routes/tracking.routes.js
const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/tracking.controller');

// GET list  /api/tracking
router.get('/', trackingController.getAll);

// GET single /api/tracking/:id
router.get('/:id', trackingController.getOne);

// POST bulk upsert /api/tracking/bulk
router.post('/bulk', trackingController.bulkUpsert);

// POST create /api/tracking
router.post('/', trackingController.create);

// PUT update /api/tracking/:id
router.put('/:id', trackingController.update);

// DELETE /api/tracking/:id
router.delete('/:id', trackingController.remove);

module.exports = router;
