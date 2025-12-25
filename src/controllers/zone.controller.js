// src/controllers/zone.controller.js
const { Op, where, fn, col } = require('sequelize');
const { Zone, Hub } = require('../models');

function normalizeName(s) {
  return String(s || '').trim().replace(/\s+/g, ' ');
}

function parsePositiveInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// GET /api/zones?hubId=...
exports.getZones = async (req, res) => {
  try {
    const hubId = parsePositiveInt(req.query.hubId);
    const whereClause = {};

    if (hubId) whereClause.hubId = hubId;

    const zones = await Zone.findAll({
      where: whereClause,
      order: [['name', 'ASC']],
      include: [{ model: Hub, as: 'hub', attributes: ['id', 'name'] }],
    });

    return res.json(zones);
  } catch (error) {
    console.error('getZones error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/zones
// body: { name, hubId }
exports.createZone = async (req, res) => {
  const t = await Zone.sequelize.transaction();
  try {
    const name = normalizeName(req.body?.name);
    const hubId = parsePositiveInt(req.body?.hubId);

    if (!name || !hubId) {
      await t.rollback();
      return res.status(400).json({ message: 'name and hubId are required' });
    }

    // اتأكد إن الـ Hub موجود (اختياري لكن أفضل)
    const hubExists = await Hub.findByPk(hubId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!hubExists) {
      await t.rollback();
      return res.status(404).json({ message: 'Hub not found' });
    }

    // ابحث case-insensitive
    const existing = await Zone.findOne({
      where: {
        hubId,
        [Op.and]: [where(fn('lower', col('name')), name.toLowerCase())],
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (existing) {
      await t.commit();
      return res.status(200).json(existing);
    }

    const zone = await Zone.create({ name, hubId }, { transaction: t });
    await t.commit();
    return res.status(201).json(zone);
  } catch (error) {
    await t.rollback();

    if (error?.name === 'SequelizeUniqueConstraintError') {
      try {
        const name = normalizeName(req.body?.name);
        const hubId = parsePositiveInt(req.body?.hubId);

        const existing = await Zone.findOne({
          where: {
            hubId,
            [Op.and]: [where(fn('lower', col('name')), name.toLowerCase())],
          },
        });

        if (existing) return res.status(200).json(existing);
      } catch (e) {
        console.error('createZone unique fallback failed:', e);
      }
      return res.status(409).json({ message: 'Zone already exists' });
    }

    console.error('createZone error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
