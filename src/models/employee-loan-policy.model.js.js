// src/models/employee-loan-policy.model.js
module.exports = (sequelize, DataTypes) => {
  const EmployeeLoanPolicy = sequelize.define(
    "EmployeeLoanPolicy",
    {
      employeeId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        field: "employee_id",
      },
      policyType: {
        type: DataTypes.ENUM("annual_75_once", "triple_30_three"),
        allowNull: false,
        defaultValue: "triple_30_three",
        field: "policy_type",
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "employee_loan_policies",
      timestamps: true,
      underscored: true,
      indexes: [{ name: "ix_employee_loan_policy_type", fields: ["policy_type"] }],
    }
  );

  return EmployeeLoanPolicy;
};
