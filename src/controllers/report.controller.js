// src/controllers/report.controller.js
const { Op } = require('sequelize');
const {
  Auth,
  Call,
  Interview,
  PendingRequest,
  PendingRequestItem,
  Client,
  Hub,
  Zone,
} = require('../models');

const { isOperationManagerOrSupervisor } = require('../middlewares/role.helpers');
const { normalizePhone } = require('../utils/phone-normalizer');

/** =========================
 * Date helpers
 * ========================= */

function parseDateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function toDateOnlyString(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Parse DATEONLY (YYYY-MM-DD) as LOCAL date to avoid timezone shifts
function parseDateOnlyAsLocal(ymd) {
  if (!ymd) return null;
  const s = String(ymd).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return new Date(y, mo - 1, d, 0, 0, 0, 0);
}

// ISO week start (Monday)
function startOfISOWeek(d) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  x.setDate(x.getDate() + diff);
  return x;
}

/** =========================
 * Permissions helpers
 * ========================= */

// operation staff scope
async function loadOperationStaff({ user, includeInactive, assigneeId }) {
  const canViewAll =
    user.role === 'admin' || isOperationManagerOrSupervisor(user);

  const isOpStaff =
    user.role === 'operation' &&
    (user.position === 'senior' || user.position === 'junior');

  if (!canViewAll && !isOpStaff) {
    return { error: { status: 403, message: 'Operation staff only' } };
  }

  let staff = [];

  if (canViewAll) {
    const staffWhere = {
      role: 'operation',
      position: { [Op.in]: ['senior', 'junior'] },
    };
    if (!includeInactive) staffWhere.isActive = true;

    staff = await Auth.findAll({
      where: staffWhere,
      attributes: ['id', 'fullName', 'email', 'position', 'isActive'],
      order: [['fullName', 'ASC']],
    });
  } else {
    const me = await Auth.findByPk(user.id, {
      attributes: ['id', 'fullName', 'email', 'position', 'isActive'],
    });
    if (!me) return { error: { status: 404, message: 'User not found' } };
    staff = [me];
  }

  if (canViewAll && assigneeId) {
    const aId = Number(assigneeId);
    if (!Number.isNaN(aId)) {
      staff = staff.filter((s) => s.id === aId);
    }
  }

  return { staff, canViewAll, isOpStaff };
}

// account managers scope
function getAccountManagersReportScope(user) {
  if (!user) return { allowed: false };

  const canViewAll =
    user.role === 'admin' ||
    isOperationManagerOrSupervisor(user) ||
    user.position === 'manager' ||
    user.position === 'supervisor';

  // CRM يشوف نفسه فقط
  const canViewSelfOnly = !canViewAll && user.role === 'crm';

  if (canViewAll) return { allowed: true, scope: 'all' };
  if (canViewSelfOnly) return { allowed: true, scope: 'self' };

  return { allowed: false };
}

function normalizeCompanyBucket(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'a' || s === 'companya' || s === '1') return 'A';
  if (s === 'b' || s === 'companyb' || s === '2') return 'B';
  return null;
}

/** =========================
 * 1) GET /api/reports/operation-calls-interviews
 * ========================= */

