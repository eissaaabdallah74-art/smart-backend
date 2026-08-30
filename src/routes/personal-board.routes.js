// src/routes/personal-board.routes.js
const express = require('express');
const router = express.Router();
const personalBoardController = require('../controllers/personal-board.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Protect all routes with auth
router.use(authMiddleware);

// Profile & Security
router.get('/profile', personalBoardController.getProfile);
router.post('/change-password', personalBoardController.changePassword);

// Tasks
router.get('/tasks', personalBoardController.getTasks);
router.post('/tasks', personalBoardController.createTask);
router.put('/tasks/:id', personalBoardController.updateTask);
router.delete('/tasks/:id', personalBoardController.deleteTask);

// Calls
router.get('/calls', personalBoardController.getMyCalls);

module.exports = router;
