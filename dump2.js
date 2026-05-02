const { Op } = require('sequelize');
const { Call, Interview, PendingRequestItem, PendingRequest, Client, Auth } = require('./src/models');
const { parseDateOnlyAsLocal, startOfDay, endOfDay, addDays, toDateOnlyString, normalizePhone, loadOperationStaff } = require('./src/utils/helpers'); // Assuming

exports.getOperationAchievementsReport = async (req, res) => {
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

    // calls (any status) in range
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

    const interviewMap = new Map(); // phone -> [interviews]
    for (const it of interviews) {
      const p = normalizePhone(it.phoneNumber);
      if (!p) continue;
      if (!interviewMap.has(p)) interviewMap.set(p, []);
      interviewMap.get(p).push(it);
    }

    // We collect all PR item IDs that were hit by these interviews
    // Wait, what if someone fulfilled a PR that is NOT connected to these interviews currently?
    // The user said: "في ال pending request jumia محتاجة 5 sedan. انا جبت كام من ال 5"
    // To show the full list of active PRs, we should query ALL Active/Approved PendingRequests,
    // plus any PRs that these matched interviews belong to (in case they got completed/closed).
    
    // 1. Matched Interviews (converted within window)
    const matchedInterviewItemIds = new Set();
    const assigneeBuckets = new Map(); // assigneeId -> { itemId -> count }
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
        for(const m of matched) {
           matchedInterviewItemIds.add(m.inventoryPendingRequestItemId);
           b.set(m.inventoryPendingRequestItemId, (b.get(m.inventoryPendingRequestItemId) || 0) + 1);
        }
      }
    }

    // 2. Fetch PendingRequests
    // We want ALL Approved, or if its ID is in matchedInterviewItemIds
    const prItems = await PendingRequestItem.findAll({
       where: {
          [Op.or]: [
             { '$PendingRequest.status$': 'APPROVED' },
             { id: { [Op.in]: Array.from(matchedInterviewItemIds) } }
          ]
       },
       include: [
         {
           model: PendingRequest,
           as: 'PendingRequest', // adjust alias
           include: [{ model: Client, as: 'Client' }] // adjust alias
         }
       ]
    });

    // Need to format properly
  } catch(e) {}
}
