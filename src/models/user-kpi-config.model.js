// src/models/user-kpi-config.model.js
module.exports = (sequelize, DataTypes) => {
  const UserKpiConfig = sequelize.define(
    'UserKpiConfig',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      authUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'auth_user_id',
      },
      kpiElementId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'kpi_element_id',
      },
      weightPercentage: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'weight_percentage',
        validate: {
          min: 0,
          max: 100,
        },
      },
      targetValue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'target_value',
      },
      managerRollupTarget: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'manager_rollup_target',
      },
    },
    {
      tableName: 'user_kpi_configs',
      timestamps: true,
      underscored: true,
    }
  );

  return UserKpiConfig;
};
