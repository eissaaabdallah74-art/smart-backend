// src/models/pending-request-item.model.js
const { VEHICLE_TYPES } = require('../constants/vehicle-types');

module.exports = (sequelize, DataTypes) => {
  const PendingRequestItem = sequelize.define(
    'PendingRequestItem',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      pendingRequestId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'pending_request_id',
      },

      vehicleType: {
        type: DataTypes.ENUM(...VEHICLE_TYPES),
        allowNull: false,
        field: 'vehicle_type',
      },

      vehicleCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
        field: 'vehicle_count',
      },

      orderPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'order_price',
      },
      guaranteeMinOrders: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'guarantee_min_orders',
      },
      fixedAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'fixed_amount',
      },
      allowanceAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'allowance_amount',
      },
      totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'total_amount',
      },
    },
    {
      tableName: 'pending_request_items',
      timestamps: true,
      underscored: true,
    }
  );

  return PendingRequestItem;
};
