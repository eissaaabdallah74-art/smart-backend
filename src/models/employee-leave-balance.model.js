// src/models/employee-leave-balance.model.js
module.exports = (sequelize, DataTypes) => {
  const EmployeeLeaveBalance = sequelize.define(
    "EmployeeLeaveBalance",
    {
      employeeId: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        allowNull: false,
        field: "employee_id",
      },

      // default annual quota
      annualTotalDays: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 21.0,
        field: "annual_total_days",
      },

      annualUsedDays: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 0.0,
        field: "annual_used_days",
      },
    },
    {
      tableName: "employee_leave_balances",
      timestamps: true,
      underscored: true,
      indexes: [{ fields: ["employee_id"] }],
    }
  );

  return EmployeeLeaveBalance;
};
