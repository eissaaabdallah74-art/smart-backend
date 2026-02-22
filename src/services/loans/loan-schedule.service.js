// src/services/loans/loan-schedule.service.js
const { EmployeeLoan, EmployeeLoanInstallment, sequelize } = require("../../models");
const { addMonths, isValidMonth } = require("./loan-month.utils");

function round2(n) {
  const x = Number(n);
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function buildInstallments({ loanId, employeeId, startMonth, principalAmount, tenureMonths }) {
  if (!loanId) throw new Error("loanId is required");
  if (!employeeId) throw new Error("employeeId is required");
  if (!isValidMonth(startMonth)) throw new Error("startMonth invalid");

  const tenure = Number(tenureMonths);
  if (!Number.isFinite(tenure) || tenure < 1 || tenure > 3) {
    throw new Error("tenureMonths must be 1..3");
  }

  const principal = toNum(principalAmount);
  if (principal <= 0) throw new Error("principalAmount must be > 0");

  const base = round2(principal / tenure);
  const rows = [];

  // First (tenure-1) installments = base, last = remaining to match exact principal
  let sum = 0;
  for (let i = 0; i < tenure; i++) {
    const month = addMonths(startMonth, i);
    const amount = i === tenure - 1 ? round2(principal - sum) : base;
    sum = round2(sum + amount);

    rows.push({
      loanId,
      employeeId,
      month,
      amount,
      status: "pending",
      deductedAt: null,
      payrollRunId: null,
    });
  }

  return rows;
}

/**
 * Create installments for a loan (idempotent)
 * - relies on unique index (loan_id, month)
 */
async function ensureLoanInstallments(loanId, { transaction } = {}) {
  const t = transaction || (await sequelize.transaction());
  const ownTx = !transaction;

  try {
    const loan = await EmployeeLoan.findByPk(loanId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!loan) throw new Error("EmployeeLoan not found");

    if (!loan.startMonth || !loan.principalAmount || !loan.tenureMonths) {
      throw new Error("EmployeeLoan missing startMonth/principalAmount/tenureMonths");
    }

    const rows = buildInstallments({
      loanId: loan.id,
      employeeId: loan.employeeId,
      startMonth: loan.startMonth,
      principalAmount: loan.principalAmount,
      tenureMonths: loan.tenureMonths,
    });

    // create if not exists (unique index will protect)
    await EmployeeLoanInstallment.bulkCreate(rows, {
      transaction: t,
      ignoreDuplicates: true, // works on MySQL; SQLite depends on dialect/version
    });

    // cache monthlyInstallmentAmount on loan (optional)
    const monthly = rows.length ? rows[0].amount : null;
    if (monthly !== null && String(loan.monthlyInstallmentAmount || "") !== String(monthly)) {
      loan.monthlyInstallmentAmount = monthly;
      await loan.save({ transaction: t });
    }

    if (ownTx) await t.commit();

    return { ok: true, loanId: loan.id, installmentsCount: rows.length };
  } catch (e) {
    if (ownTx) await t.rollback();
    throw e;
  }
}

module.exports = { buildInstallments, ensureLoanInstallments };
