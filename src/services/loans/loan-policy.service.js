// src/services/loans/loan-policy.service.js
const { Op } = require("sequelize");
const { EmployeeLoan, EmployeePayrollInsurance } = require("../../models");
const { isValidMonth, getYearFromMonth } = require("./loan-month.utils");

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function getEmployeeGrossSalary(employeeId, { transaction } = {}) {
  const payroll = await EmployeePayrollInsurance.findOne({ where: { employeeId }, transaction });
  const gross = payroll?.grossSalary;
  return gross === null || typeof gross === "undefined" ? 0 : toNum(gross);
}

async function getYearTotals(employeeId, year, { transaction } = {}) {
  // loans in that year, based on startMonth's year
  // since startMonth is YYYY-MM, we can filter between year-01 and year-12 lexicographically safely.
  const from = `${year}-01`;
  const to = `${year}-12`;

  const rows = await EmployeeLoan.findAll({
    where: {
      employeeId,
      startMonth: { [Op.gte]: from, [Op.lte]: to },
      // count anything not canceled/rejected (you can tweak later)
      status: { [Op.notIn]: ["canceled", "rejected"] },
    },
    attributes: ["id", "type", "principalAmount", "tenureMonths", "startMonth", "status"],
    transaction,
  });

  const byType = new Map(); // type -> {count, sum}
  for (const r of rows) {
    const type = String(r.type);
    const curr = byType.get(type) || { count: 0, sum: 0 };
    curr.count += 1;
    curr.sum += toNum(r.principalAmount);
    byType.set(type, curr);
  }

  const totalAll = rows.reduce((a, r) => a + toNum(r.principalAmount), 0);

  return { rows, byType, totalAll };
}

function validateRequestBasics({ type, principalAmount, tenureMonths, startMonth }) {
  const errors = [];

  const t = String(type || "");
  if (!(t === "A_75" || t === "B_30")) errors.push("Invalid EmployeeLoan type. Allowed: A_75, B_30.");

  const amt = Number(principalAmount);
  if (!Number.isFinite(amt) || amt <= 0) errors.push("principalAmount must be a positive number.");

  const months = Number(tenureMonths);
  if (!Number.isFinite(months) || months < 1 || months > 3)
    errors.push("tenureMonths must be 1..3.");

  if (!isValidMonth(startMonth)) errors.push("startMonth is required format YYYY-MM.");

  return { ok: errors.length === 0, errors };
}

async function assertLoanAllowed({
  employeeId,
  type,
  principalAmount,
  tenureMonths,
  startMonth,
}, { transaction } = {}) {
  const basic = validateRequestBasics({ type, principalAmount, tenureMonths, startMonth });
  if (!basic.ok) {
    return { ok: false, code: "VALIDATION", errors: basic.errors };
  }

  const year = getYearFromMonth(startMonth);
  if (!year) return { ok: false, code: "VALIDATION", errors: ["Invalid startMonth year."] };

  const grossSalary = await getEmployeeGrossSalary(employeeId, { transaction });
  if (!grossSalary || grossSalary <= 0) {
    return { ok: false, code: "NO_SALARY", errors: ["Employee grossSalary is missing or zero."] };
  }

  const totals = await getYearTotals(employeeId, year, { transaction });
  const t = String(type);

  const current = totals.byType.get(t) || { count: 0, sum: 0 };
  const requestedAmount = toNum(principalAmount);

  if (t === "A_75") {
    if (current.count >= 3) {
      return { ok: false, code: "LIMIT_COUNT", errors: ["A_75 yearly loans limit reached (max 3)."] };
    }

    // limit sum principals in year for A_75: <= 75% gross
    const limit = grossSalary * 0.75;
    if (current.sum + requestedAmount > limit + 1e-9) {
      return {
        ok: false,
        code: "LIMIT_AMOUNT",
        errors: [`A_75 yearly amount exceeded. Allowed <= 75% gross (${limit.toFixed(2)}).`],
        meta: { grossSalary, limit, currentSum: current.sum },
      };
    }
  }

  if (t === "B_30") {
    if (current.count >= 1) {
      return { ok: false, code: "LIMIT_COUNT", errors: ["B_30 yearly loans limit reached (max 1)."] };
    }

    const limit = grossSalary * 0.30;
    if (current.sum + requestedAmount > limit + 1e-9) {
      return {
        ok: false,
        code: "LIMIT_AMOUNT",
        errors: [`B_30 yearly amount exceeded. Allowed <= 30% gross (${limit.toFixed(2)}).`],
        meta: { grossSalary, limit, currentSum: current.sum },
      };
    }
  }

  return { ok: true, meta: { grossSalary, year, existing: totals.rows.length } };
}

module.exports = {
  validateRequestBasics,
  assertLoanAllowed,
  getEmployeeGrossSalary,
  getYearTotals,
};
