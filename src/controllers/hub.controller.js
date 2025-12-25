// src/controllers/hub.controller.js
const { Op, where, fn, col } = require('sequelize');
const { Hub, Client, Zone } = require('../models');

function normalizeName(s) {
  return String(s || '').trim().replace(/\s+/g, ' ');
}

function parsePositiveInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// GET /api/hubs?clientId=...&includeZones=1
exports.getHubs = async (req, res) => {
  try {
    const clientId = parsePositiveInt(req.query.clientId);
    const includeZones =
      String(req.query.includeZones || '').trim() === '1' ||
      String(req.query.includeZones || '').toLowerCase() === 'true';

    const whereClause = {};
    if (clientId) whereClause.clientId = clientId;

    const include = [
      { model: Client, as: 'client', attributes: ['id', 'name'] },
    ];

    if (includeZones) {
      include.push({
        model: Zone,
        as: 'zones',
        attributes: ['id', 'name', 'hubId'],
        required: false,
      });
    }

    const order = [['name', 'ASC']];
    if (includeZones) {
      order.push([{ model: Zone, as: 'zones' }, 'name', 'ASC']);
    }

    const hubs = await Hub.findAll({
      where: whereClause,
      include,
      order,
    });

    return res.json(hubs);
  } catch (error) {
    console.error('getHubs error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/hubs
// body: { name, clientId }
exports.createHub = async (req, res) => {
  const t = await Hub.sequelize.transaction();
  try {
    const name = normalizeName(req.body?.name);
    const clientId = parsePositiveInt(req.body?.clientId);

    if (!name || !clientId) {
      await t.rollback();
      return res.status(400).json({ message: 'name and clientId are required' });
    }

    // ابحث case-insensitive (مهم لـ SQLite)
    const existing = await Hub.findOne({
      where: {
        clientId,
        [Op.and]: [where(fn('lower', col('name')), name.toLowerCase())],
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (existing) {
      await t.commit();
      return res.status(200).json(existing);
    }

    const hub = await Hub.create({ name, clientId }, { transaction: t });
    await t.commit();
    return res.status(201).json(hub);
  } catch (error) {
    await t.rollback();

    // لو unique منع التكرار (مثلاً requestين في نفس اللحظة)
    if (error?.name === 'SequelizeUniqueConstraintError') {
      try {
        const name = normalizeName(req.body?.name);
        const clientId = parsePositiveInt(req.body?.clientId);

        const existing = await Hub.findOne({
          where: {
            clientId,
            [Op.and]: [where(fn('lower', col('name')), name.toLowerCase())],
          },
        });

        if (existing) return res.status(200).json(existing);
      } catch (e) {
        console.error('createHub unique fallback failed:', e);
      }
      return res.status(409).json({ message: 'Hub already exists' });
    }

    console.error('createHub error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
