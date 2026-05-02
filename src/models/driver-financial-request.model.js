// src/models/driver-financial-request.model.js
module.exports = (sequelize, DataTypes) => {
  const DriverFinancialRequest = sequelize.define(
    'DriverFinancialRequest',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      driverId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'driver_id',
      },
      accountManagerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'account_manager_id', // Derived from driver.client at creation time
      },
      status: {
        type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      // The requested new data
      paymentMethod: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'payment_method',
      },
      bankName: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'bank_name',
      },
      bankAccountNumber: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'bank_account_number',
      },
      walletName: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'wallet_name',
      },
      walletNumber: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'wallet_number',
      },
      reviewedBy: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'reviewed_by',
      },
      rejectionReason: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'rejection_reason',
      },
    },
    {
      tableName: 'driver_financial_requests',
      timestamps: true,
      underscored: true,
    }
  );

  return DriverFinancialRequest;
};
