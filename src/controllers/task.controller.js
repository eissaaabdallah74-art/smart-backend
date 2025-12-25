// src/controllers/task.controller.js
const { Op } = require('sequelize');
const { Task, Auth } = require('../models');
const { isOperationManagerOrSupervisor } = require('../middlewares/role.helpers');

const ALLOWED_STATUS = new Set(['todo', 'in_progress', 'completed']);
const ALLOWED_PRIORITY = new Set(['low', 'medium', 'high']);

function parseDueAt(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeStatus(value, fallback = 'todo') {
  if (!value) return fallback;
  return ALLOWED_STATUS.has(value) ? value : null;
}

function normalizePriority(value, fallback = 'medium') {
  if (!value) return fallback;
  return ALLOWED_PRIORITY.has(value) ? value : null;
}

function applyCompletedAt(task, nextStatus) {
  if (nextStatus === 'completed') {
    if (!task.completed_at) task.completed_at = new Date();
  } else {
    // لو رجّعها todo / in_progress → نشيل completed_at
    task.completed_at = null;
  }
}

function buildTaskWhereQuery(query) {
  const where = {};
  const { assigneeId, status, fromDate, toDate, q } = query;

  if (assigneeId) where.assignee_id = Number(assigneeId);

  if (status && status !== 'all') {
    if (ALLOWED_STATUS.has(status)) where.status = status;
  }

  // فلترة بالـ due_at
  if (fromDate || toDate) {
    where.due_at = {};
    if (fromDate) {
      where.due_at[Op.gte] = new Date(`${fromDate}T00:00:00`);
    }
    if (toDate) {
      where.due_at[Op.lte] = new Date(`${toDate}T23:59:59.999`);
    }
  }

  if (q) {
    where[Op.or] = [
      { title: { [Op.like]: `%${q}%` } },
      { description: { [Op.like]: `%${q}%` } },
    ];
  }

  return where;
}

const includeUsers = [
  {
    model: Auth,
    as: 'assignee',
    attributes: ['id', 'fullName', 'email', 'role', 'position'],
  },
  {
    model: Auth,
    as: 'createdBy',
    attributes: ['id', 'fullName', 'email'],
  },
];

// ============== GET /api/tasks (Manager/Supervisor/Admin) ==============
exports.getAllTasksForManager = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize || 50)));

    const sortDir = String(req.query.sortDir || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const sortByRaw = String(req.query.sortBy || 'due_at');
    const sortMap = {
      due_at: 'due_at',
      status: 'status',
      priority: 'priority',
      id: 'id',
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      created_at: 'createdAt',
      updated_at: 'updatedAt',
    };
    const sortBy = sortMap[sortByRaw] || 'due_at';

    const where = buildTaskWhereQuery(req.query);

    const limit = pageSize;
    const offset = (page - 1) * limit;

    const result = await Task.findAndCountAll({
      where,
      include: includeUsers,
      order: [[sortBy, sortDir]],
      limit,
      offset,
    });

    return res.json({
      rows: result.rows,
      count: result.count,
      page,
      pageSize: limit,
    });
  } catch (error) {
    console.error('getAllTasksForManager error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ============== GET /api/tasks/by-assignee/:id (Manager View) ==============
exports.getTasksByAssignee = async (req, res) => {
  try {
    const assigneeId = Number(req.params.id);
    if (Number.isNaN(assigneeId)) {
      return res.status(400).json({ message: 'Invalid assignee id' });
    }

    const where = buildTaskWhereQuery(req.query);
    where.assignee_id = assigneeId;

    const tasks = await Task.findAll({
      where,
      include: includeUsers,
      order: [['due_at', 'ASC'], ['id', 'ASC']],
    });

    return res.json(tasks);
  } catch (error) {
    console.error('getTasksByAssignee error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ============== GET /api/tasks/my/all (Board بتاع الـ user نفسه) ==============
exports.getMyTasks = async (req, res) => {
  try {
    const user = req.user;
    if (!user || (user.role !== 'operation' && user.role !== 'admin')) {
      return res.status(403).json({ message: 'Operation staff only' });
    }

    const where = buildTaskWhereQuery(req.query);
    where.assignee_id = user.id;

    const tasks = await Task.findAll({
      where,
      include: includeUsers,
      order: [['due_at', 'ASC'], ['id', 'ASC']],
    });

    return res.json(tasks);
  } catch (error) {
    console.error('getMyTasks error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ============== POST /api/tasks (create) ==============
exports.createTask = async (req, res) => {
  try {
    const user = req.user;

    if (!(user.role === 'admin' || isOperationManagerOrSupervisor(user))) {
      return res.status(403).json({
        message: 'Only operation manager/supervisor or admin can create tasks',
      });
    }

    const { assigneeId, title, description, dueAt, status, priority } = req.body;

    if (!assigneeId) return res.status(400).json({ message: 'assigneeId is required' });
    if (!title || !title.trim()) return res.status(400).json({ message: 'title is required' });

    const assignee = await Auth.findByPk(assigneeId);
    if (!assignee) return res.status(400).json({ message: 'Assignee not found' });
    if (assignee.role !== 'operation') {
      return res.status(400).json({ message: 'Assignee must be operation user' });
    }

    const normalizedStatus = normalizeStatus(status, 'todo');
    if (!normalizedStatus) return res.status(400).json({ message: 'Invalid status' });

    const normalizedPriority = normalizePriority(priority, 'medium');
    if (!normalizedPriority) return res.status(400).json({ message: 'Invalid priority' });

    const dueVal = parseDueAt(dueAt);

    const task = await Task.create({
      assignee_id: assigneeId,
      created_by_id: user.id,
      title: title.trim(),
      description: description ?? null,
      due_at: dueVal,
      status: normalizedStatus,
      priority: normalizedPriority,
      completed_at: null,
    });

    applyCompletedAt(task, task.status);
    await task.save();

    const full = await Task.findByPk(task.id, { include: includeUsers });
    return res.status(201).json(full || task);
  } catch (error) {
    console.error('createTask error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ============== PATCH /api/tasks/:id (update) ==============
exports.updateTask = async (req, res) => {
  try {
    const user = req.user;
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid task id' });

    const task = await Task.findByPk(id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const isManager =
      user && (user.role === 'admin' || isOperationManagerOrSupervisor(user));
    const isAssignee = user && user.id === task.assignee_id;

    if (!isManager && !isAssignee) {
      return res.status(403).json({ message: 'Not allowed to update this task' });
    }

    const {
      title,
      description,
      dueAt,
      assigneeId,
      status,
      priority,
      // Backward compatibility لو كان فيه كود قديم:
      markDone,
    } = req.body;

    // ===== Assignee فقط: يغيّر status (todo/in_progress/completed) =====
    if (!isManager && isAssignee) {
      let nextStatus = null;

      if (typeof markDone !== 'undefined') {
        nextStatus = markDone ? 'completed' : 'todo';
      } else if (typeof status !== 'undefined') {
        nextStatus = normalizeStatus(status, task.status);
        if (!nextStatus) return res.status(400).json({ message: 'Invalid status' });
      } else {
        return res.status(400).json({ message: 'status is required for assignee update' });
      }

      task.status = nextStatus;
      applyCompletedAt(task, nextStatus);
      await task.save();

      const full = await Task.findByPk(task.id, { include: includeUsers });
      return res.json(full || task);
    }

    // ===== Manager/Supervisor/Admin =====
    if (typeof title !== 'undefined') {
      if (title && title.trim()) task.title = title.trim();
    }

    if (typeof description !== 'undefined') {
      task.description = description ?? null;
    }

    if (typeof dueAt !== 'undefined') {
      task.due_at = parseDueAt(dueAt);
    }

    if (typeof priority !== 'undefined') {
      const p = normalizePriority(priority, task.priority);
      if (!p) return res.status(400).json({ message: 'Invalid priority' });
      task.priority = p;
    }

    if (typeof status !== 'undefined') {
      const s = normalizeStatus(status, task.status);
      if (!s) return res.status(400).json({ message: 'Invalid status' });
      task.status = s;
      applyCompletedAt(task, s);
    }

    if (typeof assigneeId !== 'undefined') {
      if (!assigneeId) {
        return res.status(400).json({ message: 'assigneeId cannot be empty' });
      }
      const newAssignee = await Auth.findByPk(assigneeId);
      if (!newAssignee) return res.status(400).json({ message: 'Assignee not found' });
      if (newAssignee.role !== 'operation') {
        return res.status(400).json({ message: 'Assignee must be operation user' });
      }
      task.assignee_id = assigneeId;
    }

    await task.save();

    const full = await Task.findByPk(task.id, { include: includeUsers });
    return res.json(full || task);
  } catch (error) {
    console.error('updateTask error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ============== DELETE /api/tasks/:id ==============
exports.deleteTask = async (req, res) => {
  try {
    const user = req.user;

    if (!(user && (user.role === 'admin' || isOperationManagerOrSupervisor(user)))) {
      return res.status(403).json({
        message: 'Only operation manager/supervisor or admin can delete tasks',
      });
    }

    const id = Number(req.params.id);
    if (Number.is (Number.isNaN(id))) return res.status(400).json({ message: 'Invalid task id' });

    const task = await Task.findByPk(id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    await task.destroy();
    return res.status(204).send();
  } catch (error) {
    console.error('deleteTask error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
