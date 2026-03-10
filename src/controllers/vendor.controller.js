// src/controllers/vendor.controller.js
const { Op } = require('sequelize');
const { sequelize, Vendor } = require('../models');

/* =========================
   Helpers
   ========================= */

function normalizeBool(v) {
  if (v === true || v === false) return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return undefined;
}

function formatVendorCode(n) {
  // VND-001, VND-012, VND-123
  return `VND-${String(n).padStart(3, '0')}`;
}

async function generateNextVendorCode(t) {
  // Prefer locking to reduce race conditions
  const last = await Vendor.findOne({
    attributes: ['code', 'id'],
    where: { code: { [Op.like]: 'VND-%' } },
    order: [['id', 'DESC']],
    transaction: t,
    lock: t.LOCK.UPDATE,
  });

  let nextNumber = 1;

  if (last?.code) {
    const m = String(last.code).match(/^VND-(\d+)$/);
    if (m) nextNumber = Number(m[1]) + 1;
  }

  return formatVendorCode(nextNumber);
}

/* =========================
   GET /api/vendors
   query: q, isActive
   ========================= */
exports.getAllVendors = async (req, res) => {
  try {
    const { q } = req.query;
    const isActive = normalizeBool(req.query.isActive);

    const where = {};

    if (q) {
      const term = String(q).trim();
      const like = { [Op.like]: `%${term}%` };
      where[Op.or] = [{ name: like }, { code: like }, { mobile: like }, { email: like }];
    }

    if (typeof isActive === 'boolean') where.isActive = isActive;

    const vendors = await Vendor.findAll({
      where,
      order: [['id', 'DESC']],
    });

    return res.json(vendors);
  } catch (error) {
    console.error('getAllVendors error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/* =========================
   GET /api/vendors/:id
   ========================= */
exports.getVendorById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id parameter' });

    const vendor = await Vendor.findByPk(id);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    return res.json(vendor);
  } catch (error) {
    console.error('getVendorById error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/* =========================
   POST /api/vendors
   body: name, mobile, email?, isActive?
   code is auto-generated.
   ========================= */
exports.createVendor = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const audit = req.makeAudit?.({
      summary: 'Vendor created',
      meta: { controller: 'Vendor', op: 'CREATE' },
    });

    const { name, mobile, email, isActive } = req.body || {};

    if (!name || !String(name).trim() || !mobile || !String(mobile).trim()) {
      await t.rollback();
      return res.status(400).json({ message: 'name and mobile are required' });
    }

    const finalIsActive = typeof isActive === 'boolean' ? isActive : true;

    // ✅ Auto code
    let code = await generateNextVendorCode(t);

    // ✅ retry on unique collision (rare)
    for (let i = 0; i < 3; i++) {
      try {
        const vendor = await Vendor.create(
          {
            name: String(name).trim(),
            mobile: String(mobile).trim(),
            email: email ? String(email).trim() : null,
            isActive: finalIsActive,
            code,
          },
          { transaction: t, audit }
        );

        await t.commit();
        return res.status(201).json(vendor);
      } catch (e) {
        if (e?.name === 'SequelizeUniqueConstraintError') {
          code = await generateNextVendorCode(t);
          continue;
        }
        throw e;
      }
    }

    await t.rollback();
    return res.status(409).json({ message: 'Failed to generate unique vendor code. Try again.' });
  } catch (error) {
    if (t && !t.finished) {
      try { await t.rollback(); } catch (_) {}
    }
    console.error('createVendor error:', error);
    return res.status(500).json({ message: error?.message || 'Internal server error' });
  }
};

/* =========================
   PUT /api/vendors/:id
   body: name?, mobile?, email?, isActive?
   code is NOT editable.
   ========================= */
exports.updateVendor = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const vendor = await Vendor.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!vendor) {
      await t.rollback();
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const fields = ['name', 'mobile', 'email', 'isActive'];
    const changedFields = fields.filter((f) => Object.prototype.hasOwnProperty.call(req.body, f));

    const audit = req.makeAudit?.({
      summary: changedFields.length ? `Vendor updated: ${changedFields.join(', ')}` : 'Vendor updated',
      meta: { controller: 'Vendor', op: 'UPDATE', changedFields },
    });

    if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
      const v = req.body.name;
      if (!v || !String(v).trim()) {
        await t.rollback();
        return res.status(400).json({ message: 'name cannot be empty' });
      }
      vendor.name = String(v).trim();
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'mobile')) {
      const v = req.body.mobile;
      if (!v || !String(v).trim()) {
        await t.rollback();
        return res.status(400).json({ message: 'mobile cannot be empty' });
      }
      vendor.mobile = String(v).trim();
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'email')) {
      const v = req.body.email;
      vendor.email = v ? String(v).trim() : null;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'isActive')) {
      vendor.isActive = !!req.body.isActive;
    }

    await vendor.save({ transaction: t, audit, fields: changedFields });

    await t.commit();
    const fresh = await Vendor.findByPk(id);
    return res.json(fresh);
  } catch (error) {
    if (t && !t.finished) {
      try { await t.rollback(); } catch (_) {}
    }
    console.error('updateVendor error:', error);
    return res.status(500).json({ message: error?.message || 'Internal server error' });
  }
};

/* =========================
   DELETE /api/vendors/:id
   ========================= */
exports.deleteVendor = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const vendor = await Vendor.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!vendor) {
      await t.rollback();
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const audit = req.makeAudit?.({
      summary: `Vendor deleted (${vendor.name || 'Unnamed'})`,
      meta: { controller: 'Vendor', op: 'DELETE' },
    });

    await vendor.destroy({ transaction: t, audit });

    await t.commit();
    return res.json({ message: 'Vendor deleted' });
  } catch (error) {
    if (t && !t.finished) {
      try { await t.rollback(); } catch (_) {}
    }
    console.error('deleteVendor error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};