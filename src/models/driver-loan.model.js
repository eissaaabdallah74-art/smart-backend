const {
  DRIVER_PAYMENT_METHODS,
  DRIVER_LOAN_STATUSES,
} = require('../constants/enums');

module.exports = (sequelize, DataTypes) => {
  const DriverLoan = sequelize.define(
    'DriverLoan',
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

      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          isValidAmount(value) {
            const num = Number(value);
            if (Number.isNaN(num) || num <= 0) {
              throw new Error('Loan amount must be a valid number greater than 0');
            }
          },
        },
      },

      installmentsCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        field: 'installments_count',
        validate: {
          min: 1
        }
      },

      paidAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        field: 'paid_amount',
      },

      installmentAmount: {
        type: DataTypes.VIRTUAL,
        get() {
          const amount = parseFloat(this.getDataValue('amount')) || 0;
          const count = parseInt(this.getDataValue('installmentsCount'), 10) || 1;
          return Number((amount / count).toFixed(2));
        }
      },

      paymentMethod: {
        type: DataTypes.ENUM(...DRIVER_PAYMENT_METHODS),
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

      requestText: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'request_text',
      },

      personalIdFrontImage: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'personal_id_front_image',
      },

      personalIdBackImage: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'personal_id_back_image',
      },

      // snapshots to preserve request data even if driver data changes later
      clientNameSnapshot: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'client_name_snapshot',
      },

      phoneNumberSnapshot: {
        type: DataTypes.STRING(40),
        allowNull: true,
        field: 'phone_number_snapshot',
      },

      hubSnapshot: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'hub_snapshot',
      },

      status: {
        type: DataTypes.ENUM(...DRIVER_LOAN_STATUSES),
        allowNull: false,
        defaultValue: 'pending',
      },

      decidedById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'decided_by_id',
      },

      decidedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'decided_at',
      },

      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      // audit
      createdById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'created_by_id',
      },

      updatedById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'updated_by_id',
      },

      deletedById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'deleted_by_id',
      },
    },
    {
      tableName: 'driver_loans',
      timestamps: true,
      underscored: true,
      paranoid: true,
      deletedAt: 'deleted_at',

      validate: {
        bankDataRequiredWhenMethodIsBank() {
          if (this.paymentMethod !== 'bank') return;

          if (!this.bankName || !String(this.bankName).trim()) {
            throw new Error(
              'Bank name is required when payment method is bank'
            );
          }

          if (
            !this.bankAccountNumber ||
            !String(this.bankAccountNumber).trim()
          ) {
            throw new Error(
              'Bank account number is required when payment method is bank'
            );
          }
        },

        walletDataRequiredWhenMethodIsWallet() {
          if (this.paymentMethod !== 'wallet') return;

          if (!this.walletName || !String(this.walletName).trim()) {
            throw new Error(
              'Wallet name is required when payment method is wallet'
            );
          }

          if (!this.walletNumber || !String(this.walletNumber).trim()) {
            throw new Error(
              'Wallet number is required when payment method is wallet'
            );
          }
        },

        preventMixedPaymentData() {
          if (
            this.paymentMethod === 'bank' &&
            (this.walletName || this.walletNumber)
          ) {
            throw new Error(
              'Wallet fields must be empty when payment method is bank'
            );
          }

          if (
            this.paymentMethod === 'wallet' &&
            (this.bankName || this.bankAccountNumber)
          ) {
            throw new Error(
              'Bank fields must be empty when payment method is wallet'
            );
          }
        },
      },
    }
  );

  DriverLoan.STATUSES = DRIVER_LOAN_STATUSES;
  DriverLoan.PAYMENT_METHODS = DRIVER_PAYMENT_METHODS;

  return DriverLoan;
};