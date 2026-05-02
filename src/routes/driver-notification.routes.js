const express = require('express');
const router = express.Router();
const controller = require('../controllers/driver-notification.controller');

// Expected to be mounted with authMiddleware
router.post('/blast', controller.blastNotifications);
router.get('/blasts-history', controller.getBlastsHistory);

module.exports = router;
