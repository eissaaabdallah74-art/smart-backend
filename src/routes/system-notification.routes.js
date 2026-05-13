// src/routes/system-notification.routes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const notificationController = require('../controllers/system-notification.controller.js');

router.use(authMiddleware);

// GET /api/system-notifications (My notifications)
router.get('/', notificationController.getNotifications);

// PATCH /api/system-notifications/:id/read (Mark as read)
router.patch('/:id/read', notificationController.markAsRead);

// POST /api/system-notifications/broadcast (Admin only)
router.post('/broadcast', notificationController.broadcast);

module.exports = router;
