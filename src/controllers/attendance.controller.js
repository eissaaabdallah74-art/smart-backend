const multer = require("multer");
const { Op } = require("sequelize");
const {
  AttendanceImport,
  AttendanceDay,
  AttendanceMonthlySummary,
  Employee,
  EmployeeAttendanceProfile,
  AttendanceUnmatchedRow,
  AttendanceManualItem,
  AttendanceRequest,
  PublicHoliday,
  sequelize,
} = require("../models");

const { importAttendanceFromBuffer, syncAttendanceFromRawLogs } = require("../services/attendance/importAttendance.service");
const { computeMonthForImport } = require("../services/attendance/computeAttendance.service");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

exports.uploadMiddleware = upload.single("file");

function isValidMonth(month) {
  return !!month && /^\d{4}-\d{2}$/.test(month);
}

function isValidDate(date) {
  return !!date && /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function getMonthBounds(month) {
  const [y, m] = String(month).split("-").map((x) => Number(x));
  const lastDay = new Date(y, m, 0).getDate();
  return {
    start: `${month}-01`,
    end: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function canViewSalary(role) {
  return role === "admin" || role === "finance";
}

function canManageRequests(role) {
  return role === "admin" || role === "hr";
}

function getActor(req) {
  return {
    userId: req.user?.id || null,
    role: req.user?.role || "user",
    employeeId: req.user?.employeeId || null, // مهم يكون عندك mapping user -> employee
  };
}

async function getLatestDoneImport(month) {
  return AttendanceImport.findOne({
    where: { month, status: "done" },
    order: [["id", "DESC"]],
  });
}

// ================= Imports =================

// POST /api/attendance/import
exports.importSheet = async (req, res) => {
  try {
    if (!req.file?.buffer)
      return res.status(400).json({ message: "file is required (form-data: file)" });

    const result = await importAttendanceFromBuffer({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      uploadedBy: req.user?.id,
    });

    if (!result.ok)
      return res.status(400).json({ message: result.message || "Import failed" });

    // compute right away
    await computeMonthForImport(result.importId);

    return res.status(201).json({
      importId: result.importId,
      month: result.month,
      workingDaysCount: result.workingDaysCount,
      matchedRowsCount: result.matchedRowsCount,
      unmatchedSample: result.unmatchedSample,
    });
  } catch (e) {
    console.error("importSheet error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// POST /api/attendance/sync-from-logs
exports.syncFromLogs = async (req, res) => {
  try {
    const { month, startTime } = req.body;
    if (!isValidMonth(month)) {
      return res.status(400).json({ message: "Invalid month format (YYYY-MM)" });
    }

    const result = await syncAttendanceFromRawLogs({
      month,
      uploadedBy: req.user?.id,
      startTime: startTime || "09:00"
    });

    if (!result.ok) {
      return res.status(400).json({ message: result.message || "Sync failed" });
    }

    // compute right away
    await computeMonthForImport(result.importId);

    return res.status(201).json(result);
  } catch (e) {
    console.error("syncFromLogs error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// GET /api/attendance/imports?month=YYYY-MM
exports.listImports = async (req, res) => {
  try {
    const { month } = req.query;
    const where = {};
    if (month) where.month = month;

    const rows = await AttendanceImport.findAll({
      where,
      order: [["id", "DESC"]],
      limit: 30,
    });

    return res.json(rows);
  } catch (e) {
    console.error("listImports error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// GET /api/attendance/monthly-summary?month=YYYY-MM&includeSalary=true
exports.getMonthlySummary = async (req, res) => {
  try {
    const { month, includeSalary } = req.query;
    if (!isValidMonth(month))
      return res.status(400).json({ message: "month is required: YYYY-MM" });

    const imp = await getLatestDoneImport(month);
    if (!imp)
      return res.json({ month, importId: null, workingDaysCount: 0, data: [] });

    const wantSalary = includeSalary === "true";
    if (wantSalary && !canViewSalary(req.user?.role)) {
      return res.status(403).json({ message: "Finance/Admin only to view salary deductions" });
    }

    const attrs = wantSalary
      ? undefined
      : { exclude: ["salary_gross_used", "day_rate", "deduction_amount"] };

    const rows = await AttendanceMonthlySummary.findAll({
      where: { importId: imp.id },
      include: [
        {
          model: Employee,
          as: "employee",
          attributes: ["id", "fullName", "nationalId"],
        },
      ],
      order: [[{ model: Employee, as: "employee" }, "fullName", "ASC"]],
      attributes: attrs,
    });

    // ✅ Fetch Approved Requests for the month (vacations & permissions)
    const requests = await AttendanceRequest.findAll({
      where: { month, status: "approved" },
      attributes: ["id", "employeeId", "type", "minutes"],
    });

    const reqByEmp = new Map();
    for (const r of requests) {
      if (!reqByEmp.has(r.employeeId)) reqByEmp.set(r.employeeId, { vacations: 0, permissions: 0 });
      const st = reqByEmp.get(r.employeeId);
      if (r.type === "leave_day") st.vacations++;
      if (r.type === "excuse_minutes" && Number(r.minutes) >= 120) st.permissions++;
    }

    // ✅ Fetch Public Holidays for the month
    const holidays = await PublicHoliday.findAll({
      where: { date: { [Op.startsWith]: month } },
      order: [["date", "ASC"]],
    });

    const data = rows.map((r) => {
      const st = reqByEmp.get(r.employeeId) || { vacations: 0, permissions: 0 };
      const row = r.toJSON();
      row.vacationsCount = st.vacations;
      row.permissionsCount = st.permissions;
      return row;
    });

    return res.json({
      month,
      importId: imp.id,
      workingDaysCount: imp.workingDaysCount,
      holidays,
      data,
    });
  } catch (e) {
    console.error("getMonthlySummary error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// GET /api/attendance/unmatched?month=YYYY-MM
exports.getUnmatchedRows = async (req, res) => {
  try {
    const { month } = req.query;
    if (!isValidMonth(month))
      return res.status(400).json({ message: "month is required: YYYY-MM" });

    const imp = await getLatestDoneImport(month);
    if (!imp) {
      return res.json({
        month,
        importId: null,
        workingDaysCount: 0,
        total: 0,
        data: [],
      });
    }

    if (AttendanceUnmatchedRow) {
      const rows = await AttendanceUnmatchedRow.findAll({
        where: { importId: imp.id, isResolved: false },
        order: [["id", "ASC"]],
        limit: 3000,
      });

      const total = await AttendanceUnmatchedRow.count({
        where: { importId: imp.id, isResolved: false },
      });

      return res.json({
        month,
        importId: imp.id,
        workingDaysCount: imp.workingDaysCount || 0,
        total,
        data: rows.map((r) => ({
          key: String(r.id),
          empNo: r.empNo || null,
          acNo: r.acNo || null,
          name: r.name || null,
          nationalId: r.nationalId || null,
          rowIndex: typeof r.rowIndex === "number" ? r.rowIndex : null,
        })),
      });
    }

    let sample =
      imp.unmatchedSampleJson ||
      imp.unmatched_sample_json ||
      imp.unmatchedSample ||
      imp.unmatched_sample ||
      null;

    if (typeof sample === "string") {
      try {
        sample = JSON.parse(sample);
      } catch (_) {
        sample = null;
      }
    }

    const data = Array.isArray(sample) ? sample : [];

    return res.json({
      month,
      importId: imp.id,
      workingDaysCount: imp.workingDaysCount || 0,
      total: data.length,
      data,
      note: "unmatched rows are returned from unmatchedSample fallback. Persist unmatched rows for full list.",
    });
  } catch (e) {
    console.error("getUnmatchedRows error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// POST /api/attendance/mapping  body: { employeeId, empNo, acNo, notes? }
exports.upsertMappingFromBody = async (req, res) => {
  try {
    const { employeeId } = req.body || {};
    if (!employeeId)
      return res.status(400).json({ message: "employeeId is required" });

    req.params.employeeId = String(employeeId);

    const { attendanceEmpNo, attendanceAcNo, empNo, acNo, notes } = req.body || {};
    req.body = {
      attendanceEmpNo: typeof attendanceEmpNo !== "undefined" ? attendanceEmpNo : empNo,
      attendanceAcNo: typeof attendanceAcNo !== "undefined" ? attendanceAcNo : acNo,
      notes,
    };

    return exports.upsertMapping(req, res);
  } catch (e) {
    console.error("upsertMappingFromBody error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// PUT /api/attendance/mapping/:employeeId
exports.upsertMapping = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const employeeId = Number(req.params.employeeId);
    if (Number.isNaN(employeeId)) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid employeeId" });
    }

    const employee = await Employee.findByPk(employeeId, { transaction: t });
    if (!employee) {
      await t.rollback();
      return res.status(404).json({ message: "Employee not found" });
    }

    const body = req.body || {};
    const attendanceEmpNo =
      typeof body.attendanceEmpNo !== "undefined" ? body.attendanceEmpNo : body.empNo;
    const attendanceAcNo =
      typeof body.attendanceAcNo !== "undefined" ? body.attendanceAcNo : body.acNo;
    const notes = body.notes;

    if (attendanceEmpNo) {
      const ex = await EmployeeAttendanceProfile.findOne({
        where: {
          attendanceEmpNo: String(attendanceEmpNo).trim(),
          employeeId: { [Op.ne]: employeeId },
        },
        transaction: t,
      });
      if (ex) {
        await t.rollback();
        return res.status(400).json({ message: "attendanceEmpNo already linked to another employee" });
      }
    }

    if (attendanceAcNo) {
      const ex = await EmployeeAttendanceProfile.findOne({
        where: {
          attendanceAcNo: String(attendanceAcNo).trim(),
          employeeId: { [Op.ne]: employeeId },
        },
        transaction: t,
      });
      if (ex) {
        await t.rollback();
        return res.status(400).json({ message: "attendanceAcNo already linked to another employee" });
      }
    }

    let profile = await EmployeeAttendanceProfile.findByPk(employeeId, { transaction: t });
    if (!profile) profile = await EmployeeAttendanceProfile.create({ employeeId }, { transaction: t });

    if (typeof attendanceEmpNo !== "undefined")
      profile.attendanceEmpNo = attendanceEmpNo ? String(attendanceEmpNo).trim() : null;

    if (typeof attendanceAcNo !== "undefined")
      profile.attendanceAcNo = attendanceAcNo ? String(attendanceAcNo).trim() : null;

    if (typeof notes !== "undefined") profile.notes = notes || null;

    await profile.save({ transaction: t });
    await t.commit();

    return res.json(profile);
  } catch (e) {
    await t.rollback();
    console.error("upsertMapping error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// POST /api/attendance/recompute?month=YYYY-MM
exports.recomputeMonth = async (req, res) => {
  try {
    const { month } = req.query;
    if (!isValidMonth(month))
      return res.status(400).json({ message: "month is required: YYYY-MM" });

    // يفضل تحصرها HR/Admin
    if (!canManageRequests(req.user?.role)) {
      return res.status(403).json({ message: "HR/Admin only" });
    }

    const imp = await getLatestDoneImport(month);
    if (!imp)
      return res.status(404).json({ message: "No done import found for this month" });

    await computeMonthForImport(imp.id);

    return res.json({ ok: true, month, importId: imp.id });
  } catch (e) {
    console.error("recomputeMonth error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ================= Requests (NEW FLOW) =================

// POST /api/attendance/requests
// body:
//  - excuse_minutes: { employeeId?, date, minutes, note? }
//  - leave_day:      { employeeId?, date, leaveType, note? }
exports.createRequest = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const actor = getActor(req);
    const body = req.body || {};

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

    // تحديد employeeId
    let employeeId = null;

    // لو user مربوط بـ employeeId ومش HR/Admin => يبقى Self فقط
    if (actor.employeeId && !canManageRequests(actor.role)) {
      employeeId = Number(actor.employeeId);
    } else {
      employeeId = Number(body.employeeId);
    }

    if (!employeeId || Number.isNaN(employeeId)) {
      await t.rollback();
      return res.status(400).json({ message: "employeeId is required" });
    }

    const employee = await Employee.findByPk(employeeId, { transaction: t });
    if (!employee) {
      await t.rollback();
      return res.status(404).json({ message: "Employee not found" });
    }

    const type = String(body.type || "").trim();
    if (!type || !["excuse_minutes", "leave_day"].includes(type)) {
      await t.rollback();
      return res.status(400).json({ message: "type must be excuse_minutes | leave_day" });
    }

    // تمنع تعارض نفس اليوم (pending/approved)
    const dayConflicts = await AttendanceRequest.findAll({
      where: {
        employeeId,
        date,
        status: { [Op.in]: ["pending", "approved"] },
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (dayConflicts.length > 0) {
      // لو فيه leave_day pending/approved على نفس اليوم => ممنوع أي حاجة تانية
      const hasLeave = dayConflicts.some((r) => r.type === "leave_day");
      if (hasLeave) {
        await t.rollback();
        return res.status(400).json({ message: "A leave request already exists for this date" });
      }
      // لو انت بتطلب leave_day وفيه excuse_minutes على نفس اليوم => امنع
      if (type === "leave_day") {
        await t.rollback();
        return res.status(400).json({ message: "An excuse request already exists for this date" });
      }
      // لو نفس النوع موجود => امنع duplicate
      const sameType = dayConflicts.some((r) => r.type === type);
      if (sameType) {
        await t.rollback();
        return res.status(400).json({ message: "Request already exists for this date" });
      }
    }

    // rules for excuse_minutes
    let minutes = null;
    let leaveType = null;

    if (type === "excuse_minutes") {
      minutes = Number(body.minutes);
      if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 120) {
        await t.rollback();
        return res.status(400).json({ message: "minutes must be 1..120" });
      }

      const { start, end } = getMonthBounds(month);

      const existing = await AttendanceRequest.findAll({
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

      const count = existing.length;
      const total = existing.reduce((a, r) => a + Number(r.minutes || 0), 0);

      if (count >= 2) {
        await t.rollback();
        return res.status(400).json({ message: "Monthly excuses limit reached (max 2 requests)" });
      }
      if (total + minutes > 240) {
        await t.rollback();
        return res.status(400).json({ message: "Monthly excuses minutes limit exceeded (max 240)" });
      }
    }

    // rules for leave_day
    if (type === "leave_day") {
      leaveType = String(body.leaveType || "annual").trim() || "annual";
      // optional: restrict values
      const allowed = new Set(["annual", "sick", "unpaid", "official"]);
      if (!allowed.has(leaveType)) {
        await t.rollback();
        return res.status(400).json({ message: "leaveType must be one of: annual, sick, unpaid, official" });
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
        status: "pending",
        note: body.note || null,
        createdBy: actor.userId,
      },
      { transaction: t }
    );

    await t.commit();
    return res.status(201).json(row);
  } catch (e) {
    await t.rollback();
    console.error("createRequest error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// GET /api/attendance/requests?month=YYYY-MM&status=pending|approved|rejected&employeeId=
// - Employee: يرجع طلباته فقط
// - HR/Admin: يقدر يشوف الكل
exports.listRequests = async (req, res) => {
  try {
    const actor = getActor(req);
    const { month, status, employeeId } = req.query;

    const where = {};

    if (month) {
      if (!isValidMonth(month)) return res.status(400).json({ message: "Invalid month" });
      where.month = month;
    }

    if (status) {
      where.status = String(status);
    }

    if (canManageRequests(actor.role)) {
      if (employeeId) where.employeeId = Number(employeeId);
    } else {
      if (!actor.employeeId) {
        return res.status(403).json({ message: "No employeeId bound to this user" });
      }
      where.employeeId = Number(actor.employeeId);
    }

    const rows = await AttendanceRequest.findAll({
      where,
      include: canManageRequests(actor.role)
        ? [{ model: Employee, as: "employee", attributes: ["id", "fullName", "nationalId"] }]
        : [],
      order: [["date", "DESC"], ["id", "DESC"]],
      limit: 2000,
    });

    return res.json(rows);
  } catch (e) {
    console.error("listRequests error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// PATCH /api/attendance/requests/:id/decision
// body: { status: 'approved'|'rejected', decisionNote? }
// HR/Admin only
exports.decideRequest = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const actor = getActor(req);
    if (!canManageRequests(actor.role)) {
      await t.rollback();
      return res.status(403).json({ message: "HR/Admin only" });
    }

    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid id" });
    }

    const body = req.body || {};
    const nextStatus = String(body.status || "").toLowerCase();
    if (!["approved", "rejected"].includes(nextStatus)) {
      await t.rollback();
      return res.status(400).json({ message: "status must be approved | rejected" });
    }

    const row = await AttendanceRequest.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!row) {
      await t.rollback();
      return res.status(404).json({ message: "Request not found" });
    }

    if (row.status !== "pending") {
      await t.rollback();
      return res.status(409).json({ message: "Only pending requests can be decided" });
    }

    row.status = nextStatus;
    row.decidedBy = actor.userId;
    row.decidedAt = new Date();
    row.decisionNote = body.decisionNote || null;

    await row.save({ transaction: t });
    await t.commit();

    // ✅ recompute if approved and import exists
    let recomputed = false;
    let importId = null;

    if (nextStatus === "approved") {
      const imp = await getLatestDoneImport(row.month);
      if (imp) {
        await computeMonthForImport(imp.id);
        recomputed = true;
        importId = imp.id;
      }
    }

    return res.json({
      ok: true,
      id: row.id,
      month: row.month,
      status: row.status,
      recomputed,
      importId,
    });
  } catch (e) {
    await t.rollback();
    console.error("decideRequest error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// DELETE /api/attendance/requests/:id
// Employee cancels his pending request
exports.cancelRequest = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const actor = getActor(req);
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

    // employee: لازم يبقى نفس employeeId + pending
    if (!canManageRequests(actor.role)) {
      if (!actor.employeeId || Number(actor.employeeId) !== Number(row.employeeId)) {
        await t.rollback();
        return res.status(403).json({ message: "Not allowed" });
      }
      if (row.status !== "pending") {
        await t.rollback();
        return res.status(409).json({ message: "Only pending requests can be cancelled" });
      }
    }

    row.status = "cancelled";
    await row.save({ transaction: t });
    await t.commit();

    return res.json({ ok: true, cancelled: true, id: row.id });
  } catch (e) {
    await t.rollback();
    console.error("cancelRequest error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ================= Employee month details =================

// GET /api/attendance/employee/:employeeId?month=YYYY-MM&includeSalary=true|false
exports.getEmployeeMonthDetails = async (req, res) => {
  try {
    const employeeId = Number(req.params.employeeId);
    if (!employeeId || Number.isNaN(employeeId)) {
      return res.status(400).json({ message: "Invalid employeeId" });
    }

    const { month, includeSalary } = req.query;
    if (!isValidMonth(month)) {
      return res.status(400).json({ message: "month is required: YYYY-MM-DD" });
    }

    const employee = await Employee.findByPk(employeeId, {
      attributes: ["id", "fullName", "nationalId", "authUserId"],
    });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // ✅ Employment & Leaves
    const { EmployeeEmployment, EmployeeLoan, LoanInstallment, UserKpiEvaluation, UserKpiConfig, KpiElement } = require("../models");
    const employment = await EmployeeEmployment.findByPk(employeeId);

    // ✅ Loans
    const loans = await EmployeeLoan.findAll({
      where: { employeeId },
      include: [{ model: LoanInstallment, as: "installments" }],
      order: [["id", "DESC"]]
    });

    // 🆕 Fetch installments specifically for this month
    const monthInstallments = await LoanInstallment.findAll({
      where: {
        employeeId,
        month: month.slice(0, 7), // Ensure YYYY-MM
      },
      include: [{ model: EmployeeLoan, as: "loan" }]
    });

    // ✅ KPI Details
    const [year, mNum] = month.split("-").map(Number);
    const kpiEvaluations = await UserKpiEvaluation.findAll({
      include: [
        {
          model: UserKpiConfig,
          as: "config",
          where: { authUserId: employee.authUserId || 0 }, // Filter by authUserId if possible
          include: [{ model: KpiElement, as: "kpiElement" }]
        }
      ],
      where: { month: mNum, year }
    });

    const imp = await getLatestDoneImport(month);
    if (!imp) {
      return res.json({
        employee,
        month,
        employment,
        kpiEvaluations,
        workingDaysCount: 0,
        payroll: null,
        totals: null,
        items: [],
        requests: [],
        includeSalary: false,
      });
    }

    const wantSalary = includeSalary === "true";
    if (wantSalary && !canViewSalary(req.user?.role)) {
      return res.status(403).json({ message: "Finance/Admin only to view salary deductions" });
    }

    const summaryAttrs = wantSalary
      ? undefined
      : { exclude: ["salary_gross_used", "day_rate", "deduction_amount"] };

    const summary = await AttendanceMonthlySummary.findOne({
      where: { importId: imp.id, employeeId },
      attributes: summaryAttrs,
    });

    // ✅ Fetch Incoming Carry-Over (Anything postponed TO this month)
    let incomingAmount = 0;
    let incomingReason = '';
    let incomingType = 'attendance';
    let fromMonthStr = '';
    
    try {
      // 1. Search for a summary that explicitly points to this month
      const sourceSummary = await AttendanceMonthlySummary.findOne({
        where: { employeeId, postponedToMonth: month }
      });
      
      if (sourceSummary) {
        incomingAmount = Number(sourceSummary.postponedAmount || 0);
        incomingReason = sourceSummary.postponedReason || `Carried over from ${sourceSummary.month}`;
        incomingType = sourceSummary.postponedType || 'attendance';
        fromMonthStr = sourceSummary.month;
      } else {
        // 2. Fallback: check immediate previous month (traditional carry-over)
        const d = new Date(month + '-01');
        d.setMonth(d.getMonth() - 1);
        const prevMonthStr = d.toISOString().slice(0, 7);
        
        const prevSummary = await AttendanceMonthlySummary.findOne({
          where: { employeeId, month: prevMonthStr }
        });
        
        if (prevSummary && Number(prevSummary.postponedAmount || 0) > 0) {
          // If the previous month didn't specify a 'postponedToMonth' or it's this month
          if (!prevSummary.postponedToMonth || prevSummary.postponedToMonth === month) {
            incomingAmount = Number(prevSummary.postponedAmount || 0);
            incomingReason = prevSummary.postponedReason || `Carried over from ${prevMonthStr}`;
            incomingType = prevSummary.postponedType || 'attendance';
            fromMonthStr = prevMonthStr;
          }
        }
      }
    } catch (err) {
      console.warn('Error fetching carry-over:', err);
    }

    // Attach to summary object
    if (summary) {
      if (Number(summary.incomingPostponedAmount || 0) === 0 && incomingAmount > 0) {
        summary.setDataValue('incomingPostponedAmount', incomingAmount);
        summary.setDataValue('incomingPostponedReason', incomingReason);
        summary.setDataValue('incomingPostponedType', incomingType);
        summary.setDataValue('incomingPostponedFromMonth', fromMonthStr);
      }
      summary.setDataValue('fromMonth', fromMonthStr); 
    }

    const days = await AttendanceDay.findAll({
      where: { importId: imp.id, employeeId },
      order: [["date", "ASC"]],
    });

    // ✅ requests (pending/approved/rejected/cancelled)
    const requests = await AttendanceRequest.findAll({
      where: { employeeId, month },
      order: [["date", "ASC"], ["id", "ASC"]],
    });

    // ===== Salary base (only if wantSalary) =====
    const grossSalary = wantSalary
      ? Number(summary?.salaryGrossUsed ?? summary?.salary_gross_used ?? 0)
      : null;
    const dailyRate = wantSalary ? Number(summary?.dayRate ?? summary?.day_rate ?? 0) : null;
    const totalDeductionAmount = wantSalary
      ? Number(summary?.deductionAmount ?? summary?.deduction_amount ?? 0)
      : null;

    // ✅ Re-calculate KPI Bonus to ensure it matches KPI Management module
    let latestKpiResult = null;
    if (wantSalary && summary && employee.authUserId) {
      try {
        const kpiService = require("../services/kpi.service");
        const [yearNum, monthNum] = month.split("-").map(Number);
        latestKpiResult = await kpiService.calculateMonthlyKpi(employee.authUserId, monthNum, yearNum);
        
        if (latestKpiResult) {
          const newBonus = Number(latestKpiResult.totalEarned || 0);
          // If draft, update the DB too to keep it persistent
          if (summary.status === 'draft' && Number(summary.totalKpiBonus) !== newBonus) {
            summary.totalKpiBonus = newBonus;
            // Also re-calc net salary for the DB
            const base = Number(summary.salaryGrossUsed || 0);
            const inc = Number(summary.salaryIncreaseAmount || 0);
            const manual = Number(summary.manualAdjustmentAmount || 0);
            const outgoingPost = Number(summary.postponedAmount || 0);
            const ded = Number(summary.deductionAmount || 0);
            const loans = Number(summary.loanInstallmentAmount || 0);
            const incomingPost = Number(summary.incomingPostponedAmount || 0);
            
            summary.finalNetSalary = Math.max(0, base + newBonus + inc + manual + outgoingPost - ded - loans - incomingPost);
            await summary.save();
          } else {
            summary.setDataValue('totalKpiBonus', newBonus);
          }
        }
      } catch (err) {
        console.warn('Error syncing KPI bonus:', err);
      }
    }

    const netSalary = wantSalary && summary ? Number(summary.finalNetSalary || 0) : null;
        
    // Wait, the netSalary calculation is complex. I should use the one from attendance-overrides.controller.js logic
    // or just let the overrides controller handle the save, but for VIEWING, I need to be accurate.

    // ===== Auto items (only penalty items) =====
    const autoItems = (days || [])
      .map((d) => {
        const dateISO = String(d.date).slice(0, 10);
        const absent = !!(d.absent ?? d.get?.("absent"));

        const latePenaltyDays = Number(d.latePenaltyDays ?? d.late_penalty_days ?? 0);
        const absentPenaltyDays = Number(d.absentPenaltyDays ?? d.absent_penalty_days ?? 0);

        const deductionDays = absent ? absentPenaltyDays || 1 : latePenaltyDays || 0;

        const lateMinutes = Number(
          d.lateMinutes ??
            d.late_minutes ??
            d.effectiveLateMinutes ??
            d.effective_late_minutes ??
            0
        );

        const amount =
          wantSalary && dailyRate ? Number(dailyRate) * Number(deductionDays) : null;

        return {
          id: d.id, // positive
          date: dateISO,
          type: absent ? "absent" : "late",
          lateMinutes: absent ? null : lateMinutes,
          deductionDays,
          amount,
          isException: !!(d.isException ?? d.is_exception ?? false),
          note: d.policyReason ?? d.policy_reason ?? null,
          source: "auto",
          // ✅ Add clock info for UI
          clockIn: d.clockIn,
          clockOut: d.clockOut,
          // 🆕 Grace Period info
          graceApplied: !!(d.graceApplied ?? d.grace_applied ?? false),
        };
      });

    // ===== Manual items =====
    const manualRows = await AttendanceManualItem.findAll({
      where: { employeeId, month },
      order: [["date", "ASC"], ["id", "ASC"]],
    });

    const manualItems = (manualRows || []).map((m) => {
      const dir = String(m.direction || "deduct").toLowerCase();
      const sign = dir === "add" ? -1 : 1;

      const deductionDays =
        m.days !== null && typeof m.days !== "undefined" ? sign * Number(m.days) : 0;

      const amount =
        wantSalary
          ? (() => {
              const baseAmount =
                m.amount !== null && typeof m.amount !== "undefined"
                  ? Number(m.amount)
                  : dailyRate && m.days
                  ? Number(dailyRate) * Number(m.days)
                  : 0;
              return sign * Number(baseAmount || 0);
            })()
          : null;

      return {
        id: -Number(m.id), // manual IDs negative
        date: String(m.date).slice(0, 10),
        type: "manual",
        lateMinutes: null,
        deductionDays: Number.isFinite(deductionDays) ? deductionDays : 0,
        amount,
        isException: !!(m.isException ?? m.is_exception ?? false),
        note: m.note || null,
        source: "manual",
      };
    });

    // ✅ Generate ALL days for the month for the Activity Timeline
    const { start, end } = getMonthBounds(month);
    const startDate = new Date(start);
    const endDate = new Date(end);
    const allDates = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      allDates.push(new Date(d).toISOString().slice(0, 10));
    }

    const holidays = await PublicHoliday.findAll({
      where: { date: { [Op.startsWith]: month } }
    });

    const itemsMap = new Map();
    [...autoItems, ...manualItems].forEach(it => {
      if (!itemsMap.has(it.date)) itemsMap.set(it.date, []);
      itemsMap.get(it.date).push(it);
    });

    const finalItems = allDates.flatMap(date => {
      if (itemsMap.has(date)) return itemsMap.get(date);
      
      const holiday = holidays.find(h => h.date === date);
      const req = requests.find(r => r.date === date && r.status === 'approved');
      
      const dayOfWeek = new Date(date).getDay(); // 5 = Friday, 6 = Saturday (depending on locale, but standard JS 0=Sun)
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Adjust if necessary for Egypt (Fri/Sat)

      return [{
        id: 0,
        date,
        type: holiday ? 'holiday' : (req ? 'vacation' : (isWeekend ? 'weekend' : 'normal')),
        lateMinutes: null,
        deductionDays: 0,
        amount: 0,
        isException: false,
        note: holiday ? holiday.name : (req ? (req.leaveType || 'Approved Leave') : null),
        source: 'system',
        clockIn: null,
        clockOut: null,
        graceApplied: false
      }];
    });

    return res.json({
      employee,
      month,
      employment,
      loans,
      monthInstallments,
      kpiEvaluations,
      workingDaysCount: imp.workingDaysCount || 0,
      summary,
      payroll: wantSalary ? { grossSalary, dailyRate } : null,
      totals: wantSalary ? { 
        totalDeductionAmount, 
        netSalary: Number(summary?.finalNetSalary || 0),
        kpiBaseAmount: latestKpiResult?.baseKpiAmount || 0,
        kpiRate: latestKpiResult?.baseKpiAmount ? Math.round((Number(summary?.totalKpiBonus || 0) / latestKpiResult.baseKpiAmount) * 100) : 0,
        kpiBonus: Number(summary?.totalKpiBonus || 0)
      } : null,
      items: finalItems,
      requests,
      includeSalary: wantSalary,
    });
  } catch (e) {
    console.error("getEmployeeMonthDetails error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// PATCH /api/attendance/employee/:employeeId/items/:itemId
exports.toggleEmployeeItemException = async (req, res) => {
  try {
    const employeeId = Number(req.params.employeeId);
    const itemId = Number(req.params.itemId);

    if (!employeeId || Number.isNaN(employeeId)) {
      return res.status(400).json({ message: "Invalid employeeId" });
    }
    if (!itemId || Number.isNaN(itemId)) {
      return res.status(400).json({ message: "Invalid itemId" });
    }

    const body = req.body || {};

    // ===== MANUAL (negative id) =====
    if (itemId < 0) {
      const manualId = Math.abs(itemId);

      const row = await AttendanceManualItem.findOne({
        where: { id: manualId, employeeId },
      });

      if (!row) {
        return res.status(404).json({ message: "Manual item not found for this employee" });
      }

      const next =
        typeof body.isException === "boolean" ? body.isException : !Boolean(row.isException);

      row.isException = next;
      await row.save();

      const imp = await getLatestDoneImport(row.month);
      if (imp) await computeMonthForImport(imp.id);

      return res.json({
        ok: true,
        employeeId,
        itemId,
        month: row.month,
        isException: row.isException,
        recomputed: !!imp,
        type: "manual",
      });
    }

    // ===== AUTO (AttendanceDay) =====
    const day = await AttendanceDay.findOne({
      where: { id: itemId, employeeId },
    });

    if (!day) {
      return res.status(404).json({ message: "Item not found for this employee" });
    }

    const latest = await getLatestDoneImport(day.month);
    if (latest && Number(latest.id) !== Number(day.importId)) {
      return res.status(409).json({
        message: "This item belongs to an older import. Please open the latest import month data.",
      });
    }

    const next =
      typeof body.isException === "boolean" ? body.isException : !Boolean(day.isException);

    day.isException = next;
    await day.save();

    await computeMonthForImport(day.importId);

    return res.json({
      ok: true,
      employeeId,
      itemId,
      month: day.month,
      importId: day.importId,
      isException: day.isException,
      recomputed: true,
      type: "auto",
    });
  } catch (e) {
    console.error("toggleEmployeeItemException error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// POST /api/attendance/employee/:employeeId/manual
exports.addEmployeeManualItem = async (req, res) => {
  try {
    const employeeId = Number(req.params.employeeId);
    if (!employeeId || Number.isNaN(employeeId)) {
      return res.status(400).json({ message: "Invalid employeeId" });
    }

    const { date, direction, amount, days, deductionDays, note } = req.body || {};

    if (!isValidDate(date)) {
      return res.status(400).json({ message: "date is required: YYYY-MM-DD" });
    }

    const month = String(date).slice(0, 7);
    if (!isValidMonth(month)) {
      return res.status(400).json({ message: "Invalid month derived from date" });
    }

    const dir = direction === "add" || direction === "restore" ? "add" : "deduct";

    const daysValue = typeof days !== "undefined" ? days : deductionDays;

    const amountNum =
      typeof amount === "undefined" || amount === null || amount === ""
        ? null
        : Number(amount);

    const daysNum =
      typeof daysValue === "undefined" || daysValue === null || daysValue === ""
        ? null
        : Number(daysValue);

    const hasAmount = Number.isFinite(amountNum) && amountNum > 0;
    const hasDays = Number.isFinite(daysNum) && daysNum > 0;

    if (!hasAmount && !hasDays) {
      return res.status(400).json({ message: "Either amount or days is required (positive number)." });
    }
    if (hasAmount && hasDays) {
      return res.status(400).json({ message: "Provide either amount OR days, not both." });
    }

    const emp = await Employee.findByPk(employeeId, { attributes: ["id"] });
    if (!emp) return res.status(404).json({ message: "Employee not found" });

    const imp = await getLatestDoneImport(month);
    if (!imp) {
      return res.status(404).json({ message: "No done import found for this month. Import sheet first." });
    }

    const row = await AttendanceManualItem.create({
      employeeId,
      month,
      date,
      direction: dir,
      amount: hasAmount ? amountNum : null,
      days: hasDays ? daysNum : null,
      note: note || null,
      isException: false,
      createdBy: req.user?.id || null,
    });

    await computeMonthForImport(imp.id);

    return res.status(201).json({
      ok: true,
      item: row,
      recomputed: true,
      month,
      importId: imp.id,
    });
  } catch (e) {
    console.error("addEmployeeManualItem error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// DELETE /api/attendance/employee/:employeeId/manual/:manualId
exports.deleteEmployeeManualItem = async (req, res) => {
  try {
    const employeeId = Number(req.params.employeeId);
    const manualId = Number(req.params.manualId);

    if (!employeeId || Number.isNaN(employeeId)) {
      return res.status(400).json({ message: "Invalid employeeId" });
    }
    if (!manualId || Number.isNaN(manualId)) {
      return res.status(400).json({ message: "Invalid manualId" });
    }

    const row = await AttendanceManualItem.findOne({
      where: { id: manualId, employeeId },
    });

    if (!row) return res.status(404).json({ message: "Manual item not found" });

    const month = row.month;
    await row.destroy();

    const imp = await getLatestDoneImport(month);
    if (imp) await computeMonthForImport(imp.id);

    return res.json({ ok: true, deleted: true, month, importId: imp?.id || null });
  } catch (e) {
    console.error("deleteEmployeeManualItem error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};
