/**
 * Egypt Payroll Calculator
 * Dynamic version that accepts settings as input.
 */

/**
 * Calculates annual income tax based on configurable settings.
 */
function calculateAnnualTax(taxableIncome, settings) {
  if (taxableIncome <= 0) return 0;

  let brackets = [...settings.taxBrackets];

  // Apply high income adjustments if defined
  if (settings.highIncomeAdjustments && settings.highIncomeAdjustments.length > 0) {
    const adj = settings.highIncomeAdjustments
      .filter((a) => taxableIncome > a.limit)
      .sort((a, b) => b.limit - a.limit)[0];

    if (adj) {
      if (adj.remove0) {
        // Remove brackets with rate 0 or below startingRate
        brackets = brackets.filter((b) => b.rate >= adj.startingRate);
        // Ensure the first bracket starts from 0 for calculation purposes if we removed lower ones
        if (brackets.length > 0) {
          brackets[0] = { ...brackets[0], from: 0 };
        }
      }
      if (adj.specialBracket) {
        // Special rule for very high income (e.g. > 1.2M)
        // Usually means fixed rate for first 1.2M and higher for above
        brackets = [
          { from: 0, to: adj.specialBracket.limit, rate: adj.startingRate },
          { from: adj.specialBracket.limit, to: null, rate: adj.specialBracket.rate }
        ];
      }
    }
  }

  let tax = 0;
  for (const bracket of brackets) {
    const from = bracket.from || 0;
    const to = bracket.to === null ? Infinity : bracket.to;

    if (taxableIncome > from) {
      const amountInBracket = Math.min(taxableIncome, to) - from;
      tax += amountInBracket * bracket.rate;
    }
  }
  return tax;
}

function normalizeBackendSettings(s) {
  if (!s) return {};
  const copy = Object.assign({}, s.dataValues || s);
  if (typeof copy.taxBrackets === 'string') {
    try { copy.taxBrackets = JSON.parse(copy.taxBrackets); } catch(e) { copy.taxBrackets = []; }
  }
  if (typeof copy.highIncomeAdjustments === 'string') {
    try { copy.highIncomeAdjustments = JSON.parse(copy.highIncomeAdjustments); } catch(e) { copy.highIncomeAdjustments = []; }
  }
  if (!Array.isArray(copy.taxBrackets)) copy.taxBrackets = [];
  if (!Array.isArray(copy.highIncomeAdjustments)) copy.highIncomeAdjustments = [];
  return copy;
}

/**
 * Calculates Net from Gross
 */
function calculateGrossToNet(grossSalary, rawSettings) {
  const settings = normalizeBackendSettings(rawSettings);
  const g = parseFloat(grossSalary) || 0;
  if (g <= 0) {
    return {
      gross: 0,
      basicSalary: 0,
      exemptAllowances: 0,
      net: 0,
      insurance: 0,
      tax: 0,
      martyrFund: 0,
      insuredSalary: 0,
      employerShare: 0,
      totalCost: 0,
    };
  }

  const isExemptMode =
    settings.payrollMode === 'EXEMPT_ALLOWANCES_FROM_SOCIAL_INSURANCE' ||
    settings.allowanceEnabled === true ||
    settings.allowanceEnabled === 'true' ||
    settings.allowanceEnabled === 1 ||
    settings.allowanceEnabled === '1';
  const pct = parseFloat(settings.allowancePercentage) || 30;

  let basicSalary = g;
  let exemptAllowances = 0;

  if (isExemptMode) {
    basicSalary = Math.round((g / (1 + pct / 100)) * 100) / 100;
    exemptAllowances = Math.round((g - basicSalary) * 100) / 100;
  }

  // 1. Social Insurance
  const insuredSalary = Math.max(
    settings.minInsuredSalary,
    Math.min(basicSalary, settings.maxInsuredSalary)
  );
  const employeeInsurance = Math.round(insuredSalary * settings.employeeSocialInsuranceRate * 100) / 100;
  const employerInsurance = Math.round(insuredSalary * settings.employerSocialInsuranceRate * 100) / 100;

  // 2. Martyrs Fund
  const martyrFund = Math.round(g * settings.martyrFundRate * 100) / 100;

  // 3. Income Tax
  const annualTaxableIncome =
    g * 12 - employeeInsurance * 12 - settings.annualPersonalExemption;
  const annualTax = calculateAnnualTax(annualTaxableIncome, settings);
  const monthlyTax = Math.round((annualTax / 12) * 100) / 100;

  const net = Math.round((g - employeeInsurance - monthlyTax - martyrFund) * 100) / 100;

  return {
    gross: Math.round(g * 100) / 100,
    basicSalary,
    exemptAllowances,
    net,
    insurance: employeeInsurance,
    tax: monthlyTax,
    martyrFund,
    insuredSalary,
    employerShare: employerInsurance,
    totalCost: Math.round((g + employerInsurance) * 100) / 100,
  };
}

/**
 * Calculates Gross from Net using Binary Search
 */
function calculateNetToGross(targetNet, settings) {
  if (!targetNet || targetNet <= 0) return calculateGrossToNet(0, settings);

  let low = targetNet;
  let high = targetNet * 5; // Very safe upper bound
  let bestGross = low;

  for (let i = 0; i < 64; i++) {
    const mid = (low + high) / 2;
    const res = calculateGrossToNet(mid, settings);
    if (res.net < targetNet) {
      low = mid;
    } else {
      high = mid;
      bestGross = mid;
    }
  }

  return calculateGrossToNet(bestGross, settings);
}

module.exports = {
  calculateGrossToNet,
  calculateNetToGross,
};
