const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const DriverAttendance = sequelize.define("DriverAttendance", {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    driverId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATEONLY, // e.g. 2026-05-12
      allowNull: false,
    },
    checkIn: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    checkOut: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    locationIn: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    locationOut: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'present', // present, absent, etc
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    approvalStatus: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending', // pending, approved, rejected
    }
  }, {
    tableName: 'driver_attendances',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['driver_id', 'date']
      }
    ]
  });

  return DriverAttendance;
};
