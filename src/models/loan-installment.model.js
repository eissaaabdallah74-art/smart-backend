// src/models/loan-installment.model.js
module.exports = (sequelize, DataTypes) => {
  const LoanInstallment = sequelize.define(
    "LoanInstallment",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },

      // ✅ matches employee_loans.id (SIGNED)
      loanId: { type: DataTypes.INTEGER, allowNull: false, field: "loan_id" },

      // ✅ matches employees.id (UNSIGNED)
      employeeId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "employee_id" },

      month: {
        type: DataTypes.STRING(7),
        allowNull: false,
        validate: { is: /^\d{4}-\d{2}$/ },
      },

      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },

      status: {
        type: DataTypes.ENUM("pending", "deducted", "skipped"),
        allowNull: false,
        defaultValue: "pending",
      },

      deductedAt: { type: DataTypes.DATE, allowNull: true, field: "deducted_at" },

      payrollRunId: { type: DataTypes.INTEGER, allowNull: true, field: "payroll_run_id" },
    },
    {
      tableName: "loan_installments",
      timestamps: true,
      underscored: true,
      indexes: [
        { unique: true, fields: ["loan_id", "month"] },
        { fields: ["employee_id", "month"] },
        { fields: ["status"] },
      ],
    }
  );

  return LoanInstallment;
};
