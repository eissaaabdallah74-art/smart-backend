// src/models/attendance-device-user.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const AttendanceDeviceUser = sequelize.define("AttendanceDeviceUser", {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    attendanceDeviceId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    deviceUserId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    uid: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    cardNo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    rawPayload: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    lastPulledAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'attendance_device_users',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'idx_device_user_unique',
        unique: true,
        fields: ['attendance_device_id', 'device_user_id']
      }
    ]
  });

  return AttendanceDeviceUser;
};
