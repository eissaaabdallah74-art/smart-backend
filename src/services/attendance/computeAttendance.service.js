// src/services/attendance/computeAttendance.service.js
const { Op } = require("sequelize");
const {
  AttendanceImport,
  AttendanceDay,
  AttendanceExcuse,
  AttendanceMonthlySummary,
  EmployeePayrollInsurance,
  AttendanceManualItem,
  AttendanceRequest,
  PublicHoliday,
  sequelize,
} = require("../../models");

const GRACE_MAX_COUNT = 4;
const GRACE_MAX_MINUTES = 15;

// Policy
function calcLatePenaltyDays(effectiveLateMinutes, graceAvailable) {
  if (!effectiveLateMinutes || effectiveLateMinutes <= 0) {
    return { penalty: 0, graceApplied: false, reason: "no_late" };
  }

  if (effectiveLateMinutes <= GRACE_MAX_MINUTES && graceAvailable) {
    return { penalty: 0, graceApplied: true, reason: "grace_used" };
  }

  if (effectiveLateMinutes <= 15)
    return { penalty: 0.25, graceApplied: false, reason: "late_0_15" };
  if (effectiveLateMinutes <= 30)
    return { penalty: 0.5, graceApplied: false, reason: "late_16_30" };

  if (effectiveLateMinutes < 45)
    return { penalty: 0.5, graceApplied: false, reason: "late_31_44" };
  return { penalty: 1.0, graceApplied: false, reason: "late_45_plus" };
}

