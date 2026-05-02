// src/models/system-alias.model.js
module.exports = (sequelize, DataTypes) => {
  const SystemAlias = sequelize.define(
    'SystemAlias',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      code: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      isCore: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_core',
      },
    },
    {
      tableName: 'system_aliases',
      timestamps: true,
    }
  );

  return SystemAlias;
};
