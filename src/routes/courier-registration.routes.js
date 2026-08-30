// src/routes/courier-registration.routes.js
const express = require('express');
const router = express.Router();
const courierController = require('../controllers/courier-registration.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Public routes
router.post('/register', courierController.register);
router.get('/areas', courierController.getAreas);

// Admin routes (should be protected in production)
router.get('/list', authMiddleware, courierController.getAll);
router.patch('/:id/status', authMiddleware, courierController.updateStatus);

module.exports = router;
