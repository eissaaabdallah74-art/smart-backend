// src/models/client-pricing.model.js
module.exports = (sequelize, DataTypes) => {
  const ClientPricing = sequelize.define(
    'ClientPricing',
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
      hubId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'hub_id',
      },
      zoneId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'zone_id',
      },
      module: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      vehicleType: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'vehicle_type',
      },
      fixedSalary: {
        type: DataTypes.FLOAT,
        allowNull: true,
        field: 'fixed_salary',
      },
      perOrderDelivered: {
        type: DataTypes.FLOAT,
        allowNull: true,
        field: 'per_order_delivered',
      },
      perOrderDeliveredAccepted: {
        type: DataTypes.FLOAT,
        allowNull: true,
        field: 'per_order_delivered_accepted',
      },
      perOrderDeliveredRefused: {
        type: DataTypes.FLOAT,
        allowNull: true,
        field: 'per_order_delivered_refused',
      },
      perOrderPickup: {
        type: DataTypes.FLOAT,
        allowNull: true,
        field: 'per_order_pickup',
      },
      guaranteeMinOrders: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'guarantee_min_orders',
      },
      guaranteePricePerOrder: {
        type: DataTypes.FLOAT,
        allowNull: true,
        field: 'guarantee_price_per_order',
      },
      perStopPrice: {
        type: DataTypes.FLOAT,
        allowNull: true,
        field: 'per_stop_price',
      },
      dynamicValues: {
        type: DataTypes.JSON,
        allowNull: true,
        field: 'dynamic_values',
      },
    },
    {
      tableName: 'client_pricings',
      timestamps: true,
      underscored: true,
    }
  );

  return ClientPricing;
};
