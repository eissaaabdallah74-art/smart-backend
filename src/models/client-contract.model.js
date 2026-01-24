// src/models/client-contract.model.js
module.exports = (sequelize, DataTypes) => {
  const ClientContract = sequelize.define(
    'ClientContract',
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

      contractNumber: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'contract_number',
      },

      startDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: 'start_date',
      },

      endDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'end_date',
      },

      duration: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },

      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      status: {
        type: DataTypes.ENUM('active', 'expired', 'terminated'),
        allowNull: false,
        defaultValue: 'active',
      },

      renewalAlertDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'renewal_alert_date',
      },
    },
    {
      tableName: 'client_contracts',
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ['client_id'] },
        { fields: ['contract_number'] },
        { fields: ['status'] },
        { fields: ['start_date'] },
        { fields: ['end_date'] },
      ],
    }
  );

  return ClientContract;
};
