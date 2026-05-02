// src/routes/courier-registration.routes.js
const express = require('express');
const router = express.Router();
const courierController = require('../controllers/courier-registration.controller');
// const { authenticate } = require('../middlewares/auth.middleware'); // Assuming an auth middleware exists

// Public routes
router.post('/register', courierController.register);
router.get('/areas', courierController.getAreas);

// Admin routes (should be protected in production)
router.get('/list', courierController.getAll);
router.patch('/:id/status', courierController.updateStatus);

module.exports = router;
