// src/controllers/payroll-setting.controller.js
const { PayrollSetting } = require("../models");

const DEFAULT_SETTINGS = {
  country: "EG",
  year: 2026,
  employeeSocialInsuranceRate: 0.11,
  employerSocialInsuranceRate: 0.1875,
  martyrFundRate: 0.0005,
  annualPersonalExemption: 20000,
  minInsuredSalary: 2700,
  maxInsuredSalary: 16700,
  taxBrackets: [
    { from: 0, to: 40000, rate: 0 },
    { from: 40000, to: 55000, rate: 0.10 },
    { from: 55000, to: 70000, rate: 0.15 },
    { from: 70000, to: 200000, rate: 0.20 },
    { from: 200000, to: 400000, rate: 0.225 },
    { from: 400000, to: null, rate: 0.25 },
  ],
  highIncomeAdjustments: [
    { limit: 600000, startingRate: 0, remove0: false },
    { limit: 700000, startingRate: 0.10, remove0: true },
    { limit: 800000, startingRate: 0.15, remove0: true },
    { limit: 900000, startingRate: 0.20, remove0: true },
    { limit: 1200000, startingRate: 0.225, remove0: true },
    { limit: 1200001, startingRate: 0.25, remove0: true, specialBracket: { limit: 1200000, rate: 0.275 } }
  ],
  payrollMode: "NO_EXEMPT_ALLOWANCES",
  allowanceEnabled: false,
  allowancePercentage: 30,
  allowanceCalculationMethod: "PERCENTAGE_OF_BASIC",
  allowanceTaxTreatment: "TAXABLE",
  allowanceSocialInsuranceTreatment: "EXCLUDED_FROM_SOCIAL_INSURANCE"
};

exports.getSettings = async (req, res) => {
  try {
    let settings = await PayrollSetting.findOne({ where: { country: "EG", year: 2026 } });
    if (!settings) {
      settings = await PayrollSetting.create(DEFAULT_SETTINGS);
    }
    res.json(settings);
  } catch (error) {
    console.error("getSettings error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const data = req.body;
    let settings = await PayrollSetting.findOne({ where: { country: "EG", year: 2026 } });
    
    if (!settings) {
      settings = await PayrollSetting.create({ ...DEFAULT_SETTINGS, ...data });
    } else {
      await settings.update(data);
    }
    
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error("updateSettings error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.resetDefaults = async (req, res) => {
  try {
    let settings = await PayrollSetting.findOne({ where: { country: "EG", year: 2026 } });
    if (settings) {
      await settings.update(DEFAULT_SETTINGS);
    } else {
      settings = await PayrollSetting.create(DEFAULT_SETTINGS);
    }
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error("resetDefaults error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
