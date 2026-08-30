// src/models/user-task.model.js
module.exports = (sequelize, DataTypes) => {
  const UserTask = sequelize.define(
    'UserTask',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      authId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'auth_id',
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
      },
      dueDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'due_date',
      },
      startTime: {
        type: DataTypes.TIME,
        allowNull: true,
        field: 'start_time',
      },
      endTime: {
        type: DataTypes.TIME,
        allowNull: true,
        field: 'end_time',
      },
      type: {
        type: DataTypes.ENUM('todo', 'daily_plan', 'monthly_plan'),
        allowNull: false,
        defaultValue: 'todo',
      },
      referenceId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'reference_id',
      },
      referenceType: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'reference_type',
      },
    },
    {
      tableName: 'user_tasks',
      timestamps: true,
      underscored: true,
    }
  );

  return UserTask;
};
