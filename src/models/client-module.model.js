// src/models/client-module.model.js
module.exports = (sequelize, DataTypes) => {
  const ClientModule = sequelize.define(
    'ClientModule',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      clientId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'client_id',
      },
      columnName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'column_name',
      },
      systemAlias: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'CUSTOM',
        field: 'system_alias',
      },
      valueType: {
        type: DataTypes.ENUM('amount', 'count', 'text'),
        allowNull: false,
        defaultValue: 'amount',
        field: 'value_type',
      },
      operationType: {
        type: DataTypes.ENUM('addition', 'deduction', 'total', 'none'),
        allowNull: false,
        defaultValue: 'none',
        field: 'operation_type',
      },
      isPricingParameter: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_pricing_parameter',
      },
      pricingRule: {
        type: DataTypes.ENUM('none', 'fixed_day', 'unit_count', 'amount_fixed'),
        allowNull: false,
        defaultValue: 'none',
        field: 'pricing_rule',
      },
      linkedColumns: {
        type: DataTypes.JSON,
        allowNull: true,
        field: 'linked_columns',
      },
    },
    {
      tableName: 'client_modules',
      timestamps: true,
      underscored: true,
    }
  );

  return ClientModule;
};
