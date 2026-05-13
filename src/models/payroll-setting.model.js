// src/models/payroll-setting.model.js
module.exports = (sequelize, DataTypes) => {
  const PayrollSetting = sequelize.define(
    "PayrollSetting",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      country: {
        type: DataTypes.STRING,
        defaultValue: "EG",
      },
      year: {
        type: DataTypes.INTEGER,
        defaultValue: 2026,
      },
      employeeSocialInsuranceRate: {
        type: DataTypes.FLOAT,
        defaultValue: 0.11, // 11%
      },
      employerSocialInsuranceRate: {
        type: DataTypes.FLOAT,
        defaultValue: 0.1875, // 18.75%
      },
      martyrFundRate: {
        type: DataTypes.FLOAT,
        defaultValue: 0.0005, // 0.05%
      },
      annualPersonalExemption: {
        type: DataTypes.FLOAT,
        defaultValue: 20000,
      },
      minInsuredSalary: {
        type: DataTypes.FLOAT,
        defaultValue: 2700,
      },
      maxInsuredSalary: {
        type: DataTypes.FLOAT,
        defaultValue: 16700,
      },
      taxBrackets: {
        type: DataTypes.JSON,
        defaultValue: [
          { from: 0, to: 40000, rate: 0 },
          { from: 40000, to: 55000, rate: 0.10 },
          { from: 55000, to: 70000, rate: 0.15 },
          { from: 70000, to: 200000, rate: 0.20 },
          { from: 200000, to: 400000, rate: 0.225 },
          { from: 400000, to: null, rate: 0.25 },
        ],
      },
      // Optional high income adjustments
      highIncomeAdjustments: {
        type: DataTypes.JSON,
        defaultValue: [
          { limit: 600000, startingRate: 0, remove0: false },
          { limit: 700000, startingRate: 0.10, remove0: true },
          { limit: 800000, startingRate: 0.15, remove0: true },
          { limit: 900000, startingRate: 0.20, remove0: true },
          { limit: 1200000, startingRate: 0.225, remove0: true },
          { limit: Infinity, startingRate: 0.25, remove0: true, specialBracket: { limit: 1200000, rate: 0.275 } }
        ]
      },
      payrollMode: {
        type: DataTypes.STRING,
        defaultValue: "NO_EXEMPT_ALLOWANCES",
      },
      allowanceEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      allowancePercentage: {
        type: DataTypes.FLOAT,
        defaultValue: 30,
      },
      allowanceCalculationMethod: {
        type: DataTypes.STRING,
        defaultValue: "PERCENTAGE_OF_BASIC",
      },
      allowanceTaxTreatment: {
        type: DataTypes.STRING,
        defaultValue: "TAXABLE",
      },
      allowanceSocialInsuranceTreatment: {
        type: DataTypes.STRING,
        defaultValue: "EXCLUDED_FROM_SOCIAL_INSURANCE",
      }
    },
    {
      tableName: "employee_payroll_settings",
      timestamps: true,
    }
  );

  return PayrollSetting;
};
