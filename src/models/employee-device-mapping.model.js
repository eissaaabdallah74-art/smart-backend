// src/models/employee-device-mapping.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const EmployeeDeviceMapping = sequelize.define("EmployeeDeviceMapping", {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    employeeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    attendanceDeviceId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    deviceUserId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName: 'employee_device_mappings',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'idx_emp_device_unique',
        unique: true,
        fields: ['attendance_device_id', 'device_user_id']
      }
    ]
  });

  return EmployeeDeviceMapping;
};
