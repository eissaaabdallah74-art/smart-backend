// src/controllers/chat.controller.js
const { ChatMessage, Auth, Employee } = require("../models");
const { Op } = require("sequelize");

exports.getChatHistory = async (req, res) => {
  try {
    const { room_type, room_name } = req.query;
    const userId = req.user.id;

    if (!room_type || !room_name) {
      return res.status(400).json({ message: "Room type and name are required" });
    }

    // Security check: If department, ensure user belongs to it (or is admin)
    if (room_type === 'department') {
      const dept = room_name.replace('dept_', '');
      if (req.user.role !== dept && req.user.role !== 'admin') {
        return res.status(403).json({ message: "You don't have access to this department chat" });
      }
    }

    // Security check: If managers, ensure user is a manager (or is admin)
    if (room_type === 'managers') {
      if (req.user.position !== 'manager' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only managers can access this chat" });
      }
    }

    // Fetch messages
    const messages = await ChatMessage.findAll({
      where: { room_name },
      include: [
        { 
          model: Auth, 
          as: 'sender', 
          attributes: ['id', 'fullName', 'role', 'position', 'profileImage'] 
        }
      ],
      order: [['created_at', 'ASC']],
      limit: 100 // Last 100 messages
    });

    res.json(messages);
  } catch (error) {
    console.error("Error fetching chat history:", error);
    res.status(500).json({ message: "Error fetching chat history" });
  }
};

exports.getRecentContacts = async (req, res) => {
  try {
    const userId = req.user.id;

    // This is more complex: find all users I've chatted with
    // For now, let's just return all active users in the system so they can start a chat
    const users = await Auth.findAll({
      where: { 
        isActive: true,
        id: { [Op.ne]: userId }
      },
      attributes: ['id', 'fullName', 'role', 'position', 'profileImage']
    });

    res.json(users);
  } catch (error) {
    console.error("Error fetching contacts:", error);
    res.status(500).json({ message: "Error fetching contacts" });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { room_name } = req.body;
    const userId = req.user.id;

    await ChatMessage.update(
      { is_read: true },
      { 
        where: { 
          room_name,
          receiver_id: userId,
          is_read: false
        } 
      }
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Error marking messages as read" });
  }
};
