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
  sequelize,
} = require("../models");

const { importAttendanceFromBuffer } = require("../services/attendance/importAttendance.service");
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

    return res.json({
      month,
      importId: imp.id,
      workingDaysCount: imp.workingDaysCount,
      data: rows,
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
      return res.status(400).json({ message: "month is required: YYYY-MM" });
    }

    const employee = await Employee.findByPk(employeeId, {
      attributes: ["id", "fullName", "nationalId"],
    });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const imp = await getLatestDoneImport(month);
    if (!imp) {
      return res.json({
        employee,
        month,
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

    const netSalary =
      wantSalary && grossSalary > 0
        ? Math.max(grossSalary - (totalDeductionAmount || 0), 0)
        : null;

    // ===== Auto items (only penalty items) =====
    const autoItems = (days || [])
      .map((d) => {
        const dateISO = String(d.date).slice(0, 10);
        const absent = !!(d.absent ?? d.get?.("absent"));

        const latePenaltyDays = Number(d.latePenaltyDays ?? d.late_penalty_days ?? 0);
        const absentPenaltyDays = Number(d.absentPenaltyDays ?? d.absent_penalty_days ?? 0);

        const deductionDays = absent ? absentPenaltyDays || 1 : latePenaltyDays || 0;
        if (!deductionDays || deductionDays <= 0) return null;

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
        };
      })
      .filter(Boolean);

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

    const allItems = [...autoItems, ...manualItems].sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    );

    return res.json({
      employee,
      month,
      workingDaysCount: imp.workingDaysCount || 0,
      payroll: wantSalary ? { grossSalary, dailyRate } : null,
      totals: wantSalary ? { totalDeductionAmount, netSalary } : null,
      items: allItems,
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
