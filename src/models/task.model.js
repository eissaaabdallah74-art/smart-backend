// src/models/task.model.js
module.exports = (sequelize, DataTypes) => {
  const Task = sequelize.define(
    'Task',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      assignee_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },

      created_by_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },

      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      due_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      status: {
        type: DataTypes.ENUM('pending', 'in_progress', 'completed'),
        allowNull: false,
        defaultValue: 'pending',
      },

      priority: {
        type: DataTypes.ENUM('low', 'medium', 'high'),
        allowNull: false,
        defaultValue: 'medium',
      },

      attachment_link: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },

      delivery_note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      rate: {
        type: DataTypes.INTEGER,
        allowNull: true,
      }
    },
    {
      tableName: 'tasks',
      timestamps: true,
      underscored: true,
    }
  );

  return Task;
};

