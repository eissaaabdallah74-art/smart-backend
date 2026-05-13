const { Employee, EmployeePayrollInsurance, Auth, sequelize, PayrollSetting } = require('../models');
const { calculateGrossToNet, calculateNetToGross } = require('../utils/payroll-calculator');

async function getPayrollSettings() {
  let settings = await PayrollSetting.findOne({ where: { country: 'EG', year: 2026 } });
  if (!settings) {
    // Return hardcoded 2026 defaults as absolute fallback
    return {
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
      payrollMode: 'NO_EXEMPT_ALLOWANCES',
      allowanceEnabled: false,
      allowancePercentage: 30,
      allowanceCalculationMethod: 'PERCENTAGE_OF_BASIC',
      allowanceTaxTreatment: 'TAXABLE',
      allowanceSocialInsuranceTreatment: 'EXCLUDED_FROM_SOCIAL_INSURANCE'
    };
  }
  return settings;
}

exports.getPayrollList = async (req, res) => {
  try {
    const employees = await Employee.findAll({
      include: [
        {
          model: EmployeePayrollInsurance,
          as: 'payrollInsurance',
        }
      ],
      order: [['fullName', 'ASC']]
    });

    res.json(employees);
  } catch (error) {
    console.error('getPayrollList error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updatePayroll = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { employeeId, grossSalary, netSalary, insuredSalary } = req.body;
    const settings = await getPayrollSettings();

    let result;
    if (netSalary && !grossSalary) {
      result = calculateNetToGross(netSalary, settings);
    } else {
      result = calculateGrossToNet(grossSalary, settings);
    }

    const [payroll, created] = await EmployeePayrollInsurance.findOrCreate({
      where: { employeeId },
      defaults: {
        employeeId,
        grossSalary: result.gross,
        netSalary: result.net,
        insuredSalary: result.insuredSalary,
        employeeShare11: result.insurance,
        employerShare1875: result.employerShare
      },
      transaction: t
    });

    if (!created) {
      await payroll.update({
        grossSalary: result.gross,
        netSalary: result.net,
        insuredSalary: result.insuredSalary,
        employeeShare11: result.insurance,
        employerShare1875: result.employerShare
      }, { transaction: t });
    }

    await t.commit();
    res.json({ success: true, data: result });
  } catch (error) {
    await t.rollback();
    console.error('updatePayroll error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.calculatePreview = async (req, res) => {
  try {
    const { grossSalary, netSalary, insuredSalary, mode } = req.body;
    const settings = await getPayrollSettings();
    let result;

    if (mode === 'netToGross') {
      result = calculateNetToGross(netSalary, settings);
    } else {
      result = calculateGrossToNet(grossSalary, settings);
    }

    res.json(result);
  } catch (error) {
    console.error('calculatePreview error:', error);
    res.status(500).json({ message: 'Calculation error' });
  }
};
