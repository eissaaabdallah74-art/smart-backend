// src/models/user-kpi-evaluation.model.js
module.exports = (sequelize, DataTypes) => {
  const UserKpiEvaluation = sequelize.define(
    'UserKpiEvaluation',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userKpiConfigId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'user_kpi_config_id',
      },
      month: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 12,
        },
      },
      year: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      achievedValue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'achieved_value',
      },
      evaluatedById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'evaluated_by_id',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'user_kpi_evaluations',
      timestamps: true,
      underscored: true,
    }
  );

  return UserKpiEvaluation;
};
