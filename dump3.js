const fs = require('fs');

const path = './src/controllers/report.controller.js';
const code = fs.readFileSync(path, 'utf-8');

const newAchievementsReport = `exports.getOperationAchievementsReport = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const now = new Date();
    const fromRaw = parseDateOrNull(req.query.from);
    const toRaw = parseDateOrNull(req.query.to);

    const from = fromRaw ? startOfDay(fromRaw) : startOfDay(addDays(now, -30));
    const to = toRaw ? endOfDay(toRaw) : endOfDay(now);

    const canViewAll = user.role === 'admin' || isOperationManagerOrSupervisor(user);
    const includeInactive = canViewAll && req.query.includeInactive === '1';

    const staffLoad = await loadOperationStaff({ user, includeInactive, assigneeId: req.query.assigneeId });
    if (staffLoad.error) return res.status(staffLoad.error.status).json({ message: staffLoad.error.message });
    const staff = staffLoad.staff;
    const staffIds = staff.map((s) => s.id);
    if (!staffIds.length) {
      return res.json({ range: { from: toDateOnlyString(from), to: toDateOnlyString(to) }, requests: [] });
    }

    const calls = await Call.findAll({
      where: {
        assignee_id: { [Op.in]: staffIds },
        status: 'completed',
        [Op.or]: [
          { date: { [Op.between]: [from, to] } },
          { createdAt: { [Op.between]: [from, to] } },
        ],
      },
      attributes: ['id', 'assignee_id', 'date', 'createdAt', 'phone'],
      raw: true,
    });

    const windowDays = 14;
    const interviewsFrom = toDateOnlyString(from);
    const interviewsTo = toDateOnlyString(addDays(to, windowDays));

    const interviews = await Interview.findAll({
      where: {
        phoneNumber: { [Op.ne]: null },
        date: { [Op.between]: [interviewsFrom, interviewsTo] },
        inventoryPendingRequestItemId: { [Op.ne]: null },
      },
      attributes: ['id', 'phoneNumber', 'date', 'inventoryPendingRequestItemId'],
      raw: true,
    });

    const interviewMap = new Map();
    for (const it of interviews) {
      const p = normalizePhone(it.phoneNumber);
      if (!p) continue;
      if (!interviewMap.has(p)) interviewMap.set(p, []);
      interviewMap.get(p).push(it);
    }

    const matchedInterviewItemIds = new Set();
    const assigneeBuckets = new Map();
    for(const s of staff) assigneeBuckets.set(s.id, new Map());

    for (const c of calls) {
      const p = normalizePhone(c.phone);
      if (!p || !interviewMap.has(p)) continue;
      
      const dTime = c.date ? new Date(c.date).getTime() : NaN;
      const baseDate = !isNaN(dTime) ? new Date(c.date) : new Date(c.createdAt);
      if (baseDate < from || baseDate > to) continue;
      const callDate = startOfDay(baseDate);
      const maxDate = endOfDay(addDays(callDate, windowDays));

      const datesIt = interviewMap.get(p);
      const matched = datesIt.filter(it => {
         const d = parseDateOnlyAsLocal(it.date) || new Date(it.date);
         return d >= callDate && d <= maxDate;
      });

      if (matched.length > 0) {
        const b = assigneeBuckets.get(c.assignee_id);
        if(!b) continue;
        const uniqueItemIds = [...new Set(matched.map(m => m.inventoryPendingRequestItemId))];
        for(const itemId of uniqueItemIds) {
           matchedInterviewItemIds.add(itemId);
           b.set(itemId, (b.get(itemId) || 0) + 1);
        }
      }
    }

    const prItemsAll = await PendingRequestItem.findAll({
      include: [
        {
          model: PendingRequest,
          as: 'pendingRequest',
          include: [{ model: Client, as: 'client', attributes: ['id', 'name'] }]
        }
      ]
    });

    // filter only items that are APPROVED or matched
    const relevantItems = prItemsAll.filter(item => {
      const isApproved = item.pendingRequest && item.pendingRequest.status === 'APPROVED';
      const isMatched = matchedInterviewItemIds.has(item.id);
      return isApproved || isMatched;
    });

    // Calculate total fulfilled by team (all staff)
    const teamTotalBuckets = new Map();
    for(const b of assigneeBuckets.values()) {
       for(const [itemId, count] of b.entries()) {
          teamTotalBuckets.set(itemId, (teamTotalBuckets.get(itemId) || 0) + count);
       }
    }

    const requests = [];
    for(const item of relevantItems) {
       const clientName = item.pendingRequest?.client?.name || 'Unknown Client';
       const reqDate = item.pendingRequest?.requestDate || null;
       const target = item.vehicleCount || 0;
       const teamFulfilled = teamTotalBuckets.get(item.id) || 0;

       // assignee breakdowns
       const assignees = [];
       for(const s of staff) {
          const count = assigneeBuckets.get(s.id)?.get(item.id) || 0;
          assignees.push({
             assigneeId: s.id,
             fullName: s.fullName,
             fulfilled: count
          });
       }

       requests.push({
          itemId: item.id,
          pendingRequestId: item.pendingRequestId,
          clientName,
          requestDate: reqDate,
          vehicleType: item.vehicleType,
          target,
          teamFulfilled,
          assignees
       });
    }

    // Sort by client name
    requests.sort((a, b) => a.clientName.localeCompare(b.clientName));

    return res.json({
      range: { from: toDateOnlyString(from), to: toDateOnlyString(to) },
      requests,
    });
  } catch (e) {
    console.error('getOperationAchievementsReport error:', e);
    return res.status(500).json({ message: 'Internal server error' });
  }
};`;

const startIndex = code.indexOf('exports.getOperationAchievementsReport = async (req, res) => {');
const endIndexStr = "} catch (e) {\n    console.error('getOperationAchievementsReport error:', e);\n    return res.status(500).json({ message: 'Internal server error' });\n  }\n};";
const endIndex = code.indexOf(endIndexStr, startIndex);

if (startIndex > -1 && endIndex > -1) {
    const finalCode = code.substring(0, startIndex) + newAchievementsReport + code.substring(endIndex + endIndexStr.length);
    fs.writeFileSync(path, finalCode, 'utf-8');
    console.log('REPLACED');
} else {
    console.log('NOT FOUND', startIndex, endIndex);
}
