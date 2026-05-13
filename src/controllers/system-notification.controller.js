// src/controllers/system-notification.controller.js
const { SystemNotification, Auth } = require('../models');

const isTaskAdmin = (user) => user.role === 'admin';

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await SystemNotification.findAll({
      where: { user_id: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    res.json(notifications);
  } catch (err) {
    console.error('getNotifications error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notification = await SystemNotification.findOne({
      where: { id: req.params.id, user_id: req.user.id }
    });
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    await notification.update({ is_read: true });
    res.json(notification);
  } catch (err) {
    console.error('markAsRead error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.broadcast = async (req, res) => {
  try {
    const user = req.user;
    if (!isTaskAdmin(user)) {
      return res.status(403).json({ message: 'Only Admin can broadcast' });
    }

    const { message, type } = req.body;
    if (!message) return res.status(400).json({ message: 'Message is required' });

    // Fetch all active users
    const users = await Auth.findAll({ where: { isActive: true }, attributes: ['id'] });
    
    const notificationData = users.map(u => ({
      user_id: u.id,
      message,
      type: type || 'broadcast'
    }));

    // Bulk create
    const createdNotifications = await SystemNotification.bulkCreate(notificationData);

    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      createdNotifications.forEach(n => {
        io.to(`user_${n.user_id}`).emit('new_notification', n);
      });
    }

    res.json({ message: 'Broadcast sent successfully', count: createdNotifications.length });
  } catch (err) {
    console.error('broadcast error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};
