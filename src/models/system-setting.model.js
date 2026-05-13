// src/models/system-setting.model.js
module.exports = (sequelize, DataTypes) => {
  const SystemSetting = sequelize.define(
    "SystemSetting",
    {
      key: {
        type: DataTypes.STRING(100),
        primaryKey: true,
      },
      value: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: "system_settings",
      timestamps: true,
      underscored: true,
    }
  );

  return SystemSetting;
};
