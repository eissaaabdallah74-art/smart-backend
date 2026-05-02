// src/models/business-module.model.js
module.exports = (sequelize, DataTypes) => {
  const BusinessModule = sequelize.define(
    'BusinessModule',
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
      tableName: 'business_modules',
      timestamps: true,
      underscored: true,
    }
  );

  return BusinessModule;
};