function getMonthBounds(month) {
  const [y, m] = String(month).split("-").map((x) => Number(x));
  const lastDay = new Date(y, m, 0).getDate();
  return {
    start: `${month}-01`,
    end: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

async function computeMonthForImport(importId) {
  const t = await sequelize.transaction();
  try {
    const imp = await AttendanceImport.findByPk(importId, { transaction: t });
    if (!imp) {
      await t.rollback();
      throw new Error("AttendanceImport not found");
    }

    const month = imp.month;
    const workingDays = imp.workingDaysCount || 0;
    const { start, end } = getMonthBounds(month);

    const days = await AttendanceDay.findAll({
      where: { importId },
      order: [
        ["employeeId", "ASC"],
        ["date", "ASC"],
      ],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    // legacy excuses
    const excuses = await AttendanceExcuse.findAll({
      where: { date: { [Op.between]: [start, end] } },
      transaction: t,
    });

    // ✅ approved requests
    const approvedRequests = await AttendanceRequest.findAll({
      where: { month, status: "approved" },
      transaction: t,
    });

    // manual adjustments
    const manualRows = await AttendanceManualItem.findAll({
      where: { month },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    const manualByEmp = new Map();
    for (const m of manualRows) {
      if (!manualByEmp.has(m.employeeId)) manualByEmp.set(m.employeeId, []);
      manualByEmp.get(m.employeeId).push(m);
    }

    // ✅ Public Holidays for this month
    const publicHolidays = await PublicHoliday.findAll({
      where: { date: { [Op.between]: [start, end] } },
      transaction: t,
    });
    const holidayDates = new Set(publicHolidays.map((h) => h.date));
    const holidayMap = new Map(publicHolidays.map((h) => [h.date, h.name]));

    // legacy excuses map: emp__date -> minutes
    const excuseByEmpDate = new Map();
    const excuseStats = new Map(); // employeeId -> { totalMinutes, count }

    for (const ex of excuses) {
      const key = `${ex.employeeId}__${ex.date}`;
      excuseByEmpDate.set(key, (excuseByEmpDate.get(key) || 0) + Number(ex.minutes || 0));

      const st = excuseStats.get(ex.employeeId) || { totalMinutes: 0, count: 0 };
      st.totalMinutes += Number(ex.minutes || 0);
      st.count += 1;
      excuseStats.set(ex.employeeId, st);
    }

    // approved requests maps
    const approvedExcuseByEmpDate = new Map(); // excuse_minutes
    const approvedLeaveByEmpDate = new Map();  // leave_day -> leaveType
    const approvedReqStats = new Map();        // employeeId -> { totalMinutes, count }

    for (const r of approvedRequests) {
      const key = `${r.employeeId}__${r.date}`;

      if (r.type === "excuse_minutes") {
        const m = Number(r.minutes || 0);
        if (m > 0) {
          approvedExcuseByEmpDate.set(key, (approvedExcuseByEmpDate.get(key) || 0) + m);

          const st = approvedReqStats.get(r.employeeId) || { totalMinutes: 0, count: 0 };
          st.totalMinutes += m;
          st.count += 1;
          approvedReqStats.set(r.employeeId, st);
        }
      }

      if (r.type === "leave_day") {
        const lt = r.leaveType || "annual";
        approvedLeaveByEmpDate.set(key, lt); // annual | sick | errand | ...
      }
    }

    // group days by employee
    const byEmp = new Map();
    for (const d of days) {
      if (!byEmp.has(d.employeeId)) byEmp.set(d.employeeId, []);
      byEmp.get(d.employeeId).push(d);
    }

    // idempotent summaries
    await AttendanceMonthlySummary.destroy({ where: { importId }, transaction: t });

    for (const [employeeId, empDays] of byEmp.entries()) {
      let graceUsed = 0;

      let totalLate = 0;
      let totalEffectiveLate = 0;

      let totalLatePenaltyDays = 0;
      let absentDays = 0;
      let totalAbsentPenaltyDays = 0;

      for (const d of empDays) {
        const isException = !!d.isException;
        const dayKey = `${employeeId}__${d.date}`;

        const isPublicHoliday = holidayDates.has(d.date);
        const approvedLeaveType = approvedLeaveByEmpDate.get(dayKey) || null;

        // ✅ Public Holiday Handling (Highest Priority)
        if (isPublicHoliday) {
          d.excuseMinutesApplied = 0;
          d.effectiveLateMinutes = 0;
          d.graceApplied = false;
          d.latePenaltyDays = 0;
          d.absentPenaltyDays = 0;
          d.totalPenaltyDays = 0;
          d.policyReason = `public_holiday: ${holidayMap.get(d.date) || ""}`;
          await d.save({ transaction: t });
          continue;
        }

        // ✅ Leave day handling
        if (approvedLeaveType) {
          const lt = String(approvedLeaveType);

          // annual / errand => no salary deduction
          // sick => quarter day salary deduction
          const sickPenalty = lt === "sick" ? 0.25 : 0;

          d.excuseMinutesApplied = 0;
          d.effectiveLateMinutes = 0;

          d.graceApplied = false;
          d.latePenaltyDays = 0;

          d.absentPenaltyDays = sickPenalty;
          d.totalPenaltyDays = sickPenalty;

          d.policyReason = `leave_${lt}_approved`;

          if (!isException && sickPenalty > 0) {
            totalAbsentPenaltyDays += sickPenalty; // treat as "absence-like" penalty
          }

          await d.save({ transaction: t });
          continue;
        }

        // ✅ excuse minutes = legacy + approved requests
        let excuseMin = 0;
        if (excuseByEmpDate.has(dayKey)) excuseMin += Number(excuseByEmpDate.get(dayKey) || 0);
        if (approvedExcuseByEmpDate.has(dayKey))
          excuseMin += Number(approvedExcuseByEmpDate.get(dayKey) || 0);

        // absent (no approved leave)
        if (d.absent) {
          d.excuseMinutesApplied = 0;
          d.effectiveLateMinutes = 0;

          d.graceApplied = false;
          d.latePenaltyDays = 0;
          d.absentPenaltyDays = 1.0;
          d.totalPenaltyDays = 1.0;
          d.policyReason = "absent_full_day";

          if (!isException) {
            absentDays += 1;
            totalAbsentPenaltyDays += 1.0;
          }

          await d.save({ transaction: t });
          continue;
        }

        // late
        const lateMin = Number(d.lateMinutes || 0);
        const effectiveLate = Math.max(lateMin - Number(excuseMin || 0), 0);

        if (!isException) {
          totalLate += lateMin;
          totalEffectiveLate += effectiveLate;
        }

        const graceAvailable =
          !isException &&
          effectiveLate > 0 &&
          effectiveLate <= 15 &&
          graceUsed < GRACE_MAX_COUNT;

        const r = calcLatePenaltyDays(effectiveLate, graceAvailable);

        if (!isException && r.graceApplied) graceUsed += 1;

        d.excuseMinutesApplied = excuseMin;
        d.effectiveLateMinutes = effectiveLate;
        d.graceApplied = r.graceApplied;

        d.latePenaltyDays = r.penalty;
        d.absentPenaltyDays = 0;
        d.totalPenaltyDays = Number(r.penalty || 0);
        d.policyReason = r.reason;

        if (!isException) {
          totalLatePenaltyDays += Number(r.penalty || 0);
        }

        await d.save({ transaction: t });
      }

      const totalPenaltyDays = Number(totalLatePenaltyDays) + Number(totalAbsentPenaltyDays);

      // Payroll calculation (✅ NET first, fallback to GROSS)
      const payroll = await EmployeePayrollInsurance.findOne({
        where: { employeeId },
        transaction: t,
      });

      const salaryBase =
        payroll?.netSalary ??
        payroll?.net_salary ??
        payroll?.grossSalary ??
        payroll?.gross_salary ??
        null;

      let dayRate = null;
      let deductionAmount = null;

      if (salaryBase !== null && workingDays > 0) {
        dayRate = Number(salaryBase) / Number(workingDays);
        deductionAmount = Number(dayRate) * Number(totalPenaltyDays);
      }

      // manual adjustments
      const empManual = manualByEmp.get(employeeId) || [];
      let manualDelta = 0;

      for (const m of empManual) {
        if (m.isException) continue;

        const dir = String(m.direction || "deduct").toLowerCase();
        const sign = dir === "add" ? -1 : 1;

        let val = 0;
        if (m.amount !== null && typeof m.amount !== "undefined") {
          val = Number(m.amount) || 0;
        } else if (m.days !== null && typeof m.days !== "undefined") {
          const dd = Number(m.days) || 0;
          if (dayRate !== null && dd > 0) val = Number(dayRate) * dd;
        }

        manualDelta += sign * val;
      }

      if (deductionAmount === null) {
        deductionAmount = manualDelta !== 0 ? Number(manualDelta) : null;
      } else {
        deductionAmount = Number(deductionAmount) + Number(manualDelta);
      }

      if (deductionAmount !== null && deductionAmount < 0) deductionAmount = 0;

      // summary excuses = legacy + approved request excuses
      const legacy = excuseStats.get(employeeId) || { totalMinutes: 0, count: 0 };
      const reqSt = approvedReqStats.get(employeeId) || { totalMinutes: 0, count: 0 };

      await AttendanceMonthlySummary.create(
        {
          importId,
          employeeId,
          month,
          graceUsedCount: graceUsed,

          totalLateMinutes: totalLate,
          totalEffectiveLateMinutes: totalEffectiveLate,

          totalExcuseMinutes: Number(legacy.totalMinutes) + Number(reqSt.totalMinutes),
          excusesCount: Number(legacy.count) + Number(reqSt.count),

          absentDays,
          totalLatePenaltyDays,
          totalAbsentPenaltyDays,
          totalPenaltyDays,

          // NOTE: column name kept, but value is NET base when available
          salaryGrossUsed: salaryBase,
          dayRate: dayRate === null ? null : dayRate,
          deductionAmount: deductionAmount === null ? null : deductionAmount,
          computedAt: new Date(),
        },
        { transaction: t }
      );
    }

    await t.commit();
    return { ok: true, importId, month };
  } catch (e) {
    await t.rollback();
    throw e;
  }
}

module.exports = { computeMonthForImport };
