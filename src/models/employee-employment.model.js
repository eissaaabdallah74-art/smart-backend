// src/models/employee-employment.model.js
module.exports = (sequelize, DataTypes) => {
  const EmployeeEmployment = sequelize.define(
    'EmployeeEmployment',
    {
      employeeId: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        allowNull: false,
        field: 'employee_id',
      },

      isWorking: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_working',
      },

      department: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'department',
      },

      jobTitle: {
        type: DataTypes.STRING(120),
        allowNull: true,
        field: 'job_title',
      },

      corporateEmail: {
        type: DataTypes.STRING(120),
        allowNull: true,
        unique: true,
        field: 'corporate_email',
        validate: {
          isEmail: true,
        },
      },

      hireDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'hire_date',
      },

      terminationDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'termination_date',
      },

      nationalIdExpiryDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'national_id_expiry_date',
      },

      companyNumber: {
        type: DataTypes.STRING(40),
        allowNull: true,
        field: 'company_number',
      },

      personalPhone: {
        type: DataTypes.STRING(30),
        allowNull: true,
        field: 'personal_phone',
      },

      annualLeaveBalance: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 21,
        field: 'annual_leave_balance',
      },

      annualLeaveUsed: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'annual_leave_used',
      },

      annualLeaveRemaining: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 21,
        field: 'annual_leave_remaining',
      },

      missingPapersText: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'missing_papers_text',
      },

      companyCode: {
        type: DataTypes.STRING(30), // e.g., SMV
        allowNull: true,
        field: 'company_code',
      },

      sheetLastUpdateAt: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'sheet_last_update_at',
      },

      adminNotes: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'admin_notes',
      },
    },
    {
      tableName: 'employee_employments',
      timestamps: true,
      underscored: true,
    }
  );

  return EmployeeEmployment;
};
