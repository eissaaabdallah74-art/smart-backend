// src/models/courier-registration.model.js
const { VEHICLE_TYPES } = require('../constants/vehicle-types');

module.exports = (sequelize, DataTypes) => {
  const CourierRegistration = sequelize.define(
    'CourierRegistration',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      fullName: {
        type: DataTypes.STRING(150),
        allowNull: false,
        field: 'full_name',
      },

      phoneNumber: {
        type: DataTypes.STRING(40),
        allowNull: false,
        field: 'phone_number',
      },

      governorate: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },

      area: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },

      vehicleType: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'vehicle_type',
        // We can't use ENUM easily if we want to be flexible, but let's stick to STRING or ENUM
      },

      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      status: {
        type: DataTypes.ENUM('pending', 'contacted', 'accepted', 'rejected'),
        defaultValue: 'pending',
        allowNull: false,
      },
    },
    {
      tableName: 'courier_registrations',
      timestamps: true,
      underscored: true,
    }
  );

  return CourierRegistration;
};
