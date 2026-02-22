// src/models/employee-loan.model.js
module.exports = (sequelize, DataTypes) => {
  const EmployeeLoan = sequelize.define(
    "EmployeeLoan",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

      employeeId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "employee_id",
      },

      policyType: {
        type: DataTypes.ENUM("annual_75_once", "triple_30_three"),
        allowNull: false,
        field: "policy_type",
      },

      startMonth: {
        type: DataTypes.STRING(7),
        allowNull: false,
        field: "start_month",
      },
      endMonth: {
        type: DataTypes.STRING(7),
        allowNull: false,
        field: "end_month",
      },

      installmentsCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "installments_count",
      },

      salaryGrossBase: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        field: "salary_gross_base",
      },
      principalAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        field: "principal_amount",
      },

      note: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "note",
      },

      managerNote: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "manager_note",
      },

      approvedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "approved_at",
      },

      approvedById: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "approved_by_id",
      },

      scheduleJson: {
        type: DataTypes.JSON,
        allowNull: false,
        field: "schedule_json",
      },

      manualItemIdsJson: {
        type: DataTypes.JSON,
        allowNull: true,
        field: "manual_item_ids_json",
      },

      // ✅ NEW statuses to match frontend
      status: {
        type: DataTypes.ENUM("pending", "approved", "rejected", "closed", "cancelled"),
        allowNull: false,
        defaultValue: "pending",
      },

      createdBy: { type: DataTypes.INTEGER, allowNull: true, field: "created_by" },
      cancelledBy: { type: DataTypes.INTEGER, allowNull: true, field: "cancelled_by" },
      cancelledAt: { type: DataTypes.DATE, allowNull: true, field: "cancelled_at" },
      cancelReason: { type: DataTypes.TEXT, allowNull: true, field: "cancel_reason" },
      closedAt: { type: DataTypes.DATE, allowNull: true, field: "closed_at" },
    },
    {
      tableName: "employee_loans",
      timestamps: true,
      underscored: true,
      indexes: [
        { name: "ix_employee_loans_employee", fields: ["employee_id"] },
        { name: "ix_employee_loans_employee_status", fields: ["employee_id", "status"] },
        { name: "ix_employee_loans_months", fields: ["start_month", "end_month"] },
      ],
    }
  );

  return EmployeeLoan;
};
