// src/models/attendance-device.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const AttendanceDevice = sequelize.define("AttendanceDevice", {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    port: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 4370,
    },
    commKey: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "0",
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    lastSyncAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastSyncStatus: {
      type: DataTypes.ENUM("SUCCESS", "FAILED", "NEVER"),
      allowNull: true,
      defaultValue: "NEVER",
    },
    lastSyncError: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'attendance_devices',
    timestamps: true,
    underscored: true,
  });

  return AttendanceDevice;
};
