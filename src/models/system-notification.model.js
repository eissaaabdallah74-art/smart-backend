// src/models/system-notification.model.js
module.exports = (sequelize, DataTypes) => {
  const SystemNotification = sequelize.define(
    'SystemNotification',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM('info', 'urgent', 'broadcast'),
        defaultValue: 'info',
      },
      is_read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      related_task_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
    },
    {
      tableName: 'system_notifications',
      timestamps: true,
      underscored: true,
    }
  );

  return SystemNotification;
};