exports.getOperationCallsInterviewsReport = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const canViewAll =
      user.role === 'admin' || isOperationManagerOrSupervisor(user);

    const isOpStaff =
      user.role === 'operation' &&
      (user.position === 'senior' || user.position === 'junior');

    if (!canViewAll && !isOpStaff) {
      return res.status(403).json({ message: 'Operation staff only' });
    }

    const now = new Date();
    const fromRaw = parseDateOrNull(req.query.from);
    const toRaw = parseDateOrNull(req.query.to);

    const from = fromRaw ? startOfDay(fromRaw) : startOfDay(addDays(now, -30));
    const to = toRaw ? endOfDay(toRaw) : endOfDay(now);

    const wd = Number(req.query.windowDays || 14);
    const windowDays = Math.max(
      1,
      Math.min(90, Number.isFinite(wd) ? wd : 14)
    );

    const includeInactive = canViewAll && req.query.includeInactive === '1';

    // details flags (manager/admin فقط)
    const includeDetails = canViewAll && req.query.includeDetails === '1';
    const detailsTypeRaw = String(req.query.detailsType || 'all').toLowerCase();
    const detailsType =
      detailsTypeRaw === 'completed' || detailsTypeRaw === 'converted'
        ? detailsTypeRaw
        : 'all';

    const limitRaw = Number(req.query.detailsLimit || 50);
    const detailsLimit = Math.max(
      1,
      Math.min(500, Number.isFinite(limitRaw) ? limitRaw : 50)
    );

    // staff
    const staffLoad = await loadOperationStaff({
      user,
      includeInactive,
      assigneeId: req.query.assigneeId,
    });
    if (staffLoad.error) {
      return res.status(staffLoad.error.status).json({ message: staffLoad.error.message });
    }
    const staff = staffLoad.staff;

    const staffIds = staff.map((s) => s.id);
    if (!staffIds.length) {
      return res.json({
        range: {
          from: toDateOnlyString(from),
          to: toDateOnlyString(to),
          windowDays,
        },
        totals: {
          completedCalls: 0,
          convertedCalls: 0,
          uniquePhonesCompleted: 0,
          uniqueConvertedPhones: 0,
        },
        rows: [],
      });
    }

    // Calls (completed only)
    const calls = await Call.findAll({
      where: {
        assignee_id: { [Op.in]: staffIds },
        status: 'completed',
        [Op.or]: [
          { date: { [Op.between]: [from, to] } },
          { date: null, createdAt: { [Op.between]: [from, to] } },
        ],
      },
      attributes: ['id', 'assignee_id', 'date', 'createdAt', 'phone'],
      order: [['createdAt', 'ASC']],
    });

    // Interviews in extended range
    const interviewsFrom = toDateOnlyString(from);
    const interviewsTo = toDateOnlyString(addDays(to, windowDays));

    const interviews = await Interview.findAll({
      where: {
        phoneNumber: { [Op.ne]: null },
        date: { [Op.between]: [interviewsFrom, interviewsTo] },
      },
      attributes: ['id', 'phoneNumber', 'date', 'courierName'],
      raw: true,
    });

    // phone -> dates[]
    const interviewMap = new Map();
    // phone -> name fallback
    const interviewNameMap = new Map();

    for (const it of interviews) {
      const p = normalizePhone(it.phoneNumber);
      if (!p) continue;

      const d = parseDateOnlyAsLocal(it.date) || new Date(it.date);
      if (!interviewMap.has(p)) interviewMap.set(p, []);
      interviewMap.get(p).push(d);

      const nm = (it.courierName || '').trim();
      if (nm && !interviewNameMap.has(p)) interviewNameMap.set(p, nm);
    }

    // Aggregation
    const agg = new Map();
    for (const s of staff) {
      agg.set(s.id, {
        assignee: s,
        completedCalls: 0,
        convertedCalls: 0,
        completedPhones: new Set(),
        convertedPhones: new Set(),

        // details
        detailsCompleted: [],
        detailsConverted: [],
        seenCompleted: new Set(),
        seenConverted: new Set(),
      });
    }

    for (const c of calls) {
      const aId = c.assignee_id;
      const bucket = agg.get(aId);
      if (!bucket) continue;

      bucket.completedCalls += 1;

      const phone = normalizePhone(c.phone);
      if (phone) bucket.completedPhones.add(phone);

      const baseDate = c.date ? new Date(c.date) : new Date(c.createdAt);

      // completed details
      if (
        includeDetails &&
        phone &&
        (detailsType === 'all' || detailsType === 'completed')
      ) {
        if (
          bucket.detailsCompleted.length < detailsLimit &&
          !bucket.seenCompleted.has(phone)
        ) {
          bucket.seenCompleted.add(phone);

          const name = interviewNameMap.get(phone) || null;

          bucket.detailsCompleted.push({
            phone,
            name,
            callId: c.id,
            callDate: toDateOnlyString(baseDate),
            source: 'call',
          });
        }
      }

      // conversion check (FIXED: do NOT require c.date)
      if (phone && interviewMap.has(phone)) {
        const callDate = startOfDay(baseDate);
        const maxDate = endOfDay(addDays(callDate, windowDays));
        const dates = interviewMap.get(phone);

        const converted = dates.some((x) => x >= callDate && x <= maxDate);

        if (converted) {
          bucket.convertedCalls += 1;
          bucket.convertedPhones.add(phone);

          if (
            includeDetails &&
            (detailsType === 'all' || detailsType === 'converted')
          ) {
            if (
              bucket.detailsConverted.length < detailsLimit &&
              !bucket.seenConverted.has(phone)
            ) {
              bucket.seenConverted.add(phone);

              const name = interviewNameMap.get(phone) || null;

              bucket.detailsConverted.push({
                phone,
                name,
                callId: c.id,
                callDate: toDateOnlyString(baseDate),
                interviewDates: interviewMap.get(phone).map(toDateOnlyString),
                source: 'call+interview',
              });
            }
          }
        }
      }
    }

    // Response rows + totals
    const rows = [];
    let totalsCompleted = 0;
    let totalsConverted = 0;
    let totalsPhonesCompleted = 0;
    let totalsPhonesConverted = 0;

    for (const s of staff) {
      const b = agg.get(s.id);

      const uniquePhonesCompleted = b.completedPhones.size;
      const uniqueConvertedPhones = b.convertedPhones.size;

      const conversionRate = b.completedCalls
        ? b.convertedCalls / b.completedCalls
        : 0;

      totalsCompleted += b.completedCalls;
      totalsConverted += b.convertedCalls;
      totalsPhonesCompleted += uniquePhonesCompleted;
      totalsPhonesConverted += uniqueConvertedPhones;

      const row = {
        assignee: {
          id: s.id,
          fullName: s.fullName,
          email: s.email,
          position: s.position,
          isActive: s.isActive,
        },
        completedCalls: b.completedCalls,
        convertedCalls: b.convertedCalls,
        conversionRate,
        uniquePhonesCompleted,
        uniqueConvertedPhones,
      };

      if (includeDetails) {
        row.details = {
          completed: detailsType === 'converted' ? [] : b.detailsCompleted,
          converted: detailsType === 'completed' ? [] : b.detailsConverted,
        };
      }

      rows.push(row);
    }

    return res.json({
      range: {
        from: toDateOnlyString(from),
        to: toDateOnlyString(to),
        windowDays,
      },
      totals: {
        completedCalls: totalsCompleted,
        convertedCalls: totalsConverted,
        uniquePhonesCompleted: totalsPhonesCompleted,
        uniqueConvertedPhones: totalsPhonesConverted,
      },
      rows,
    });
  } catch (e) {
    console.error('getOperationCallsInterviewsReport error:', e);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/** =========================
 * 2) GET /api/reports/operation-achievements
 * ========================= */

exports.getOperationAchievementsReport = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const now = new Date();
    const fromRaw = parseDateOrNull(req.query.from);
    const toRaw = parseDateOrNull(req.query.to);

    const from = fromRaw ? startOfDay(fromRaw) : startOfDay(addDays(now, -30));
    const to = toRaw ? endOfDay(toRaw) : endOfDay(now);

    const canViewAll =
      user.role === 'admin' || isOperationManagerOrSupervisor(user);

    const includeInactive = canViewAll && req.query.includeInactive === '1';

    const staffLoad = await loadOperationStaff({
      user,
      includeInactive,
      assigneeId: req.query.assigneeId,
    });
    if (staffLoad.error) {
      return res.status(staffLoad.error.status).json({ message: staffLoad.error.message });
    }
    const staff = staffLoad.staff;

    const staffIds = staff.map((s) => s.id);
    if (!staffIds.length) {
      return res.json({
        range: { from: toDateOnlyString(from), to: toDateOnlyString(to) },
        columns: [],
        totals: {},
        rows: [],
      });
    }

    // calls (any status) in range
    const calls = await Call.findAll({
      where: {
        assignee_id: { [Op.in]: staffIds },
        [Op.or]: [
          { date: { [Op.between]: [from, to] } },
          { date: null, createdAt: { [Op.between]: [from, to] } },
        ],
      },
      attributes: ['id', 'assignee_id', 'date', 'createdAt', 'phone', 'status'],
      order: [['createdAt', 'ASC']],
    });

    // interviews for converted matching
    const windowDays = 14;
    const interviewsFrom = toDateOnlyString(from);
    const interviewsTo = toDateOnlyString(addDays(to, windowDays));

    const interviews = await Interview.findAll({
      where: {
        phoneNumber: { [Op.ne]: null },
        date: { [Op.between]: [interviewsFrom, interviewsTo] },
      },
      attributes: ['id', 'phoneNumber', 'date'],
      raw: true,
    });

    const interviewMap = new Map();
    for (const it of interviews) {
      const p = normalizePhone(it.phoneNumber);
      if (!p) continue;

      const d = parseDateOnlyAsLocal(it.date) || new Date(it.date);
      if (!interviewMap.has(p)) interviewMap.set(p, []);
      interviewMap.get(p).push(d);
    }

    const columns = [
      { key: 'totalCalls', label: 'Total Calls' },
      { key: 'completedCalls', label: 'Completed' },
      { key: 'pendingCalls', label: 'Pending' },
      { key: 'cancelledCalls', label: 'Cancelled' },
      { key: 'rescheduledCalls', label: 'Rescheduled' },
      { key: 'convertedCalls', label: 'Converted (to interview)' },
      { key: 'uniquePhones', label: 'Unique Phones' },
      { key: 'uniqueConvertedPhones', label: 'Unique Converted Phones' },
    ];

    const totals = {};
    for (const c of columns) totals[c.key] = 0;

    const agg = new Map();
    for (const s of staff) {
      agg.set(s.id, {
        assignee: s,
        metrics: {
          totalCalls: 0,
          completedCalls: 0,
          pendingCalls: 0,
          cancelledCalls: 0,
          rescheduledCalls: 0,
          convertedCalls: 0,
          uniquePhones: 0,
          uniqueConvertedPhones: 0,
        },
        phonesAll: new Set(),
        phonesConverted: new Set(),
      });
    }

    for (const c of calls) {
      const bucket = agg.get(c.assignee_id);
      if (!bucket) continue;

      bucket.metrics.totalCalls += 1;

      const st = (c.status || '').toString();
      if (st === 'completed') bucket.metrics.completedCalls += 1;
      else if (st === 'pending') bucket.metrics.pendingCalls += 1;
      else if (st === 'cancelled') bucket.metrics.cancelledCalls += 1;
      else if (st === 'rescheduled') bucket.metrics.rescheduledCalls += 1;

      const phone = normalizePhone(c.phone);
      if (phone) bucket.phonesAll.add(phone);

      // converted only for completed calls (FIXED: do NOT require c.date)
      if (st === 'completed' && phone && interviewMap.has(phone)) {
        const baseDate = c.date ? new Date(c.date) : new Date(c.createdAt);
        const callDate = startOfDay(baseDate);
        const maxDate = endOfDay(addDays(callDate, windowDays));
        const dates = interviewMap.get(phone);

        const matched = dates.some((x) => x >= callDate && x <= maxDate);
        if (matched) {
          bucket.metrics.convertedCalls += 1;
          bucket.phonesConverted.add(phone);
        }
      }
    }

    const rows = [];
    for (const s of staff) {
      const b = agg.get(s.id);

      b.metrics.uniquePhones = b.phonesAll.size;
      b.metrics.uniqueConvertedPhones = b.phonesConverted.size;

      for (const col of columns) {
        totals[col.key] += Number(b.metrics[col.key] || 0);
      }

      rows.push({
        assignee: {
          id: s.id,
          fullName: s.fullName,
          email: s.email,
          position: s.position,
          isActive: s.isActive,
        },
        metrics: b.metrics,
      });
    }

    return res.json({
      range: { from: toDateOnlyString(from), to: toDateOnlyString(to) },
      columns,
      totals,
      rows,
    });
  } catch (e) {
    console.error('getOperationAchievementsReport error:', e);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/** =========================
 * 3) GET /api/reports/account-managers-fulfillment
 *
 * Fulfillment definition:
 *  - Interview.inventoryAppliedAt != null AND between [from,to]
 *
 * Query:
 *  - from=YYYY-MM-DD (optional) default: last 30 days
 *  - to=YYYY-MM-DD (optional) default: today
 *  - accountManagerId=123 (optional) (manager/admin فقط)
 *  - includeDetails=1 (optional)
 *  - detailsLimit=200 (optional, max 1000)
 * ========================= */

exports.getAccountManagersFulfillmentReport = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const scope = getAccountManagersReportScope(user);
    if (!scope.allowed) return res.status(403).json({ message: 'Not allowed' });

    const now = new Date();
    const fromRaw = parseDateOrNull(req.query.from);
    const toRaw = parseDateOrNull(req.query.to);

    const from = fromRaw ? startOfDay(fromRaw) : startOfDay(addDays(now, -30));
    const to = toRaw ? endOfDay(toRaw) : endOfDay(now);

    const includeDetails = req.query.includeDetails === '1';

    const limitRaw = Number(req.query.detailsLimit || 200);
    const detailsLimit = Math.max(
      1,
      Math.min(1000, Number.isFinite(limitRaw) ? limitRaw : 200)
    );

    // accountManagerId filter
    const accountManagerIdRaw = req.query.accountManagerId;
    let accountManagerId = accountManagerIdRaw ? Number(accountManagerIdRaw) : null;
    if (accountManagerIdRaw && Number.isNaN(accountManagerId)) accountManagerId = null;

    // enforce scope
    if (scope.scope === 'self') accountManagerId = user.id;

    const where = {
      inventoryAppliedAt: { [Op.ne]: null, [Op.between]: [from, to] },
    };
    if (accountManagerId) where.accountManagerId = accountManagerId;

    // 1) Load interviews (fulfilled only)
    const interviews = await Interview.findAll({
      where,
      attributes: [
        'id',
        'courierName',
        'phoneNumber',
        'vehicleType',
        'courierStatus',
        'accountManagerId',
        'inventoryAppliedAt',
        'inventoryPendingRequestId',
        'inventoryPendingRequestItemId',
      ],
      order: [['inventoryAppliedAt', 'ASC'], ['id', 'ASC']],
      raw: true,
    });

    if (!interviews.length) {
      return res.json({
        range: { from: toDateOnlyString(from), to: toDateOnlyString(to) },
        totals: { fulfilled: 0, companyA: 0, companyB: 0 },
        rows: [],
      });
    }

    // Collect ids
    const managerIds = new Set();
    const prIds = new Set();
    const itemIds = new Set();

    for (const it of interviews) {
      if (it.accountManagerId) managerIds.add(it.accountManagerId);
      if (it.inventoryPendingRequestId) prIds.add(it.inventoryPendingRequestId);
      if (it.inventoryPendingRequestItemId) itemIds.add(it.inventoryPendingRequestItemId);
    }

    // 2) Load managers
    const managers = managerIds.size
      ? await Auth.findAll({
          where: { id: { [Op.in]: Array.from(managerIds) } },
          attributes: ['id', 'fullName', 'email', 'role', 'position', 'isActive'],
          raw: true,
        })
      : [];
    const managerMap = new Map(managers.map((m) => [m.id, m]));

    // 3) Load pending requests
    const pendingRequests = prIds.size
      ? await PendingRequest.findAll({
          where: { id: { [Op.in]: Array.from(prIds) } },
          attributes: [
            'id',
            'requestDate',
            'status',
            'priority',
            'billingMonth',
            'clientId',
            'hubId',
            'zoneId',
          ],
          raw: true,
        })
      : [];
    const prMap = new Map(pendingRequests.map((p) => [p.id, p]));

    // 4) Load client/hub/zone names (+ client.company)
    const clientIds = new Set();
    const hubIds = new Set();
    const zoneIds = new Set();

    for (const pr of pendingRequests) {
      if (pr.clientId) clientIds.add(pr.clientId);
      if (pr.hubId) hubIds.add(pr.hubId);
      if (pr.zoneId) zoneIds.add(pr.zoneId);
    }

    const [clients, hubs, zones] = await Promise.all([
      clientIds.size
        ? Client.findAll({
            where: { id: { [Op.in]: Array.from(clientIds) } },
            attributes: ['id', 'name', 'company'],
            raw: true,
          })
        : Promise.resolve([]),
      hubIds.size
        ? Hub.findAll({
            where: { id: { [Op.in]: Array.from(hubIds) } },
            attributes: ['id', 'name'],
            raw: true,
          })
        : Promise.resolve([]),
      zoneIds.size
        ? Zone.findAll({
            where: { id: { [Op.in]: Array.from(zoneIds) } },
            attributes: ['id', 'name'],
            raw: true,
          })
        : Promise.resolve([]),
    ]);

    const clientMap = new Map(clients.map((x) => [x.id, x]));
    const hubMap = new Map(hubs.map((x) => [x.id, x]));
    const zoneMap = new Map(zones.map((x) => [x.id, x]));

    // 5) Load items (remaining count)
    const items = itemIds.size
      ? await PendingRequestItem.findAll({
          where: { id: { [Op.in]: Array.from(itemIds) } },
          attributes: ['id', 'pendingRequestId', 'vehicleType', 'vehicleCount'],
          raw: true,
        })
      : [];
    const itemMap = new Map(items.map((x) => [x.id, x]));

    // Grouping: manager -> week -> request bucket
    const agg = new Map();

    function getManagerBucket(mId) {
      const key = mId ? String(mId) : 'unassigned';
      if (!agg.has(key)) {
        const m = mId ? managerMap.get(mId) : null;
        agg.set(key, {
          accountManager: m
            ? {
                id: m.id,
                fullName: m.fullName,
                email: m.email,
                role: m.role,
                position: m.position,
                isActive: m.isActive,
              }
            : {
                id: null,
                fullName: 'Unassigned',
                email: null,
                role: null,
                position: null,
                isActive: null,
              },
          totals: { fulfilled: 0, companyA: 0, companyB: 0 },
          weeks: new Map(),
        });
      }
      return agg.get(key);
    }

    function getWeekBucket(mb, weekStart, weekEnd) {
      if (!mb.weeks.has(weekStart)) {
        mb.weeks.set(weekStart, {
          weekStart,
          weekEnd,
          totals: { fulfilled: 0, companyA: 0, companyB: 0 },
          requests: new Map(),
        });
      }
      return mb.weeks.get(weekStart);
    }

    function bucketKey(prId, itemId) {
      return `${prId || 'null'}:${itemId || 'null'}`;
    }

    for (const it of interviews) {
      const mb = getManagerBucket(it.accountManagerId || null);

      const appliedAt = new Date(it.inventoryAppliedAt);
      const ws = startOfISOWeek(appliedAt);
      const weekStart = toDateOnlyString(ws);
      const weekEnd = toDateOnlyString(addDays(ws, 6));
      const wb = getWeekBucket(mb, weekStart, weekEnd);

      // company bucket
      const prId = it.inventoryPendingRequestId || null;
      const pr = prId ? prMap.get(prId) : null;
      const comp =
        pr?.clientId != null ? normalizeCompanyBucket(clientMap.get(pr.clientId)?.company) : null;

      mb.totals.fulfilled += 1;
      wb.totals.fulfilled += 1;

      if (comp === 'A') {
        mb.totals.companyA += 1;
        wb.totals.companyA += 1;
      } else if (comp === 'B') {
        mb.totals.companyB += 1;
        wb.totals.companyB += 1;
      }

      const itemId = it.inventoryPendingRequestItemId || null;
      const k = bucketKey(prId, itemId);

      if (!wb.requests.has(k)) {
        const item = itemId ? itemMap.get(itemId) : null;

        const clientObj =
          pr?.clientId != null
            ? {
                id: pr.clientId,
                name: clientMap.get(pr.clientId)?.name || null,
                company: clientMap.get(pr.clientId)?.company ?? null,
              }
            : null;

        const hubObj =
          pr?.hubId != null
            ? { id: pr.hubId, name: hubMap.get(pr.hubId)?.name || null }
            : null;

        const zoneObj =
          pr?.zoneId != null
            ? { id: pr.zoneId, name: zoneMap.get(pr.zoneId)?.name || null }
            : null;

        wb.requests.set(k, {
          pendingRequestId: prId,
          pendingRequestItemId: itemId,

          request: pr
            ? {
                id: pr.id,
                requestDate: pr.requestDate,
                status: pr.status,
                priority: pr.priority,
                billingMonth: pr.billingMonth,
                client: clientObj,
                hub: hubObj,
                zone: zoneObj,
              }
            : null,

          item: item
            ? {
                id: item.id,
                vehicleType: item.vehicleType,
                remainingVehicleCount: Number(item.vehicleCount || 0),
              }
            : null,

          fulfilled: 0,
          // optional details (careful: can be large)
          details: [],
        });
      }

      const b = wb.requests.get(k);
      b.fulfilled += 1;

      if (includeDetails && b.details.length < detailsLimit) {
        b.details.push({
          interviewId: it.id,
          courierName: it.courierName,
          phoneNumber: it.phoneNumber,
          vehicleType: it.vehicleType,
          courierStatus: it.courierStatus,
          inventoryAppliedAt: it.inventoryAppliedAt,
        });
      }
    }

    // Build output
    const rows = [];
    let grandTotal = 0;
    let grandA = 0;
    let grandB = 0;

    for (const [, mb] of agg) {
      grandTotal += mb.totals.fulfilled;
      grandA += mb.totals.companyA;
      grandB += mb.totals.companyB;

      const weeks = Array.from(mb.weeks.values())
        .map((w) => ({
          weekStart: w.weekStart,
          weekEnd: w.weekEnd,
          totals: w.totals,
          requests: Array.from(w.requests.values()).sort(
            (a, b) => (b.fulfilled || 0) - (a.fulfilled || 0)
          ),
        }))
        .sort((a, b) => (a.weekStart > b.weekStart ? 1 : -1));

      rows.push({
        accountManager: mb.accountManager,
        totals: mb.totals,
        weeks,
      });
    }

    rows.sort((a, b) => (b.totals.fulfilled || 0) - (a.totals.fulfilled || 0));

    return res.json({
      range: { from: toDateOnlyString(from), to: toDateOnlyString(to) },
      totals: { fulfilled: grandTotal, companyA: grandA, companyB: grandB },
      rows,
    });
  } catch (e) {
    console.error('getAccountManagersFulfillmentReport error:', e);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
