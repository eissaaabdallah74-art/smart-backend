// src/models/vehicle-type.model.js
module.exports = (sequelize, DataTypes) => {
  const VehicleType = sequelize.define(
    'VehicleType',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
    },
    {
      tableName: 'vehicle_types',
      timestamps: true,
      underscored: true,
    }
  );

  return VehicleType;
};
