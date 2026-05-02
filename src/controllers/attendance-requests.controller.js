// src/controllers/attendance-requests.controller.js
const { Op, DataTypes } = require("sequelize");
const {
  AttendanceRequest,
  AttendanceImport,
  Employee,
  PublicHoliday,
  sequelize,
} = require("../models");

const {
  computeMonthForImport,
} = require("../services/attendance/computeAttendance.service");

// Define EmployeeLeaveBalance model dynamically (no need to edit models/index.js)
const EmployeeLeaveBalance =
  sequelize.models.EmployeeLeaveBalance ||
  require("../models/employee-leave-balance.model")(sequelize, DataTypes);

function isValidMonth(month) {
  return !!month && /^\d{4}-\d{2}$/.test(month);
}

function isValidDate(date) {
  return !!date && /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function getEmployeeIdFromUser(user) {
  const v = user?.employeeId ?? user?.employee_id;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function roleOf(user) {
  return String(user?.role || "").toLowerCase();
}

function isAdmin(user) {
  return roleOf(user) === "admin";
}

// ✅ خليها متوافقة مع requireHRorAdmin
function isHRorAdmin(user) {
  const r = roleOf(user);
  return r === "admin" || r === "hr";
}

async function getLatestDoneImport(month) {
  return AttendanceImport.findOne({
    where: { month, status: "done" },
    order: [["id", "DESC"]],
  });
}

/**
 * ✅ Helper: get EmployeeEmployment model safely (if exists)
 * (اسم الموديل غالبًا EmployeeEmployment في sequelize.models)
 */
function getEmployeeEmploymentModel() {
  return sequelize.models.EmployeeEmployment || null;
}

/**
 * ✅ Helper: tries to read annual balance from EmployeeEmployment if available
 */
async function getAnnualTotalFromEmployment(employeeId, t) {
  const EmpEmployment = getEmployeeEmploymentModel();
  if (!EmpEmployment) return null;

  const row = await EmpEmployment.findOne({
    where: { employeeId },
    transaction: t,
    lock: t.LOCK.UPDATE,
  });

  if (!row) return null;

  const total = Number(row.annualLeaveBalance);
  if (Number.isFinite(total) && total > 0) return total;

  return null;
}

/**
 * ✅ Helper: sync employment annual fields to match leave-balance table
 */
async function syncEmploymentAnnual(employeeId, total, used, t) {
  const EmpEmployment = getEmployeeEmploymentModel();
  if (!EmpEmployment) return;

  const row = await EmpEmployment.findOne({
    where: { employeeId },
    transaction: t,
    lock: t.LOCK.UPDATE,
  });

  if (!row) return;

  const remaining = Math.max(Number(total) - Number(used), 0);

  // مهم: دي أسماء attributes في موديل sequelize (مش أسماء الأعمدة في DB)
  // لو موديلك مستخدم camelCase (زي الواجهة) ده هيشتغل مباشرة.
  await row.update(
    {
      annualLeaveBalance: Number(total),
      annualLeaveUsed: Number(used),
      annualLeaveRemaining: Number(remaining),
    },
    { transaction: t }
  );
}

// ========= Employee: Create Request =========
// POST /api/attendance/requests/mine
// body:
// - excuse_minutes: { type:"excuse_minutes", date:"YYYY-MM-DD", minutes:1..120, note? }
// - leave_day: { type:"leave_day", date:"YYYY-MM-DD", leaveType:"annual|sick|errand", note? }
exports.createMyRequest = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    if (isAdmin(req.user)) {
      await t.rollback();
      return res
        .status(403)
        .json({ message: "Admin cannot create attendance requests" });
    }

    const employeeId = getEmployeeIdFromUser(req.user);
    if (!employeeId) {
      await t.rollback();
      return res.status(401).json({ message: "Unauthorized employee" });
    }

    const body = req.body || {};
    const type = String(body.type || "").trim();

    const date = body.date;
    if (!isValidDate(date)) {
      await t.rollback();
      return res.status(400).json({ message: "date is required: YYYY-MM-DD" });
    }

    const month = String(date).slice(0, 7);
    if (!isValidMonth(month)) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid month derived from date" });
    }

    if (!["excuse_minutes", "leave_day"].includes(type)) {
      await t.rollback();
      return res.status(400).json({ message: "type must be excuse_minutes | leave_day" });
    }

    // ensure employee exists
    const emp = await Employee.findByPk(employeeId, { transaction: t });
    if (!emp) {
      await t.rollback();
      return res.status(404).json({ message: "Employee not found" });
    }

    // prevent day conflicts (pending/approved only)
    const existingDay = await AttendanceRequest.findAll({
      where: {
        employeeId,
        date,
        status: { [Op.in]: ["pending", "approved"] },
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (existingDay.length > 0) {
      const hasLeave = existingDay.some((r) => r.type === "leave_day");
      if (hasLeave) {
        await t.rollback();
        return res.status(400).json({ message: "A leave request already exists for this date" });
      }
      if (type === "leave_day") {
        await t.rollback();
        return res.status(400).json({ message: "An excuse request already exists for this date" });
      }
      const sameType = existingDay.some((r) => r.type === type);
      if (sameType) {
        await t.rollback();
        return res.status(400).json({ message: "Request already exists for this date/type" });
      }
    }

    let minutes = null;
    let leaveType = null;

    // ===== excuse_minutes rules =====
    if (type === "excuse_minutes") {
      minutes = Number(body.minutes);

      if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 120) {
        await t.rollback();
        return res.status(400).json({ message: "minutes must be 1..120" });
      }

      const start = `${month}-01`;
      const [y, m] = String(month).split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${month}-${String(lastDay).padStart(2, "0")}`;

      // max 2 requests/month + max total 240 mins (pending + approved)
      const existingMonth = await AttendanceRequest.findAll({
        where: {
          employeeId,
          month,
          type: "excuse_minutes",
          status: { [Op.in]: ["pending", "approved"] },
          date: { [Op.between]: [start, end] },
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      const count = existingMonth.length;
      const total = existingMonth.reduce((a, r) => a + Number(r.minutes || 0), 0);

      if (count >= 2) {
        await t.rollback();
        return res.status(400).json({ message: "Monthly excuses limit reached (max 2 requests)" });
      }
      if (total + minutes > 240) {
        await t.rollback();
        return res.status(400).json({ message: "Monthly excuses minutes limit exceeded (max 240)" });
      }
    }

    // ===== leave_day rules =====
    if (type === "leave_day") {
      leaveType = String(body.leaveType || "").trim();

      const allowed = new Set(["annual", "sick", "errand"]);
      if (!allowed.has(leaveType)) {
        await t.rollback();
        return res.status(400).json({ message: "leaveType must be one of: annual, sick, errand" });
      }
    }

    const row = await AttendanceRequest.create(
      {
        employeeId,
        month,
        date,
        type,
        minutes,
        leaveType,
        note: body.note || null,
        status: "pending",
        createdBy: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();
    return res.status(201).json(row);
  } catch (e) {
    await t.rollback();
    if (String(e?.name || "").includes("SequelizeUniqueConstraintError")) {
      return res.status(400).json({ message: "Duplicate request for same date/type" });
    }
    console.error("createMyRequest error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ========= Employee: List My Requests =========
// GET /api/attendance/requests/mine?month=YYYY-MM
exports.listMyRequests = async (req, res) => {
  try {
    const employeeId = getEmployeeIdFromUser(req.user);
    if (!employeeId) return res.status(401).json({ message: "Unauthorized employee" });

    const { month } = req.query || {};
    const where = { employeeId };

    if (month) {
      if (!isValidMonth(month)) return res.status(400).json({ message: "month must be YYYY-MM" });
      where.month = month;
    }

    const rows = await AttendanceRequest.findAll({
      where,
      order: [["date", "ASC"], ["id", "ASC"]],
      limit: 2000,
    });

    return res.json(rows);
  } catch (e) {
    console.error("listMyRequests error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ========= Employee: Cancel Pending =========
// DELETE /api/attendance/requests/:id
exports.cancelMyRequest = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const employeeId = getEmployeeIdFromUser(req.user);
    if (!employeeId) {
      await t.rollback();
      return res.status(401).json({ message: "Unauthorized employee" });
    }

    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid id" });
    }

    const row = await AttendanceRequest.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!row) {
      await t.rollback();
      return res.status(404).json({ message: "Request not found" });
    }

    if (Number(row.employeeId) !== Number(employeeId)) {
      await t.rollback();
      return res.status(403).json({ message: "Not allowed" });
    }

    if (row.status !== "pending") {
      await t.rollback();
      return res.status(409).json({ message: "Only pending requests can be cancelled" });
    }

    row.status = "cancelled";
    await row.save({ transaction: t });
    await t.commit();

    return res.json({ ok: true, cancelled: true, id: row.id });
  } catch (e) {
    await t.rollback();
    console.error("cancelMyRequest error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ========= Admin/HR: List All Requests =========
// GET /api/attendance/requests?month=YYYY-MM&status=pending|approved|rejected|cancelled&employeeId=
exports.listAllRequests = async (req, res) => {
  try {
    if (!isHRorAdmin(req.user)) return res.status(403).json({ message: "HR/Admin only" });

    const { month, status, employeeId } = req.query || {};
    const where = {};

    if (month) {
      if (!isValidMonth(month)) return res.status(400).json({ message: "month must be YYYY-MM" });
      where.month = month;
    }

    if (status) {
      const s = String(status);
      if (!["pending", "approved", "rejected", "cancelled"].includes(s)) {
        return res.status(400).json({ message: "status invalid" });
      }
      where.status = s;
    }

    if (employeeId) where.employeeId = Number(employeeId);

    const rows = await AttendanceRequest.findAll({
      where,
      include: [{ model: Employee, as: "employee", attributes: ["id", "fullName", "nationalId"] }],
      order: [["createdAt", "ASC"], ["id", "ASC"]],
      limit: 5000,
    });

    return res.json(rows);
  } catch (e) {
    console.error("listAllRequests error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ========= Admin/HR: Decide Request =========
// PATCH /api/attendance/requests/:id/decision
// body: { status:'approved'|'rejected', decisionNote? }
exports.decideRequest = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    if (!isHRorAdmin(req.user)) {
      await t.rollback();
      return res.status(403).json({ message: "HR/Admin only" });
    }

    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid id" });
    }

    const nextStatus = String(req.body?.status || "").toLowerCase();
    if (!["approved", "rejected"].includes(nextStatus)) {
      await t.rollback();
      return res.status(400).json({ message: "status must be approved | rejected" });
    }

    const row = await AttendanceRequest.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!row) {
      await t.rollback();
      return res.status(404).json({ message: "Request not found" });
    }

    if (row.status !== "pending") {
      await t.rollback();
      return res.status(409).json({ message: "Only pending requests can be decided" });
    }

    // ===== ✅ annual leave balance rule (only on approve) =====
    if (nextStatus === "approved" && row.type === "leave_day" && row.leaveType === "annual") {
      // ✅ Public Holiday Check
      const isPublicHoliday = await PublicHoliday.findOne({
        where: { date: row.date },
        transaction: t,
        lock: t.LOCK.SHARE
      });

      if (isPublicHoliday) {
         console.log(`[PublicHoliday Skip] Request ID ${id} is on ${row.date} (${isPublicHoliday.name}). Skipping balance deduction.`);
      } else {
        // 1) Try to take annual total from employment (if exists) for consistency with EmployeeDetails UI
        const totalFromEmployment = await getAnnualTotalFromEmployment(row.employeeId, t);

        // 2) Get/Create leave balance with row lock
        let bal = await EmployeeLeaveBalance.findByPk(row.employeeId, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (!bal) {
          const initTotal = Number.isFinite(Number(totalFromEmployment)) && Number(totalFromEmployment) > 0
            ? Number(totalFromEmployment)
            : 21.0;

          bal = await EmployeeLeaveBalance.create(
            { employeeId: row.employeeId, annualTotalDays: initTotal, annualUsedDays: 0.0 },
            { transaction: t }
          );
        }

        // 3) Keep totals aligned (prefer employment total if present)
        const total =
          Number.isFinite(Number(totalFromEmployment)) && Number(totalFromEmployment) > 0
            ? Number(totalFromEmployment)
            : Number(bal.annualTotalDays || 0);

        const used = Number(bal.annualUsedDays || 0);
        const remaining = Number(total) - Number(used);

        if (remaining < 1) {
          await t.rollback();
          return res.status(400).json({ message: "Insufficient annual leave balance" });
        }

        // ✅ update leave-balance table
        bal.annualTotalDays = total;
        bal.annualUsedDays = used + 1;
        await bal.save({ transaction: t });

        // ✅ IMPORTANT: update employment fields so EmployeeDetails reflects the new balance
        await syncEmploymentAnnual(row.employeeId, total, used + 1, t);
      }
    }

    row.status = nextStatus;
    row.decidedBy = req.user?.id || null;
    row.decidedAt = new Date();
    row.decisionNote = req.body?.decisionNote || null;

    await row.save({ transaction: t });
    await t.commit();

    // recompute (if there's a done import for that month)
    const imp = await getLatestDoneImport(row.month);
    if (imp) await computeMonthForImport(imp.id);

    return res.json({
      ok: true,
      id: row.id,
      month: row.month,
      status: row.status,
      recomputed: !!imp,
      importId: imp?.id || null,
    });
  } catch (e) {
    await t.rollback();
    console.error("decideRequest error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};
