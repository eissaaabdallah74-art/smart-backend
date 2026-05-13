// src/controllers/employee-loans.controller.js
const dayjs = require("dayjs");
const { Op } = require("sequelize");

const {
  sequelize,
  Employee,
  EmployeePayrollInsurance,
  AttendanceManualItem,
  EmployeeLoan,
  EmployeeLoanPolicy,
} = require("../models");

const POLICY_A = "annual_75_once";   // 75% مرة في السنة
const POLICY_B = "triple_30_three";  // 30% لحد 3 مرات في السنة
const MAX_INSTALLMENTS = 3;

function isValidMonth(month) {
  return !!month && /^\d{4}-\d{2}$/.test(month);
}

function requireAuth(req, res) {
  if (!req.user?.id) {
    res.status(401).json({ message: "Not authenticated" });
    return false;
  }
  return true;
}

function requireFinanceOrAdmin(req, res) {
  const role = req.user?.role;
  if (!(role === "admin" || role === "finance" || role === "hr")) {
    res.status(403).json({ message: "HR/Finance/Admin only" });
    return false;
  }
  return true;
}

async function getMyEmployee(req, t) {
  const emp = await Employee.findOne({
    where: { authUserId: req.user.id },
    transaction: t,
    lock: t ? t.LOCK.UPDATE : undefined,
  });
  return emp;
}

function getPolicyDefaults(policyType) {
  if (policyType === POLICY_A) return { maxPercent: 0.75, maxLoansPerYear: 1 };
  return { maxPercent: 0.30, maxLoansPerYear: 3 };
}

// ===== money helpers (cents) =====
function toCents(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}
function centsToStr(cents) {
  return (Number(cents) / 100).toFixed(2);
}

function addMonths(month, i) {
  return dayjs(`${month}-01`).add(i, "month").format("YYYY-MM");
}

function buildSchedule({ startMonth, installmentsCount, principalCents }) {
  const base = Math.floor(principalCents / installmentsCount);
  const remainder = principalCents - base * installmentsCount;

  const schedule = [];
  for (let i = 0; i < installmentsCount; i++) {
    const m = addMonths(startMonth, i);
    const cents = i === installmentsCount - 1 ? base + remainder : base;
    schedule.push({ month: m, amount: centsToStr(cents), amountCents: cents });
  }
  return schedule;
}

async function ensurePolicy(employeeId, t) {
  // هنا policy بقى "default" فقط، مش معناه إنه يمنع اختيار نوع تاني
  let policy = await EmployeeLoanPolicy.findByPk(employeeId, {
    transaction: t,
    lock: t.LOCK.UPDATE,
  });
  if (!policy) {
    policy = await EmployeeLoanPolicy.create(
      { employeeId, policyType: POLICY_B },
      { transaction: t }
    );
  }
  return policy;
}

async function autoCloseEndedLoans(employeeId, month, t) {
  await EmployeeLoan.update(
    { status: "closed", closedAt: new Date() },
    {
      where: {
        employeeId,
        status: "approved",
        endMonth: { [Op.lt]: month },
      },
      transaction: t,
    }
  );
}

async function createLoanManualItems({ loanId, employeeId, schedule, createdBy }, t) {
  const notePrefix = `[LOAN:${loanId}]`;

  const existing = await AttendanceManualItem.findAll({
    where: { employeeId, note: { [Op.like]: `${notePrefix}%` } },
    attributes: ["id", "note"],
    transaction: t,
    lock: t.LOCK.UPDATE,
  });
  const existingSet = new Set((existing || []).map((x) => String(x.note || "")));

  const rows = [];
  for (let i = 0; i < schedule.length; i++) {
    const s = schedule[i];
    const month = s.month;
    const amount = s.amount;

    const note = `${notePrefix} installment ${i + 1}/${schedule.length} for ${month}`;
    if (existingSet.has(note)) continue;

    rows.push({
      employeeId,
      month,
      date: `${month}-01`,
      direction: "deduct",
      amount,
      days: null,
      note,
      isException: false,
      createdBy: createdBy || null,
    });
  }

  if (!rows.length) return [];
  const created = await AttendanceManualItem.bulkCreate(rows, { transaction: t });
  return created.map((r) => r.id);
}

