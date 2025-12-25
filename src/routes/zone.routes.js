// src/routes/zone.routes.js
const express = require('express');
const router = express.Router();
const zoneController = require('../controllers/zone.controller');

// GET /api/zones?hubId=...
router.get('/', zoneController.getZones);

// POST /api/zones
router.post('/', zoneController.createZone);

module.exports = router;
