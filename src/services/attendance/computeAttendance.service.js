const { Op } = require("sequelize");
const {
  AttendanceImport,
  AttendanceDay,
  AttendanceExcuse,
  AttendanceMonthlySummary,
  EmployeePayrollInsurance,
  AttendanceManualItem,
  sequelize,
} = require("../../models");

const GRACE_MAX_COUNT = 4;
const GRACE_MAX_MINUTES = 15;

// Policy (حسب اللي اتفقنا عليه)
function calcLatePenaltyDays(effectiveLateMinutes, graceAvailable) {
  if (!effectiveLateMinutes || effectiveLateMinutes <= 0) {
    return { penalty: 0, graceApplied: false, reason: "no_late" };
  }

  if (effectiveLateMinutes <= GRACE_MAX_MINUTES && graceAvailable) {
    return { penalty: 0, graceApplied: true, reason: "grace_used" };
  }

  // after grace / not eligible
  if (effectiveLateMinutes <= 15)
    return { penalty: 0.25, graceApplied: false, reason: "late_0_15" };
  if (effectiveLateMinutes <= 30)
    return { penalty: 0.5, graceApplied: false, reason: "late_16_30" };

  // IMPORTANT (افتراض): 31-44 = 0.5 ، 45+ = 1.0
  if (effectiveLateMinutes < 45)
    return { penalty: 0.5, graceApplied: false, reason: "late_31_44" };
  return { penalty: 1.0, graceApplied: false, reason: "late_45_plus" };
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

    // Load all days for this import
    const days = await AttendanceDay.findAll({
      where: { importId },
      order: [
        ["employeeId", "ASC"],
        ["date", "ASC"],
      ],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    // Load excuses in this month (for all employees)
    const excuses = await AttendanceExcuse.findAll({
      where: {
        date: {
          [Op.gte]: `${month}-01`,
          [Op.lte]: `${month}-31`,
        },
      },
      transaction: t,
    });


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


    // Map excuses: employeeId -> dateISO -> minutes
    const excuseByEmpDate = new Map();
    const excuseStats = new Map(); // employeeId -> { totalMinutes, count }

    for (const ex of excuses) {
      const key = `${ex.employeeId}__${ex.date}`;
      excuseByEmpDate.set(
        key,
        (excuseByEmpDate.get(key) || 0) + Number(ex.minutes || 0)
      );

      const st = excuseStats.get(ex.employeeId) || {
        totalMinutes: 0,
        count: 0,
      };
      st.totalMinutes += Number(ex.minutes || 0);
      st.count += 1;
      excuseStats.set(ex.employeeId, st);
    }

    // Group by employee
    const byEmp = new Map();
    for (const d of days) {
      if (!byEmp.has(d.employeeId)) byEmp.set(d.employeeId, []);
      byEmp.get(d.employeeId).push(d);
    }

    // Delete previous summaries for this import (idempotent)
    await AttendanceMonthlySummary.destroy({
      where: { importId },
      transaction: t,
    });

    // Compute per employee and upsert days
    for (const [employeeId, empDays] of byEmp.entries()) {
      let graceUsed = 0;

      let totalLate = 0;
      let totalEffectiveLate = 0;

      let totalLatePenaltyDays = 0;
      let absentDays = 0;
      let totalAbsentPenaltyDays = 0;

      for (const d of empDays) {
        const isException = !!d.isException;

        let excuseMin = 0;
        const exKey = `${employeeId}__${d.date}`;
        if (excuseByEmpDate.has(exKey)) excuseMin = excuseByEmpDate.get(exKey);

        // absent -> full day
        if (d.absent) {
          d.excuseMinutesApplied = 0;
          d.effectiveLateMinutes = 0;

          // لو exception: ما تستهلكش grace وما تدخلش totals، لكن نحتفظ بقيم penalty للعرض
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

        // ✅ totals should reflect penalized (non-exception) items only
        if (!isException) {
          totalLate += lateMin;
          totalEffectiveLate += effectiveLate;
        }

        // grace availability: only for non-exception days
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

        // ✅ accumulate penalties only if not exception
        if (!isException) {
          totalLatePenaltyDays += Number(r.penalty || 0);
        }

        await d.save({ transaction: t });
      }

      const totals = {
        totalPenaltyDays:
          Number(totalLatePenaltyDays) + Number(totalAbsentPenaltyDays),
      };

      // Payroll calculation
      const payroll = await EmployeePayrollInsurance.findOne({
        where: { employeeId },
        transaction: t,
      });
      const grossSalary = payroll?.grossSalary ?? null;

      let dayRate = null;
      let deductionAmount = null;

      if (grossSalary !== null && workingDays > 0) {
        dayRate = Number(grossSalary) / Number(workingDays);
        deductionAmount = Number(dayRate) * Number(totals.totalPenaltyDays);
      }


            // ✅ apply manual adjustments into deductionAmount
      const empManual = manualByEmp.get(employeeId) || [];
      let manualDelta = 0;

      for (const m of empManual) {
        if (m.isException) continue;

        const dir = String(m.direction || 'deduct').toLowerCase();
        const sign = dir === 'add' ? -1 : 1;

        let val = 0;
        if (m.amount !== null && typeof m.amount !== 'undefined') {
          val = Number(m.amount) || 0;
        } else if (m.days !== null && typeof m.days !== 'undefined') {
          const d = Number(m.days) || 0;
          if (dayRate !== null && d > 0) val = Number(dayRate) * d;
        }

        manualDelta += sign * val;
      }

      if (deductionAmount === null) {
        // لو مفيش salary/dayRate بس فيه manual amount صريح
        deductionAmount = manualDelta !== 0 ? Number(manualDelta) : null;
      } else {
        deductionAmount = Number(deductionAmount) + Number(manualDelta);
      }

      // clamp: no negative deduction
      if (deductionAmount !== null && deductionAmount < 0) deductionAmount = 0;

      const exSt = excuseStats.get(employeeId) || { totalMinutes: 0, count: 0 };

      await AttendanceMonthlySummary.create(
        {
          importId,
          employeeId,
          month,
          graceUsedCount: graceUsed,

          totalLateMinutes: totalLate,
          totalEffectiveLateMinutes: totalEffectiveLate,

          totalExcuseMinutes: exSt.totalMinutes,
          excusesCount: exSt.count,

          absentDays,
          totalLatePenaltyDays,
          totalAbsentPenaltyDays,
          totalPenaltyDays: totals.totalPenaltyDays,

          salaryGrossUsed: grossSalary,
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
