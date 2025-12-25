// src/routes/hub.routes.js
const express = require('express');
const router = express.Router();
const hubController = require('../controllers/hub.controller');

// GET /api/hubs?clientId=...
router.get('/', hubController.getHubs);

// POST /api/hubs
router.post('/', hubController.createHub);

module.exports = router;
