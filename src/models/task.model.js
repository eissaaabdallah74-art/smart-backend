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

      // مطابق للـ Front: due_at (datetime)
      due_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      // مطابق للـ Front: status (todo/in_progress/completed)
      status: {
        type: DataTypes.ENUM('todo', 'in_progress', 'completed'),
        allowNull: false,
        defaultValue: 'todo',
      },

      // مطابق للـ Front: priority (low/medium/high)
      priority: {
        type: DataTypes.ENUM('low', 'medium', 'high'),
        allowNull: false,
        defaultValue: 'medium',
      },
    },
    {
      tableName: 'tasks',
      timestamps: true,
      underscored: true,
    }
  );

  return Task;
};
