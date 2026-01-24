const multer = require("multer");
const { Op } = require("sequelize");
const {
  AttendanceImport,
  AttendanceDay,
  AttendanceMonthlySummary,
  Employee,
  EmployeeAttendanceProfile,
  AttendanceExcuse,
  sequelize,
  AttendanceUnmatchedRow,
  AttendanceManualItem,
} = require('../models');

const {
  importAttendanceFromBuffer,
} = require("../services/attendance/importAttendance.service");
const {
  computeMonthForImport,
} = require("../services/attendance/computeAttendance.service");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

exports.uploadMiddleware = upload.single("file");

function isValidMonth(month) {
  return !!month && /^\d{4}-\d{2}$/.test(month);
}

async function getLatestDoneImport(month) {
  return AttendanceImport.findOne({
    where: { month, status: "done" },
    order: [["id", "DESC"]],
  });
}

// POST /api/attendance/import
exports.importSheet = async (req, res) => {
  try {
    if (!req.file?.buffer)
      return res
        .status(400)
        .json({ message: "file is required (form-data: file)" });

    const result = await importAttendanceFromBuffer({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      uploadedBy: req.user?.id,
    });

    if (!result.ok)
      return res
        .status(400)
        .json({ message: result.message || "Import failed" });

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
    if (wantSalary) {
      const role = req.user?.role;
      if (!(role === "admin" || role === "finance")) {
        return res
          .status(403)
          .json({ message: "Finance/Admin only to view salary deductions" });
      }
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

// ✅ NEW: GET /api/attendance/unmatched?month=YYYY-MM
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

    // 1) لو عندك جدول unmatched rows فعلاً (أفضل)
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

    // 2) Fallback: unmatchedSampleJson لو موجودة
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
      note: "unmatched rows are returned from unmatchedSample fallback. If you want full unmatched list, we should persist unmatched rows in DB during import.",
    });
  } catch (e) {
    console.error("getUnmatchedRows error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ✅ NEW: POST /api/attendance/mapping  body: { employeeId, empNo, acNo, notes? }
exports.upsertMappingFromBody = async (req, res) => {
  try {
    const { employeeId } = req.body || {};
    if (!employeeId)
      return res.status(400).json({ message: "employeeId is required" });

    // reuse existing handler by adapting req.params + body shape
    req.params.employeeId = String(employeeId);

    // allow both naming styles
    const { attendanceEmpNo, attendanceAcNo, empNo, acNo, notes } =
      req.body || {};
    req.body = {
      attendanceEmpNo:
        typeof attendanceEmpNo !== "undefined" ? attendanceEmpNo : empNo,
      attendanceAcNo:
        typeof attendanceAcNo !== "undefined" ? attendanceAcNo : acNo,
      notes,
    };

    return exports.upsertMapping(req, res);
  } catch (e) {
    console.error("upsertMappingFromBody error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// PUT /api/attendance/mapping/:employeeId  body: { attendanceEmpNo, attendanceAcNo, notes }
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

    // accept both styles from frontend
    const body = req.body || {};
    const attendanceEmpNo =
      typeof body.attendanceEmpNo !== "undefined"
        ? body.attendanceEmpNo
        : body.empNo;
    const attendanceAcNo =
      typeof body.attendanceAcNo !== "undefined"
        ? body.attendanceAcNo
        : body.acNo;
    const notes = body.notes;

    // uniqueness check (avoid conflicts)
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
        return res
          .status(400)
          .json({
            message: "attendanceEmpNo already linked to another employee",
          });
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
        return res
          .status(400)
          .json({
            message: "attendanceAcNo already linked to another employee",
          });
      }
    }

    let profile = await EmployeeAttendanceProfile.findByPk(employeeId, {
      transaction: t,
    });
    if (!profile)
      profile = await EmployeeAttendanceProfile.create(
        { employeeId },
        { transaction: t }
      );

    if (typeof attendanceEmpNo !== "undefined")
      profile.attendanceEmpNo = attendanceEmpNo
        ? String(attendanceEmpNo).trim()
        : null;

    if (typeof attendanceAcNo !== "undefined")
      profile.attendanceAcNo = attendanceAcNo
        ? String(attendanceAcNo).trim()
        : null;

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

// ✅ NEW: POST /api/attendance/recompute?month=YYYY-MM
exports.recomputeMonth = async (req, res) => {
  try {
    const { month } = req.query;
    if (!isValidMonth(month))
      return res.status(400).json({ message: "month is required: YYYY-MM" });

    const imp = await getLatestDoneImport(month);
    if (!imp)
      return res
        .status(404)
        .json({ message: "No done import found for this month" });

    await computeMonthForImport(imp.id);

    return res.json({ ok: true, month, importId: imp.id });
  } catch (e) {
    console.error("recomputeMonth error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ================= Excuses =================

// POST /api/attendance/excuses  body: { employeeId, date(YYYY-MM-DD), minutes, note }
exports.createExcuse = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { employeeId, date, minutes, note } = req.body || {};
    const eid = Number(employeeId);
    const min = Number(minutes);

    if (!eid || Number.isNaN(eid)) {
      await t.rollback();
      return res.status(400).json({ message: "employeeId is required" });
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      await t.rollback();
      return res.status(400).json({ message: "date is required: YYYY-MM-DD" });
    }
    if (!Number.isFinite(min) || min <= 0 || min > 120) {
      await t.rollback();
      return res.status(400).json({ message: "minutes must be 1..120" });
    }

    const month = date.slice(0, 7);

    // enforce: max 2 excuses per month, total 240 minutes
    const existing = await AttendanceExcuse.findAll({
      where: {
        employeeId: eid,
        date: { [Op.gte]: `${month}-01`, [Op.lte]: `${month}-31` },
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    const count = existing.length;
    const total = existing.reduce((a, r) => a + Number(r.minutes || 0), 0);

    if (count >= 2) {
      await t.rollback();
      return res
        .status(400)
        .json({ message: "Monthly excuses limit reached (max 2)" });
    }
    if (total + min > 240) {
      await t.rollback();
      return res
        .status(400)
        .json({ message: "Monthly excuses minutes limit exceeded (max 240)" });
    }

    const row = await AttendanceExcuse.create(
      {
        employeeId: eid,
        date,
        minutes: min,
        note: note || null,
        createdBy: req.user?.id || null,
      },
      { transaction: t }
    );

    const imp = await getLatestDoneImport(month);
    await t.commit();

    if (imp) await computeMonthForImport(imp.id);

    return res.status(201).json(row);
  } catch (e) {
    await t.rollback();
    console.error("createExcuse error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// PUT /api/attendance/excuses/:id
exports.updateExcuse = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid id" });
    }

    const row = await AttendanceExcuse.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!row) {
      await t.rollback();
      return res.status(404).json({ message: "Excuse not found" });
    }

    const { minutes, note, date } = req.body || {};

    if (typeof date !== "undefined") {
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        await t.rollback();
        return res.status(400).json({ message: "date must be YYYY-MM-DD" });
      }
      row.date = date;
    }

    if (typeof minutes !== "undefined") {
      const min = Number(minutes);
      if (!Number.isFinite(min) || min <= 0 || min > 120) {
        await t.rollback();
        return res.status(400).json({ message: "minutes must be 1..120" });
      }
      row.minutes = min;
    }

    if (typeof note !== "undefined") row.note = note || null;

    const month = String(row.date).slice(0, 7);
    const siblings = await AttendanceExcuse.findAll({
      where: {
        employeeId: row.employeeId,
        date: { [Op.gte]: `${month}-01`, [Op.lte]: `${month}-31` },
        id: { [Op.ne]: row.id },
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    const count = siblings.length + 1;
    const total =
      siblings.reduce((a, r) => a + Number(r.minutes || 0), 0) +
      Number(row.minutes || 0);

    if (count > 2) {
      await t.rollback();
      return res
        .status(400)
        .json({ message: "Monthly excuses limit reached (max 2)" });
    }
    if (total > 240) {
      await t.rollback();
      return res
        .status(400)
        .json({ message: "Monthly excuses minutes limit exceeded (max 240)" });
    }

    await row.save({ transaction: t });

    const imp = await getLatestDoneImport(month);
    await t.commit();

    if (imp) await computeMonthForImport(imp.id);

    return res.json(row);
  } catch (e) {
    await t.rollback();
    console.error("updateExcuse error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// GET /api/attendance/excuses?month=YYYY-MM&employeeId=
exports.listExcuses = async (req, res) => {
  try {
    const { month, employeeId } = req.query;
    const where = {};

    if (employeeId) where.employeeId = Number(employeeId);
    if (month)
      where.date = { [Op.gte]: `${month}-01`, [Op.lte]: `${month}-31` };

    const rows = await AttendanceExcuse.findAll({
      where,
      order: [["date", "ASC"]],
    });

    return res.json(rows);
  } catch (e) {
    console.error("listExcuses error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};


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
        payroll: { grossSalary: 0, dailyRate: 0 },
        totals: { totalDeductionAmount: 0, netSalary: 0 },
        items: [],
        includeSalary: false,
      });
    }

    const wantSalary = includeSalary === "true";
    if (wantSalary) {
      const role = req.user?.role;
      if (!(role === "admin" || role === "finance")) {
        return res
          .status(403)
          .json({ message: "Finance/Admin only to view salary deductions" });
      }
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

    // ===== Salary base (from summary - after compute includes manual) =====
    const grossSalary = Number(
      summary?.salaryGrossUsed ?? summary?.salary_gross_used ?? 0
    );
    const dailyRate = Number(summary?.dayRate ?? summary?.day_rate ?? 0);
    const totalDeductionAmount = Number(
      summary?.deductionAmount ?? summary?.deduction_amount ?? 0
    );

    const netSalary =
      grossSalary > 0 ? Math.max(grossSalary - totalDeductionAmount, 0) : 0;

    // ===== Auto items (AttendanceDay) =====
    const autoItems = (days || [])
      .map((d) => {
        const dateISO = String(d.date).slice(0, 10);
        const absent = !!(d.absent ?? d.get?.("absent"));

        const latePenaltyDays = Number(
          d.latePenaltyDays ?? d.late_penalty_days ?? 0
        );
        const absentPenaltyDays = Number(
          d.absentPenaltyDays ?? d.absent_penalty_days ?? 0
        );

        const deductionDays = absent
          ? absentPenaltyDays || 1
          : latePenaltyDays || 0;

        if (!deductionDays || deductionDays <= 0) return null;

        const lateMinutes = Number(
          d.lateMinutes ??
            d.late_minutes ??
            d.effectiveLateMinutes ??
            d.effective_late_minutes ??
            0
        );

        const amount = dailyRate > 0 ? dailyRate * deductionDays : 0;

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
      const baseAmount =
        m.amount !== null && typeof m.amount !== "undefined"
          ? Number(m.amount)
          : dailyRate > 0 && m.days
          ? Number(dailyRate) * Number(m.days)
          : 0;

      const dir = String(m.direction || "deduct").toLowerCase();
      const sign = dir === "add" ? -1 : 1;

      const amount = sign * Number(baseAmount || 0);
      const dDays =
        m.days !== null && typeof m.days !== "undefined"
          ? sign * Number(m.days)
          : 0;

      return {
        id: -Number(m.id), // ✅ manual IDs are NEGATIVE
        date: String(m.date).slice(0, 10),
        type: "manual",
        lateMinutes: null,
        deductionDays: Number.isFinite(dDays) ? dDays : 0,
        amount: Number.isFinite(amount) ? amount : 0,
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
      payroll: { grossSalary, dailyRate },
      totals: { totalDeductionAmount, netSalary },
      items: allItems,
      includeSalary: wantSalary,
    });
  } catch (e) {
    console.error("getEmployeeMonthDetails error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};


// PATCH /api/attendance/employee/:employeeId/items/:itemId
// body: { isException?: boolean }  (if omitted -> toggle)
// NOTE: itemId > 0 => AttendanceDay, itemId < 0 => AttendanceManualItem
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
        return res
          .status(404)
          .json({ message: "Manual item not found for this employee" });
      }

      const next =
        typeof body.isException === "boolean"
          ? body.isException
          : !Boolean(row.isException);

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
      return res
        .status(404)
        .json({ message: "Item not found for this employee" });
    }

    const latest = await getLatestDoneImport(day.month);
    if (latest && Number(latest.id) !== Number(day.importId)) {
      return res.status(409).json({
        message:
          "This item belongs to an older import. Please open the latest import month data.",
      });
    }

    const next =
      typeof body.isException === "boolean"
        ? body.isException
        : !Boolean(day.isException);

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


function isValidDate(date) {
  return !!date && /^\d{4}-\d{2}-\d{2}$/.test(date);
}

// POST /api/attendance/employee/:employeeId/manual
// body: { date, direction: 'deduct'|'add'|'restore', amount?: number, days?: number, deductionDays?: number, note?: string }
exports.addEmployeeManualItem = async (req, res) => {
  try {
    const employeeId = Number(req.params.employeeId);
    if (!employeeId || Number.isNaN(employeeId)) {
      return res.status(400).json({ message: 'Invalid employeeId' });
    }

    const { date, direction, amount, days, deductionDays, note } = req.body || {};

    if (!isValidDate(date)) {
      return res.status(400).json({ message: 'date is required: YYYY-MM-DD' });
    }

    const month = String(date).slice(0, 7);
    if (!isValidMonth(month)) {
      return res.status(400).json({ message: 'Invalid month derived from date' });
    }

    // ✅ normalize direction
    const dir = (direction === 'add' || direction === 'restore') ? 'add' : 'deduct';

    // ✅ accept both days & deductionDays
    const daysValue = typeof days !== 'undefined' ? days : deductionDays;

    const amountNum =
      typeof amount === 'undefined' || amount === null || amount === ''
        ? null
        : Number(amount);

    const daysNum =
      typeof daysValue === 'undefined' || daysValue === null || daysValue === ''
        ? null
        : Number(daysValue);

    const hasAmount = Number.isFinite(amountNum) && amountNum > 0;
    const hasDays = Number.isFinite(daysNum) && daysNum > 0;

    if (!hasAmount && !hasDays) {
      return res.status(400).json({ message: 'Either amount or days is required (positive number).' });
    }
    if (hasAmount && hasDays) {
      return res.status(400).json({ message: 'Provide either amount OR days, not both.' });
    }

    const emp = await Employee.findByPk(employeeId, { attributes: ['id'] });
    if (!emp) return res.status(404).json({ message: 'Employee not found' });

    const imp = await getLatestDoneImport(month);
    if (!imp) {
      return res.status(404).json({ message: 'No done import found for this month. Import sheet first.' });
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
    console.error('addEmployeeManualItem error:', e);
    return res.status(500).json({ message: 'Internal server error' });
  }
};


// DELETE /api/attendance/employee/:employeeId/manual/:manualId
exports.deleteEmployeeManualItem = async (req, res) => {
  try {
    const employeeId = Number(req.params.employeeId);
    const manualId = Number(req.params.manualId);

    if (!employeeId || Number.isNaN(employeeId)) {
      return res.status(400).json({ message: 'Invalid employeeId' });
    }
    if (!manualId || Number.isNaN(manualId)) {
      return res.status(400).json({ message: 'Invalid manualId' });
    }

    const row = await AttendanceManualItem.findOne({
      where: { id: manualId, employeeId },
    });

    if (!row) return res.status(404).json({ message: 'Manual item not found' });

    const month = row.month;
    await row.destroy();

    const imp = await getLatestDoneImport(month);
    if (imp) await computeMonthForImport(imp.id);

    return res.json({ ok: true, deleted: true, month, importId: imp?.id || null });
  } catch (e) {
    console.error('deleteEmployeeManualItem error:', e);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
