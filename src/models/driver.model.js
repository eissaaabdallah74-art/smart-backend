const {
  DRIVER_CONTRACT_STATUSES,
  SIGNED_WITH_HR_STATUSES,
  DRIVER_PAYMENT_METHODS,
} = require('../constants/enums');

module.exports = (sequelize, DataTypes) => {
  const Driver = sequelize.define(
    'Driver',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },

      fullNameArabic: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'full_name_arabic',
      },

      email: {
        type: DataTypes.STRING(150),
        allowNull: true,
        validate: {
          isEmail: { msg: 'Email is invalid' },
        },
      },

      courierPhone: {
        type: DataTypes.STRING(40),
        allowNull: true,
        field: 'courier_phone',
      },

      courierId: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'courier_id',
      },

      residence: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },

      courierCode: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'courier_code',
      },

      clientName: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'client_name',
      },

      hub: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      area: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      module: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      vehicleType: {
        type: DataTypes.STRING(80),
        allowNull: true,
        field: 'vehicle_type',
      },

      contractor: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },

      pointOfContact: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'point_of_contact',
      },

      accountManager: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'account_manager',
      },

      interviewer: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },

      hrRepresentative: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'hr_representative',
      },

      hiringDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'hiring_date',
      },

      day1Date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'day1_date',
      },

      vLicenseExpiryDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'v_license_expiry_date',
      },

      dLicenseExpiryDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'd_license_expiry_date',
      },

      idExpiryDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'id_expiry_date',
      },

      liabilityAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'liability_amount',
      },

      signed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      signedWithHr: {
        type: DataTypes.ENUM(...SIGNED_WITH_HR_STATUSES),
        allowNull: true,
        field: 'signed_with_hr',
      },

      contractStatus: {
        type: DataTypes.ENUM(...DRIVER_CONTRACT_STATUSES),
        allowNull: true,
        field: 'contract_status',
      },

      hiringStatus: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'hiring_status',
      },

      securityQueryStatus: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'security_query_status',
      },

      securityQueryComment: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'security_query_comment',
      },

      exceptionBy: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'exception_by',
      },

      vendorId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'vendor_id',
      },

      // ===================== NEW Financial Fields =====================
      monthlySalary: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'monthly_salary',
        validate: {
          isValidMonthlySalary(value) {
            if (value === null || value === undefined || value === '') return;
            const num = Number(value);
            if (Number.isNaN(num) || num < 0) {
              throw new Error(
                'Monthly salary must be a valid non-negative number'
              );
            }
          },
        },
      },

      paymentMethod: {
        type: DataTypes.ENUM(...DRIVER_PAYMENT_METHODS),
        allowNull: true,
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

      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      // ===================== Audit Fields =====================
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
      tableName: 'drivers',
      timestamps: true,
      underscored: true,
      paranoid: true,
      deletedAt: 'deleted_at',

      validate: {
        paymentMethodRequiredWhenDetailsExist() {
          const hasBankData = !!(this.bankName || this.bankAccountNumber);
          const hasWalletData = !!(this.walletName || this.walletNumber);

          if ((hasBankData || hasWalletData) && !this.paymentMethod) {
            throw new Error(
              'Payment method is required when bank/wallet data is provided'
            );
          }
        },

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

  Driver.CONTRACT_STATUSES = DRIVER_CONTRACT_STATUSES;
  Driver.SIGNED_WITH_HR_STATUSES = SIGNED_WITH_HR_STATUSES;
  Driver.PAYMENT_METHODS = DRIVER_PAYMENT_METHODS;

  return Driver;
};