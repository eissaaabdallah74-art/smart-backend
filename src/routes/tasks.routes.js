// src/routes/tasks.routes.js
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth.middleware');
const {
  requireOperationManagerOrSupervisor,
  requireOperationStaff,
} = require('../middlewares/role.helpers');

const taskController = require('../controllers/task.controller');

// كل الـ routes محتاجة token
router.use(authMiddleware);

// ===== Manager / Supervisor / Admin Views =====

// GET /api/tasks → list + filters + pagination
router.get(
  '/',
  requireOperationManagerOrSupervisor,
  taskController.getAllTasksForManager
);

// GET /api/tasks/by-assignee/:id
router.get(
  '/by-assignee/:id',
  requireOperationManagerOrSupervisor,
  taskController.getTasksByAssignee
);

// POST /api/tasks → create one
router.post(
  '/',
  requireOperationManagerOrSupervisor,
  taskController.createTask
);

// PATCH /api/tasks/:id → Manager/Supervisor/Admin أو Assignee (Operation)
router.patch('/:id', requireOperationStaff, taskController.updateTask);

// DELETE /api/tasks/:id → manager/supervisor/admin only
router.delete(
  '/:id',
  requireOperationManagerOrSupervisor,
  taskController.deleteTask
);

// ===== Senior / Junior (أو أي Operation) =====

// GET /api/tasks/my/all → tasks بتاعة اليوزر نفسه
router.get('/my/all', requireOperationStaff, taskController.getMyTasks);

module.exports = router;
