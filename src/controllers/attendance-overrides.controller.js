const {
  AttendanceMonthlySummary,
  AttendanceDay,
  sequelize,
} = require("../models");
const { computeMonthForImport } = require("../services/attendance/computeAttendance.service");

// PATCH /api/attendance/summary/:id
exports.updateSummaryOverrides = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      manualAdjustmentAmount, 
      postponedAmount, 
      postponedReason,
      salaryIncreaseAmount,
      salaryIncreaseReason,
      status 
    } = req.body;

    const summary = await AttendanceMonthlySummary.findByPk(id);
    if (!summary) return res.status(404).json({ message: "Summary not found" });

    if (summary.status === 'locked' && !req.user.role === 'admin') {
      return res.status(403).json({ message: "Month is locked" });
    }

    if (manualAdjustmentAmount !== undefined) summary.manualAdjustmentAmount = manualAdjustmentAmount;
    if (postponedAmount !== undefined) summary.postponedAmount = postponedAmount;
    if (postponedReason !== undefined) summary.postponedReason = postponedReason;
    if (req.body.postponedType !== undefined) summary.postponedType = req.body.postponedType;
    if (req.body.postponedToMonth !== undefined) summary.postponedToMonth = req.body.postponedToMonth;

    if (salaryIncreaseAmount !== undefined) summary.salaryIncreaseAmount = salaryIncreaseAmount;
    if (salaryIncreaseReason !== undefined) summary.salaryIncreaseReason = salaryIncreaseReason;
    
    if (req.body.incomingPostponedAmount !== undefined) summary.incomingPostponedAmount = req.body.incomingPostponedAmount;
    if (req.body.incomingPostponedReason !== undefined) summary.incomingPostponedReason = req.body.incomingPostponedReason;
    if (req.body.incomingPostponedType !== undefined) summary.incomingPostponedType = req.body.incomingPostponedType;
    if (req.body.incomingPostponedFromMonth !== undefined) summary.incomingPostponedFromMonth = req.body.incomingPostponedFromMonth;

    if (status !== undefined) summary.status = status;

    // Re-calculate finalNetSalary
    const base = Number(summary.salaryGrossUsed || 0);
    const kpi = Number(summary.totalKpiBonus || 0);
    const ded = Number(summary.deductionAmount || 0);
    const loans = Number(summary.loanInstallmentAmount || 0);
    const manual = Number(summary.manualAdjustmentAmount || 0);
    const outgoingPost = Number(summary.postponedAmount || 0);
    const incomingPost = Number(summary.incomingPostponedAmount || 0);
    const inc = Number(summary.salaryIncreaseAmount || 0);

    // Net = Base + KPI + Increase + Manual + OutgoingPost(restore) - Ded(Current) - Loans - IncomingPost(new ded)
    summary.finalNetSalary = Math.max(0, base + kpi + inc + manual + outgoingPost - ded - loans - incomingPost);

    await summary.save();

    return res.status(200).json(summary);
  } catch (e) {
    console.error("updateSummaryOverrides error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.lockMonthSummaries = async (req, res) => {
  try {
    const { month } = req.body;
    if (!month) return res.status(400).json({ message: "Month is required" });

    // Lock all summaries for this month that are currently in draft
    const [updatedCount] = await AttendanceMonthlySummary.update(
      { status: 'locked' },
      { where: { month, status: 'draft' } }
    );

    return res.json({ success: true, updatedCount });
  } catch (e) {
    console.error("lockMonthSummaries error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// POST /api/attendance/waive-day
exports.waiveDayPenalty = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { employeeId, date, importId } = req.body;

    const day = await AttendanceDay.findOne({
      where: { employeeId, date, importId },
      transaction: t
    });

    if (!day) {
      await t.rollback();
      return res.status(404).json({ message: "Attendance day not found" });
    }

    day.isException = !day.isException; // Toggle exception
    await day.save({ transaction: t });

    await t.commit();

    // Trigger recompute for the whole import
    await computeMonthForImport(importId);

    return res.status(200).json({ ok: true, isException: day.isException });
  } catch (e) {
    await t.rollback();
    console.error(e);
    return res.status(500).json({ message: "Internal server error" });
  }
};
