// src/routes/admin-management.routes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin-management.controller');
const { requireAdmin } = require('../middlewares/role.helpers');

/**
 * Admin management routes.
 * Accessible only by users with 'admin' role.
 */
router.get('/users', requireAdmin, adminController.getAllUsers);
router.patch('/users/:id/access', requireAdmin, adminController.updateUserAccess);

module.exports = router;
