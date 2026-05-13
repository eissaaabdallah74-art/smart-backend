// src/routes/tasks.routes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const taskController = require('../controllers/task.controller');

router.use(authMiddleware);

// GET /api/tasks (List tasks - role based filtering inside controller)
router.get('/', taskController.getTasks);

// POST /api/tasks (Create task)
router.post('/', taskController.createTask);

// PATCH /api/tasks/:id (Update task)
router.patch('/:id', taskController.updateTask);

// DELETE /api/tasks/:id (Delete task)
router.delete('/:id', taskController.deleteTask);

module.exports = router;
