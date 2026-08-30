// src/models/target-bonus-rule.model.js
module.exports = (sequelize, DataTypes) => {
  const TargetBonusRule = sequelize.define(
    'TargetBonusRule',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      department: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'department',
      },
      clientId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'client_id',
      },
      vehicleTypeId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'vehicle_type_id',
      },
      ruleType: {
        type: DataTypes.ENUM('recurring_monthly', 'custom_period'),
        allowNull: false,
        defaultValue: 'recurring_monthly',
        field: 'rule_type',
      },
      startDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'start_date',
      },
      endDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'end_date',
      },
      targetCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'target_count',
      },
      minDaysWorked: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'min_days_worked',
      },
      bonusValue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'bonus_value',
      },
      requireSignedContract: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'require_signed_contract',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
      },
      createdById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'created_by_id',
      },
    },
    {
      tableName: 'target_bonus_rules',
      timestamps: true,
      underscored: true,
    }
  );

  return TargetBonusRule;
};
