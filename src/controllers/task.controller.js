// src/controllers/task.controller.js
const { Op } = require('sequelize');
const { Task, Auth, SystemNotification } = require('../models');

// Helper to check if user is admin or sub-admin for tasks
const isTaskAdmin = (user) => user.role === 'admin';
const isTaskSubAdmin = (user) => ['manager', 'supervisor'].includes(user.position);

const getIo = (req) => req.app.get('io');

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

// ============== GET /api/tasks (List tasks based on role) ==============
exports.getTasks = async (req, res) => {
  try {
    const user = req.user;
    let whereClause = {};

    // If not admin/sub-admin, only see assigned tasks
    if (!isTaskAdmin(user) && !isTaskSubAdmin(user)) {
      whereClause = { assignee_id: user.id };
    }

    const tasks = await Task.findAll({
      where: whereClause,
      include: includeUsers,
      order: [['createdAt', 'DESC']]
    });
    res.json(tasks);
  } catch (err) {
    console.error('getTasks error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== POST /api/tasks (Create - Admin/Sub-Admin only) ==============
exports.createTask = async (req, res) => {
  try {
    const user = req.user;
    if (!isTaskAdmin(user) && !isTaskSubAdmin(user)) {
      return res.status(403).json({ message: 'Unauthorized to create tasks' });
    }

    const { title, description, priority, due_at, assignee_id, attachment_link } = req.body;
    
    if (!title || !assignee_id) {
      return res.status(400).json({ message: 'Title and Assignee are required' });
    }

    const task = await Task.create({
      title,
      description,
      priority: priority || 'medium',
      due_at,
      assignee_id,
      attachment_link,
      created_by_id: user.id
    });

    // Create Notification for the assignee
    const notif = await SystemNotification.create({
      user_id: assignee_id,
      message: `You have been assigned a new task: ${title}`,
      type: priority === 'high' ? 'urgent' : 'info',
      related_task_id: task.id
    });

    // Emit Socket event
    const io = getIo(req);
    if (io) {
      io.to(`user_${assignee_id}`).emit('new_notification', notif);
    }

    const fullTask = await Task.findByPk(task.id, { include: includeUsers });
    res.status(201).json(fullTask);
  } catch (err) {
    console.error('createTask error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== PATCH /api/tasks/:id (Update) ==============
exports.updateTask = async (req, res) => {
  try {
    const user = req.user;
    const id = req.params.id;
    const { title, description, status, priority, due_at, assignee_id, attachment_link, delivery_note, rate } = req.body;

    let task = await Task.findByPk(id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const isAdmin = isTaskAdmin(user);
    const isSubAdmin = isTaskSubAdmin(user);
    const isAssignee = task.assignee_id === user.id;

    if (!isAdmin && !isSubAdmin && !isAssignee) {
      return res.status(403).json({ message: 'Not allowed to update this task' });
    }

    const updateFields = {};

    // Fields only Admin/Sub-Admin can change
    if (isAdmin || isSubAdmin) {
      if (title !== undefined) updateFields.title = title;
      if (description !== undefined) updateFields.description = description;
      if (priority !== undefined) updateFields.priority = priority;
      if (due_at !== undefined) updateFields.due_at = due_at;
      if (assignee_id !== undefined) updateFields.assignee_id = assignee_id;
    }

    // Only Admin can rate
    if (rate !== undefined && isAdmin) {
      updateFields.rate = rate;
    }

    // Both user and admins can provide attachment links and delivery notes
    if (attachment_link !== undefined) updateFields.attachment_link = attachment_link;
    if (delivery_note !== undefined) updateFields.delivery_note = delivery_note;

    // Status update (Notify creator if status changes)
    if (status && status !== task.status) {
      updateFields.status = status;
      if (status === 'completed') {
        updateFields.completed_at = new Date();
      } else {
        updateFields.completed_at = null;
      }
      
      // Notify creator (unless they are the one updating)
      if (task.created_by_id !== user.id) {
        const notif = await SystemNotification.create({
          user_id: task.created_by_id,
          message: `Task "${task.title}" status changed to ${status}`,
          type: 'info',
          related_task_id: task.id
        });
        const io = getIo(req);
        if (io) io.to(`user_${task.created_by_id}`).emit('new_notification', notif);
      }
    }

    await task.update(updateFields);
    const fullTask = await Task.findByPk(task.id, { include: includeUsers });
    res.json(fullTask);
  } catch (err) {
    console.error('updateTask error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== DELETE /api/tasks/:id ==============
exports.deleteTask = async (req, res) => {
  try {
    const user = req.user;
    if (!isTaskAdmin(user) && !isTaskSubAdmin(user)) {
      return res.status(403).json({ message: 'Unauthorized to delete tasks' });
    }

    let task = await Task.findByPk(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    await task.destroy();
    res.json({ message: 'Task removed' });
  } catch (err) {
    console.error('deleteTask error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};
