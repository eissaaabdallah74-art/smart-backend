// src/models/employee-payroll-insurance.model.js
module.exports = (sequelize, DataTypes) => {
  const EmployeePayrollInsurance = sequelize.define(
    'EmployeePayrollInsurance',
    {
      employeeId: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        allowNull: false,
        field: 'employee_id',
      },

      medicalInsuranceStatus: {
        type: DataTypes.ENUM('done', 'pending', 'not_insured', 'resigned_of_insurance'),
        allowNull: false,
        defaultValue: 'not_insured',
        field: 'medical_insurance_status',
      },

      socialInsuranceStatus: {
        type: DataTypes.ENUM('done', 'pending', 'not_insured', 'resigned_of_insurance'),
        allowNull: false,
        defaultValue: 'not_insured',
        field: 'social_insurance_status',
      },

      insuranceNumber: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'insurance_number',
      },

      socialInsuranceDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'social_insurance_date',
      },

      socialInsuranceExitDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'social_insurance_exit_date',
      },

      socialInsuranceExitReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'social_insurance_exit_reason',
      },

      grossSalary: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        field: 'gross_salary',
      },
      netSalary: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        field: 'net_salary',
      },

      insuredSalary: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        field: 'insured_salary',
      },

      employeeShare11: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        field: 'employee_share_11',
      },

      employerShare1875: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        field: 'employer_share_1875',
      },
    },
    {
      tableName: 'employee_payroll_insurances',
      timestamps: true,
      underscored: true,
    }
  );

  return EmployeePayrollInsurance;
};
