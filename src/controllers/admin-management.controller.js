// src/controllers/admin-management.controller.js
const { Auth } = require('../models');

/**
 * Get all users for admin management.
 */
exports.getAllUsers = async (req, res) => {
  try {
    const users = await Auth.findAll({
      attributes: [
        'id', 'fullName', 'email', 'role', 'position', 'isActive', 
        'permissions', 'accessExpiresAt', 'creationDate'
      ],
      order: [['id', 'DESC']]
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};

/**
 * Update a user's permissions and access expiration.
 */
exports.updateUserAccess = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions, accessExpiresAt, isActive, role } = req.body;

    const user = await Auth.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent updating own admin status or permissions if not careful
    // (Optional enhancement: add check to prevent self-lockout)

    if (permissions !== undefined) user.permissions = permissions;
    if (accessExpiresAt !== undefined) user.accessExpiresAt = accessExpiresAt;
    if (isActive !== undefined) user.isActive = isActive;
    if (role !== undefined) user.role = role;

    await user.save();

    res.json({ message: 'User access updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Error updating user access', error: error.message });
  }
};
