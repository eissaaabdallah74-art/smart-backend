// src/controllers/pending-request.controller.js
const { Op } = require('sequelize');

const {
  PendingRequest,
  PendingRequestItem,
  Client,
  Hub,
  Zone,
  sequelize,
} = require('../models');

// ===== Helpers =====
function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isNaN(n) ? null : n;
}

const ALLOWED_PRIORITY = new Set(['low', 'medium', 'high', 'urgent']);
function normalizePriority(value) {
  const v = (value ?? '').toString().trim();
  if (!v) return 'medium';
  return ALLOWED_PRIORITY.has(v) ? v : null;
}

function normalizeStatus(value) {
  const v = (value ?? '').toString().trim();
  const allowed = new Set(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']);
  if (!v) return null;
  return allowed.has(v) ? v : null;
}

function buildItemsPayload(items) {
  if (!Array.isArray(items) || items.length === 0) return { error: 'At least one item is required' };

  const rows = items
    .filter(Boolean)
    .map((raw) => {
      const vehicleType = raw.vehicleType;
      if (!vehicleType) return null;

      const vehicleCount = toNumberOrNull(raw.vehicleCount) || 1;

      return {
        vehicleType,
        vehicleCount: Math.max(1, vehicleCount),

        orderPrice: toNumberOrNull(raw.orderPrice),
        guaranteeMinOrders: toNumberOrNull(raw.guaranteeMinOrders),
        fixedAmount: toNumberOrNull(raw.fixedAmount),
        allowanceAmount: toNumberOrNull(raw.allowanceAmount),
        totalAmount: toNumberOrNull(raw.totalAmount),
      };
    })
    .filter(Boolean);

  if (!rows.length) return { error: 'Invalid items payload' };
  return { rows };
}

function baseIncludes() {
  return [
    { model: Client, as: 'client', attributes: ['id', 'name'], required: false },
    { model: Hub, as: 'hub', attributes: ['id', 'name'], required: false },
    { model: Zone, as: 'zone', attributes: ['id', 'name'], required: false },
    { model: PendingRequestItem, as: 'items', required: false },
  ];
}

// ===== GET /api/pending-requests?clientId=&hubId=&zoneId=&status=&priority=&q= =====
exports.getPendingRequests = async (req, res) => {
  try {
    const { clientId, hubId, zoneId, status, priority, q } = req.query;
    const where = {};

    if (clientId) where.clientId = Number(clientId);
    if (hubId) where.hubId = Number(hubId);
    if (zoneId) where.zoneId = Number(zoneId);

    const st = normalizeStatus(status);
    if (status && !st) return res.status(400).json({ message: 'Invalid status' });
    if (st) where.status = st;

    const pr = normalizePriority(priority);
    if (priority && !pr) return res.status(400).json({ message: 'Invalid priority' });
    if (priority) where.priority = pr;

    // Search: billingMonth / notes / client name
    if (q && q.trim()) {
      const like = { [Op.like]: `%${q.trim()}%` };
      where[Op.or] = [
        { billingMonth: like },
        { notes: like },
        { '$client.name$': like },
      ];
    }

    const rows = await PendingRequest.findAll({
      where,
      include: baseIncludes(),
      order: [['id', 'DESC']],
      subQuery: false,
    });

    return res.json(rows);
  } catch (error) {
    console.error('getPendingRequests error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ===== GET /api/pending-requests/:id =====
exports.getPendingRequestById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id parameter' });

    const row = await PendingRequest.findByPk(id, {
      include: baseIncludes(),
    });

    if (!row) return res.status(404).json({ message: 'Pending request not found' });
    return res.json(row);
  } catch (error) {
    console.error('getPendingRequestById error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ===== POST /api/pending-requests =====
// body: { clientId, hubId?, zoneId?, requestDate, billingMonth?, status?, priority?, notes?, items:[...] }
exports.createPendingRequest = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      clientId,
      hubId,
      zoneId,
      requestDate,
      billingMonth,
      status,
      priority,
      notes,
      createdBy, // لو عندك auth: الأفضل تاخده من req.user.id
      items,
    } = req.body;

    if (!clientId || !requestDate) {
      await t.rollback();
      return res.status(400).json({ message: 'clientId and requestDate are required' });
    }

    const st = normalizeStatus(status) || 'PENDING';
    const pr = normalizePriority(priority);
    if (!pr) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid priority' });
    }

    const { rows: itemRows, error: itemsError } = buildItemsPayload(items);
    if (itemsError) {
      await t.rollback();
      return res.status(400).json({ message: itemsError });
    }

    const header = await PendingRequest.create(
      {
        clientId: Number(clientId),
        hubId: hubId ? Number(hubId) : null,
        zoneId: zoneId ? Number(zoneId) : null,
        requestDate,
        billingMonth: billingMonth || null,
        status: st,
        priority: pr,
        notes: notes || null,
        createdBy: (req.user && req.user.id) ? req.user.id : (createdBy || null),
      },
      { transaction: t }
    );

    await PendingRequestItem.bulkCreate(
      itemRows.map((it) => ({
        ...it,
        pendingRequestId: header.id,
      })),
      { transaction: t }
    );

    await t.commit();

    const fullRow = await PendingRequest.findByPk(header.id, {
      include: baseIncludes(),
    });

    return res.status(201).json(fullRow);
  } catch (error) {
    await t.rollback();
    console.error('createPendingRequest error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ===== PUT /api/pending-requests/:id =====
// body: header fields + items (لو موجودة => replace all)
exports.updatePendingRequest = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const row = await PendingRequest.findByPk(id, { transaction: t });
    if (!row) {
      await t.rollback();
      return res.status(404).json({ message: 'Pending request not found' });
    }

    const {
      clientId,
      hubId,
      zoneId,
      requestDate,
      billingMonth,
      status,
      priority,
      notes,
      updatedBy, // لو عندك auth: الأفضل تاخده من req.user.id
      items,
    } = req.body;

    if (typeof clientId !== 'undefined') row.clientId = Number(clientId);
    if (typeof hubId !== 'undefined') row.hubId = hubId ? Number(hubId) : null;
    if (typeof zoneId !== 'undefined') row.zoneId = zoneId ? Number(zoneId) : null;
    if (typeof requestDate !== 'undefined') row.requestDate = requestDate;
    if (typeof billingMonth !== 'undefined') row.billingMonth = billingMonth || null;

    if (typeof status !== 'undefined') {
      const st = normalizeStatus(status);
      if (!st) {
        await t.rollback();
        return res.status(400).json({ message: 'Invalid status' });
      }
      row.status = st;
    }

    if (typeof priority !== 'undefined') {
      const pr = normalizePriority(priority);
      if (!pr) {
        await t.rollback();
        return res.status(400).json({ message: 'Invalid priority' });
      }
      row.priority = pr;
    }

    if (typeof notes !== 'undefined') row.notes = notes || null;

    if (typeof updatedBy !== 'undefined') {
      row.updatedBy = (req.user && req.user.id) ? req.user.id : (updatedBy || null);
    } else {
      // حتى لو مش باعت updatedBy، ممكن تسجلها تلقائي لو عندك user
      if (req.user && req.user.id) row.updatedBy = req.user.id;
    }

    await row.save({ transaction: t });

    // items replace all
    if (Array.isArray(items)) {
      const { rows: itemRows, error: itemsError } = buildItemsPayload(items);
      if (itemsError) {
        await t.rollback();
        return res.status(400).json({ message: itemsError });
      }

      await PendingRequestItem.destroy({
        where: { pendingRequestId: row.id },
        transaction: t,
      });

      await PendingRequestItem.bulkCreate(
        itemRows.map((it) => ({
          ...it,
          pendingRequestId: row.id,
        })),
        { transaction: t }
      );
    }

    await t.commit();

    const fullRow = await PendingRequest.findByPk(row.id, {
      include: baseIncludes(),
    });

    return res.json(fullRow);
  } catch (error) {
    await t.rollback();
    console.error('updatePendingRequest error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ===== DELETE /api/pending-requests/:id =====
exports.deletePendingRequest = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const row = await PendingRequest.findByPk(id, { transaction: t });
    if (!row) {
      await t.rollback();
      return res.status(404).json({ message: 'Pending request not found' });
    }

    await PendingRequestItem.destroy({
      where: { pendingRequestId: row.id },
      transaction: t,
    });

    await row.destroy({ transaction: t });

    await t.commit();
    return res.json({ message: 'Pending request deleted successfully' });
  } catch (error) {
    await t.rollback();
    console.error('deletePendingRequest error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};


// ===== POST /api/pending-requests/bulk-import =====
// body: { requests: [ { clientId, hubId?, zoneId?, requestDate, billingMonth?, status?, priority?, notes?, items:[...] } ] }
exports.bulkImportPendingRequests = async (req, res) => {
  try {
    const requests = Array.isArray(req.body?.requests) ? req.body.requests : null;
    if (!requests || !requests.length) {
      return res.status(400).json({ message: 'requests array is required' });
    }

    const results = {
      total: requests.length,
      createdCount: 0,
      failedCount: 0,
      errors: [], // { index, message }
    };

    // نعمل transaction لكل request لوحده عشان لو واحدة وقعت ما تبوظش الباقي
    for (let i = 0; i < requests.length; i++) {
      const dto = requests[i];

      const t = await sequelize.transaction();
      try {
        const {
          clientId,
          hubId,
          zoneId,
          requestDate,
          billingMonth,
          status,
          priority,
          notes,
          createdBy,
          items,
        } = dto || {};

        if (!clientId || !requestDate) {
          await t.rollback();
          results.failedCount++;
          results.errors.push({ index: i, message: 'clientId and requestDate are required' });
          continue;
        }

        const st = normalizeStatus(status) || 'PENDING';
        const pr = normalizePriority(priority);
        if (!pr) {
          await t.rollback();
          results.failedCount++;
          results.errors.push({ index: i, message: 'Invalid priority' });
          continue;
        }

        const { rows: itemRows, error: itemsError } = buildItemsPayload(items);
        if (itemsError) {
          await t.rollback();
          results.failedCount++;
          results.errors.push({ index: i, message: itemsError });
          continue;
        }

        const header = await PendingRequest.create(
          {
            clientId: Number(clientId),
            hubId: hubId ? Number(hubId) : null,
            zoneId: zoneId ? Number(zoneId) : null,
            requestDate,
            billingMonth: billingMonth || null,
            status: st,
            priority: pr,
            notes: notes || null,
            createdBy: (req.user && req.user.id) ? req.user.id : (createdBy || null),
          },
          { transaction: t }
        );

        await PendingRequestItem.bulkCreate(
          itemRows.map((it) => ({
            ...it,
            pendingRequestId: header.id,
          })),
          { transaction: t }
        );

        await t.commit();
        results.createdCount++;
      } catch (e) {
        await t.rollback();
        results.failedCount++;
        results.errors.push({ index: i, message: e?.message || 'Unknown error' });
      }
    }

    return res.status(200).json(results);
  } catch (error) {
    console.error('bulkImportPendingRequests error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
