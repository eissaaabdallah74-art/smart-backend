// src/models/kpi-element.model.js
module.exports = (sequelize, DataTypes) => {
  const KpiElement = sequelize.define(
    'KpiElement',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      nameAr: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'name_ar',
      },
      nameEn: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'name_en',
      },
      calculationType: {
        type: DataTypes.ENUM(
          'account_manager_target',
          'account_manager_day1',
          'interviewer_recruitment',
          'manual',
          'operation_team_target',
          'supply_chain_team_target'
        ),
        allowNull: false,
        field: 'calculation_type',
        comment: 'Determines how the backend should query DB to calculate achievement',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active',
      },
    },
    {
      tableName: 'kpi_elements',
      timestamps: true,
      underscored: true,
    }
  );

  return KpiElement;
};