function toFrontendLoanDto(loan) {
  return {
    id: loan.id,
    employeeId: loan.employeeId,
    policyType: loan.policyType,
    amount: Number(loan.principalAmount),
    note: loan.note ?? null,
    status: loan.status,
    managerNote: loan.managerNote ?? null,
    installmentsCount: loan.installmentsCount,
    startMonth: loan.startMonth ?? null,
    approvedAt: loan.approvedAt ?? null,
    approvedById: loan.approvedById ?? null,
    createdAt: loan.createdAt,
    updatedAt: loan.updatedAt,
    employee: loan.employee
      ? { id: loan.employee.id, fullName: loan.employee.fullName, nationalId: loan.employee.nationalId }
      : undefined,
  };
}

// ======================= Employee: /me =======================

// GET /api/employee-loans/me
exports.getMyLoans = async (req, res) => {
  try {
    if (!requireAuth(req, res)) return;

    const emp = await getMyEmployee(req);
    if (!emp) return res.status(404).json({ message: "Employee profile not found" });

    const { month, status, q } = req.query;

    const where = { employeeId: emp.id };
    if (status) where.status = String(status);

    if (month && isValidMonth(String(month))) {
      where.startMonth = { [Op.lte]: String(month) };
      where.endMonth = { [Op.gte]: String(month) };
    }

    if (q) {
      const s = String(q).trim();
      if (s) {
        where[Op.or] = [
          { note: { [Op.like]: `%${s}%` } },
          { managerNote: { [Op.like]: `%${s}%` } },
          { principalAmount: { [Op.like]: `%${s}%` } },
        ];
      }
    }

    const rows = await EmployeeLoan.findAll({
      where,
      include: [{ model: Employee, as: "employee", attributes: ["id", "fullName", "nationalId"] }],
      order: [["id", "DESC"]],
      limit: 500,
    });

    return res.json(rows.map(toFrontendLoanDto));
  } catch (e) {
    console.error("getMyLoans error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// GET /api/employee-loans/me/summary
exports.getMySummary = async (req, res) => {
  try {
    if (!requireAuth(req, res)) return;

    const emp = await getMyEmployee(req);
    if (!emp) return res.status(404).json({ message: "Employee profile not found" });

    const year = Number(req.query?.year) || Number(dayjs().format("YYYY"));
    const yearStr = String(year);
    const monthNow = dayjs().format("YYYY-MM");

    const t = await sequelize.transaction();
    try {
      await autoCloseEndedLoans(emp.id, monthNow, t);

      const policyRow = await ensurePolicy(emp.id, t);
      const defaultPolicyType = policyRow?.policyType || POLICY_B;

      const payroll = await EmployeePayrollInsurance.findOne({
        where: { employeeId: emp.id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      const grossSalary = payroll?.grossSalary ?? null;
      const grossCents = toCents(grossSalary);

      const hasActiveLoan = !!(await EmployeeLoan.findOne({
        where: {
          employeeId: emp.id,
          status: "approved",
          endMonth: { [Op.gte]: monthNow },
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      }));

      // usage per policy in the same year (exclude cancelled)
      const annual75Used = (await EmployeeLoan.count({
        where: {
          employeeId: emp.id,
          policyType: POLICY_A,
          startMonth: { [Op.like]: `${yearStr}-%` },
          status: { [Op.ne]: "cancelled" },
        },
        transaction: t,
      })) > 0;

      const triple30UsedCount = await EmployeeLoan.count({
        where: {
          employeeId: emp.id,
          policyType: POLICY_B,
          startMonth: { [Op.like]: `${yearStr}-%` },
          status: { [Op.ne]: "cancelled" },
        },
        transaction: t,
      });

      // compute caps for BOTH policies
      const a = getPolicyDefaults(POLICY_A);
      const b = getPolicyDefaults(POLICY_B);

      const maxAmountAllowedA =
        grossCents ? centsToStr(Math.floor(grossCents * a.maxPercent)) : null;

      const maxAmountAllowedB =
        grossCents ? centsToStr(Math.floor(grossCents * b.maxPercent)) : null;

      await t.commit();

      return res.json({
        year,
        // legacy fields (keep them for compatibility)
        policyType: defaultPolicyType,
        hasActiveLoan,
        annual75Used,
        triple30UsedCount,
        maxPercent: b.maxPercent,
        maxTimesPerYear: b.maxLoansPerYear,
        allowedInstallments: [1, 2, 3],
        grossSalary,
        maxAmountAllowed: maxAmountAllowedB,
        message: null,

        // ✅ NEW: perPolicy for frontend toggle 30/75
        perPolicy: {
          [POLICY_A]: {
            policyType: POLICY_A,
            maxPercent: a.maxPercent,
            maxTimesPerYear: a.maxLoansPerYear,
            allowedInstallments: [1, 2, 3],
            maxAmountAllowed: maxAmountAllowedA,
            used: annual75Used ? 1 : 0,
            usedText: annual75Used ? "Used" : "0/1",
            annual75Used,
          },
          [POLICY_B]: {
            policyType: POLICY_B,
            maxPercent: b.maxPercent,
            maxTimesPerYear: b.maxLoansPerYear,
            allowedInstallments: [1, 2, 3],
            maxAmountAllowed: maxAmountAllowedB,
            used: triple30UsedCount || 0,
            usedText: `${triple30UsedCount || 0}/3`,
            triple30UsedCount,
          },
        },
      });
    } catch (e) {
      await t.rollback();
      throw e;
    }
  } catch (e) {
    console.error("getMySummary error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// POST /api/employee-loans  (employee creates pending request)
exports.createMyLoanRequest = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    if (!requireAuth(req, res)) {
      await t.rollback();
      return;
    }

    const emp = await getMyEmployee(req, t);
    if (!emp) {
      await t.rollback();
      return res.status(404).json({ message: "Employee profile not found" });
    }

    const { amount, installmentsCount, note, policyType } = req.body || {};

    // ✅ policyType must be chosen (30 or 75) — if not sent, fallback to default from policy table
    const policyRow = await ensurePolicy(emp.id, t);
    const selectedPolicyType =
      policyType === POLICY_A || policyType === POLICY_B
        ? policyType
        : (policyRow?.policyType || POLICY_B);

    const inst = Number(installmentsCount);
    if (!Number.isFinite(inst) || inst < 1 || inst > MAX_INSTALLMENTS) {
      await t.rollback();
      return res.status(400).json({ message: "installmentsCount must be 1..3" });
    }

    const month = dayjs().format("YYYY-MM");

    const payroll = await EmployeePayrollInsurance.findOne({
      where: { employeeId: emp.id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    const grossSalary = payroll?.grossSalary ?? null;
    const grossCents = toCents(grossSalary);
    if (!grossCents) {
      await t.rollback();
      return res.status(400).json({
        message: "Employee grossSalary is missing in EmployeePayrollInsurance",
      });
    }

    const { maxPercent, maxLoansPerYear } = getPolicyDefaults(selectedPolicyType);
    const maxAllowedCents = Math.floor(grossCents * maxPercent);

    const requestedCents =
      amount === null || typeof amount === "undefined" || amount === ""
        ? maxAllowedCents
        : toCents(amount);

    if (!requestedCents) {
      await t.rollback();
      return res.status(400).json({
        message: "amount must be a positive number (or omit it to use max allowed)",
      });
    }
    if (requestedCents > maxAllowedCents) {
      await t.rollback();
      return res.status(400).json({
        message: `amount exceeds max allowed (${(maxPercent * 100).toFixed(0)}% of grossSalary)`,
        maxAllowed: centsToStr(maxAllowedCents),
        policyType: selectedPolicyType,
      });
    }

    // close ended loans
    await autoCloseEndedLoans(emp.id, month, t);

    // no overlap with approved loan
    const active = await EmployeeLoan.findOne({
      where: {
        employeeId: emp.id,
        status: "approved",
        endMonth: { [Op.gte]: month },
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (active) {
      await t.rollback();
      return res.status(400).json({ message: "You already have an active loan not finished yet" });
    }

    // ✅ yearly cap per SELECTED policy (exclude cancelled)
    const year = String(month).slice(0, 4);

    const yearlyCount = await EmployeeLoan.count({
      where: {
        employeeId: emp.id,
        policyType: selectedPolicyType,
        startMonth: { [Op.like]: `${year}-%` },
        status: { [Op.ne]: "cancelled" },
      },
      transaction: t,
    });

    if (yearlyCount >= maxLoansPerYear) {
      await t.rollback();
      return res.status(400).json({
        message:
          selectedPolicyType === POLICY_A
            ? "75% loan limit reached (max 1 per year)"
            : "30% loan limit reached (max 3 per year)",
        policyType: selectedPolicyType,
      });
    }

    const schedule = buildSchedule({
      startMonth: month,
      installmentsCount: inst,
      principalCents: requestedCents,
    });
    const endMonth = schedule[schedule.length - 1].month;

    const loan = await EmployeeLoan.create(
      {
        employeeId: emp.id,
        policyType: selectedPolicyType, // ✅ IMPORTANT
        startMonth: month,
        endMonth,
        installmentsCount: inst,
        salaryGrossBase: centsToStr(grossCents),
        principalAmount: centsToStr(requestedCents),
        scheduleJson: schedule.map((s) => ({ month: s.month, amount: s.amount })),
        status: "pending",
        note: note || null,
        createdBy: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const withEmployee = await EmployeeLoan.findByPk(loan.id, {
      include: [{ model: Employee, as: "employee", attributes: ["id", "fullName", "nationalId"] }],
    });

    return res.status(201).json(toFrontendLoanDto(withEmployee));
  } catch (e) {
    await t.rollback();
    console.error("createMyLoanRequest error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ======================= Admin/Finance =======================

// GET /api/employee-loans?status&month&employeeId&q&limit&offset
exports.listLoans = async (req, res) => {
  try {
    if (!requireFinanceOrAdmin(req, res)) return;

    const { status, month, employeeId, q } = req.query;
    const limit = Math.min(Number(req.query?.limit) || 50, 500);
    const offset = Number(req.query?.offset) || 0;

    const where = {};
    if (status) where.status = String(status);
    if (employeeId) where.employeeId = Number(employeeId);

    if (month && isValidMonth(String(month))) {
      where.startMonth = { [Op.lte]: String(month) };
      where.endMonth = { [Op.gte]: String(month) };
    }

    const employeeWhere = {};
    if (q) {
      const s = String(q).trim();
      if (s) {
        employeeWhere[Op.or] = [
          { fullName: { [Op.like]: `%${s}%` } },
          { nationalId: { [Op.like]: `%${s}%` } },
        ];
      }
    }

    const result = await EmployeeLoan.findAndCountAll({
      where,
      include: [
        {
          model: Employee,
          as: "employee",
          attributes: ["id", "fullName", "nationalId"],
          ...(Object.keys(employeeWhere).length ? { where: employeeWhere } : {}),
        },
      ],
      order: [["id", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    return res.json({
      total: result.count,
      data: result.rows.map(toFrontendLoanDto),
    });
  } catch (e) {
    console.error("listLoans error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// PATCH /api/employee-loans/:id/approve
exports.approveLoan = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    if (!requireFinanceOrAdmin(req, res)) {
      await t.rollback();
      return;
    }

    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid id" });
    }

    const loan = await EmployeeLoan.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!loan) {
      await t.rollback();
      return res.status(404).json({ message: "Loan not found" });
    }
    if (loan.status !== "pending") {
      await t.rollback();
      return res.status(400).json({ message: "Only pending loans can be approved" });
    }

    const startMonth = req.body?.startMonth ? String(req.body.startMonth) : loan.startMonth;
    if (!isValidMonth(startMonth)) {
      await t.rollback();
      return res.status(400).json({ message: "startMonth must be YYYY-MM" });
    }

    const principalCents = toCents(loan.principalAmount);
    const schedule = buildSchedule({
      startMonth,
      installmentsCount: loan.installmentsCount,
      principalCents,
    });
    const endMonth = schedule[schedule.length - 1].month;

    loan.startMonth = startMonth;
    loan.endMonth = endMonth;
    loan.scheduleJson = schedule.map((s) => ({ month: s.month, amount: s.amount }));

    const manualIds = await createLoanManualItems(
      {
        loanId: loan.id,
        employeeId: loan.employeeId,
        schedule,
        createdBy: req.user?.id || null,
      },
      t
    );

    loan.manualItemIdsJson = manualIds;
    loan.status = "approved";
    loan.approvedAt = new Date();
    loan.approvedById = req.user?.id || null;
    loan.managerNote = req.body?.managerNote || loan.managerNote || null;

    await loan.save({ transaction: t });
    await t.commit();

    const withEmployee = await EmployeeLoan.findByPk(loan.id, {
      include: [{ model: Employee, as: "employee", attributes: ["id", "fullName", "nationalId"] }],
    });
    return res.json(toFrontendLoanDto(withEmployee));
  } catch (e) {
    await t.rollback();
    console.error("approveLoan error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// PATCH /api/employee-loans/:id/reject
exports.rejectLoan = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    if (!requireFinanceOrAdmin(req, res)) {
      await t.rollback();
      return;
    }

    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid id" });
    }

    const loan = await EmployeeLoan.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!loan) {
      await t.rollback();
      return res.status(404).json({ message: "Loan not found" });
    }
    if (loan.status !== "pending") {
      await t.rollback();
      return res.status(400).json({ message: "Only pending loans can be rejected" });
    }

    loan.status = "rejected";
    loan.managerNote = req.body?.managerNote || loan.managerNote || "Rejected";
    await loan.save({ transaction: t });

    await t.commit();

    const withEmployee = await EmployeeLoan.findByPk(loan.id, {
      include: [{ model: Employee, as: "employee", attributes: ["id", "fullName", "nationalId"] }],
    });
    return res.json(toFrontendLoanDto(withEmployee));
  } catch (e) {
    await t.rollback();
    console.error("rejectLoan error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ===== Policies =====
exports.listPolicies = async (req, res) => {
  try {
    if (!requireFinanceOrAdmin(req, res)) return;

    const { employeeId } = req.query;
    const where = {};
    if (employeeId) where.employeeId = Number(employeeId);

    const rows = await EmployeeLoanPolicy.findAll({
      where,
      include: [{ model: Employee, as: "employee", attributes: ["id", "fullName", "nationalId"] }],
      order: [[{ model: Employee, as: "employee" }, "fullName", "ASC"]],
    });

    return res.json(rows);
  } catch (e) {
    console.error("listPolicies error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.upsertPolicy = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    if (!requireFinanceOrAdmin(req, res)) {
      await t.rollback();
      return;
    }

    const employeeId = Number(req.params.employeeId);
    if (!employeeId || Number.isNaN(employeeId)) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid employeeId" });
    }

    const { policyType, notes } = req.body || {};
    if (!(policyType === POLICY_A || policyType === POLICY_B)) {
      await t.rollback();
      return res.status(400).json({ message: "policyType must be annual_75_once or triple_30_three" });
    }

    const emp = await Employee.findByPk(employeeId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!emp) {
      await t.rollback();
      return res.status(404).json({ message: "Employee not found" });
    }

    let row = await EmployeeLoanPolicy.findByPk(employeeId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!row) row = await EmployeeLoanPolicy.create({ employeeId }, { transaction: t });

    row.policyType = policyType;
    if (typeof notes !== "undefined") row.notes = notes || null;

    await row.save({ transaction: t });
    await t.commit();

    return res.json(row);
  } catch (e) {
    await t.rollback();
    console.error("upsertPolicy error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// cancelLoan
exports.cancelLoan = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    if (!requireFinanceOrAdmin(req, res)) {
      await t.rollback();
      return;
    }

    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid id" });
    }

    const loan = await EmployeeLoan.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!loan) {
      await t.rollback();
      return res.status(404).json({ message: "Loan not found" });
    }
    if (loan.status !== "approved") {
      await t.rollback();
      return res.status(400).json({ message: "Only approved loans can be cancelled" });
    }

    const currentMonth = dayjs().format("YYYY-MM");
    const schedule = Array.isArray(loan.scheduleJson) ? loan.scheduleJson : [];

    const notePrefix = `[LOAN:${loan.id}]`;
    const futureMonths = new Set(
      schedule
        .filter((s) => s?.month && String(s.month) >= currentMonth)
        .map((s) => String(s.month))
    );

    await AttendanceManualItem.destroy({
      where: {
        employeeId: loan.employeeId,
        note: { [Op.like]: `${notePrefix}%` },
        ...(futureMonths.size ? { month: { [Op.in]: Array.from(futureMonths) } } : {}),
      },
      transaction: t,
    });

    loan.status = "cancelled";
    loan.cancelledAt = new Date();
    loan.cancelledBy = req.user?.id || null;
    loan.cancelReason = req.body?.reason || null;

    await loan.save({ transaction: t });
    await t.commit();

    return res.json({ ok: true, loan: toFrontendLoanDto(loan) });
  } catch (e) {
    await t.rollback();
    console.error("cancelLoan error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};
