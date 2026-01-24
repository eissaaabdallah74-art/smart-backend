// src/models/loan-request.model.js
module.exports = (sequelize, DataTypes) => {
  const LoanRequest = sequelize.define(
    'LoanRequest',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      requesterId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'requester_id',
      },

      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },

      note: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },

      status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },

      decidedById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'decided_by_id',
      },

      managerNote: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'manager_note',
      },

      decidedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'decided_at',
      },
    },
    {
      tableName: 'loan_requests',
      timestamps: true,
      underscored: true,
    }
  );

  return LoanRequest;
};
