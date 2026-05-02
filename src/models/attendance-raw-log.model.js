// src/models/attendance-raw-log.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const AttendanceRawLog = sequelize.define("AttendanceRawLog", {
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
    punchTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    verifyType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    workCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    rawPayload: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    syncedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'attendance_raw_logs',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'idx_device_user_punch',
        unique: true,
        fields: ['attendance_device_id', 'device_user_id', 'punch_time']
      }
    ]
  });

  return AttendanceRawLog;
};
