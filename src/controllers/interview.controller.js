// src/controllers/interview.controller.js
const { Op } = require('sequelize');
const {
  sequelize,
  Interview,
  Client,
  Hub,
  Zone,
  Auth,
  PendingRequest,
  PendingRequestItem,
} = require('../models');

const {
  upsertDriverFromInterviewId,
} = require('../services/driver-sync.service');

const INTERVIEW_INCLUDES = [
  { model: Client, as: 'client', attributes: ['id', 'name'] },
  { model: Hub, as: 'hub', attributes: ['id', 'name'] },
  { model: Zone, as: 'zone', attributes: ['id', 'name'] },
  { model: Auth, as: 'accountManager', attributes: ['id', 'fullName'] },
  { model: Auth, as: 'interviewer', attributes: ['id', 'fullName'] },
];

// ===== Vehicle Types (same as PendingRequestItem ENUM) =====
const VEHICLE_TYPES = [
  'SEDAN',
  'VAN',
  'BIKE',
  'DABABA',
  'NKR',
  'TRICYCLE',
  'JUMBO_4',
  'JUMBO_6',
  'HELPER',
  'DRIVER',
  'WORKER',
];
const VEHICLE_TYPES_SET = new Set(VEHICLE_TYPES);

// ===== Priority ordering (pending_requests.priority) =====
const PRIORITY_ORDER_SQL =
  "CASE " +
  "WHEN priority='urgent' THEN 0 " +
  "WHEN priority='high' THEN 1 " +
  "WHEN priority='medium' THEN 2 " +
  "WHEN priority='low' THEN 3 " +
  "ELSE 9 END";

// ===== helpers =====

async function generateUniqueTicketNo(clientId) {
  const client = await Client.findByPk(clientId);
  const rawName = client?.name || 'ACC';

  const clean = rawName.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const prefix = (clean.slice(0, 3) || 'ACC').padEnd(3, 'X');

  for (let i = 0; i < 10; i++) {
    const random = Math.floor(1000 + Math.random() * 9000);
    const candidate = `${prefix}-${random}`;

    const exists = await Interview.count({ where: { ticketNo: candidate } });
    if (!exists) return candidate;
  }

  return `${prefix}-${Date.now().toString().slice(-4)}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isCourierActive(v) {
  return (v || '').toString().trim().toLowerCase() === 'active';
}

function normalizeVehicleType(v) {
  if (v === null || v === undefined || v === '') return null;
  const x = String(v).trim().toUpperCase();
  return VEHICLE_TYPES_SET.has(x) ? x : null;
}

/**
 * ✅ Idempotent inventory allocation (decrement) for an Interview
 */
async function applyPendingRequestDecrementForInterview(interview, t) {
  if (interview.inventoryAppliedAt) {
    return {
      applied: false,
      alreadyApplied: true,
      inventoryAppliedAt: interview.inventoryAppliedAt,
      pendingRequestId: interview.inventoryPendingRequestId || null,
      pendingRequestItemId: interview.inventoryPendingRequestItemId || null,
    };
  }

  const vt = normalizeVehicleType(interview.vehicleType);
  if (!vt) {
    const err = new Error(
      'vehicleType must be one of: ' + VEHICLE_TYPES.join(' | ')
    );
    err.statusCode = 400;
    throw err;
  }

  if (!interview.clientId) {
    const err = new Error('clientId is required to apply pending request action');
    err.statusCode = 400;
    throw err;
  }
  if (!interview.hubId) {
    const err = new Error('hubId is required to apply pending request action');
    err.statusCode = 400;
    throw err;
  }
  if (!interview.zoneId) {
    const err = new Error('zoneId is required to apply pending request action');
    err.statusCode = 400;
    throw err;
  }

  const headerWhere = {
    clientId: interview.clientId,
    hubId: interview.hubId,
    zoneId: interview.zoneId,
    status: { [Op.in]: ['APPROVED', 'PENDING'] },
  };

  const header = await PendingRequest.findOne({
    where: headerWhere,
    transaction: t,
    lock: t.LOCK.UPDATE,
    order: [
      [
        sequelize.literal(
          "CASE WHEN status='APPROVED' THEN 0 WHEN status='PENDING' THEN 1 ELSE 2 END"
        ),
        'ASC',
      ],
      [sequelize.literal(PRIORITY_ORDER_SQL), 'ASC'],
      ['requestDate', 'ASC'],
      ['id', 'ASC'],
    ],
  });

  if (!header) {
    const err = new Error(
      'No PendingRequest found for this client/hub/zone with status APPROVED/PENDING'
    );
    err.statusCode = 404;
    throw err;
  }

  const item = await PendingRequestItem.findOne({
    where: {
      pendingRequestId: header.id,
      vehicleType: vt,
    },
    transaction: t,
    lock: t.LOCK.UPDATE,
  });

  if (!item) {
    const err = new Error(
      `No PendingRequestItem found for vehicleType=${vt} under pendingRequestId=${header.id}`
    );
    err.statusCode = 404;
    throw err;
  }

  const current = Number(item.vehicleCount || 0);
  if (current <= 0) {
    const err = new Error(
      `No remaining capacity for vehicleType=${vt} under pendingRequestId=${header.id}`
    );
    err.statusCode = 409;
    throw err;
  }

  const next = current - 1;
  item.vehicleCount = next;
  await item.save({ transaction: t });

  interview.inventoryAppliedAt = new Date();
  interview.inventoryPendingRequestId = header.id;
  interview.inventoryPendingRequestItemId = item.id;
  await interview.save({ transaction: t });

  return {
    applied: true,
    pendingRequestId: header.id,
    pendingRequestItemId: item.id,
    vehicleType: vt,
    before: current,
    after: next,
    inventoryAppliedAt: interview.inventoryAppliedAt,
  };
}

// GET /api/interviews
exports.getAllInterviews = async (req, res) => {
  try {
    const { q, clientId, hubId, zoneId, status } = req.query;
    const where = {};

    if (q) {
      const like = { [Op.like]: `%${q}%` };
      where[Op.or] = [
        { courierName: like },
        { phoneNumber: like },
        { nationalId: like },
        { residence: like },
      ];
    }
    if (clientId) where.clientId = Number(clientId);
    if (hubId) where.hubId = Number(hubId);
    if (zoneId) where.zoneId = Number(zoneId);
    if (status) where.courierStatus = status;

    const interviews = await Interview.findAll({
      where,
      order: [['id', 'DESC']],
      include: INTERVIEW_INCLUDES,
    });

    return res.json(interviews);
  } catch (error) {
    console.error('getAllInterviews error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/interviews/:id
exports.getInterviewById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const interview = await Interview.findByPk(id, {
      include: INTERVIEW_INCLUDES,
    });
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    return res.json(interview);
  } catch (error) {
    console.error('getInterviewById error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/interviews
exports.createInterview = async (req, res) => {
  const t = await sequelize.transaction();
  let newInterviewId = null;
  let inventoryAction = null;

  try {
    const {
      date,
      ticketNo,
      ticketExpiresAt,

      courierName,
      phoneNumber,
      nationalId,
      residence,
      clientId,
      hubId,
      zoneId,
      position,
      vehicleType,
      accountManagerId,
      interviewerId,
      signedWithHr,
      feedback,
      hrFeedback,
      crmFeedback,
      followUp1,
      followUp2,
      followUp3,
      courierStatus,
      securityResult,
      notes,
    } = req.body;

    if (!courierName || !phoneNumber || !clientId) {
      throw Object.assign(
        new Error('courierName, phoneNumber and clientId are required'),
        { statusCode: 400 }
      );
    }

    const normalizedVehicleType =
      typeof vehicleType === 'undefined' ? null : normalizeVehicleType(vehicleType);

    if (vehicleType && !normalizedVehicleType) {
      throw Object.assign(
        new Error('Invalid vehicleType. Must match PendingRequestItem ENUM.'),
        { statusCode: 400 }
      );
    }

    let interviewDate = date || new Date();

    let finalTicketNo = ticketNo || null;
    let finalTicketExpiresAt = ticketExpiresAt || null;

    const hrSigned =
      (hrFeedback || '').toString().toLowerCase().includes('signed');

    if (hrSigned && !finalTicketNo) {
      finalTicketNo = await generateUniqueTicketNo(clientId);
      finalTicketExpiresAt = addDays(new Date(), 14);
    }

    const newInterview = await Interview.create(
      {
        date: interviewDate,
        ticketNo: finalTicketNo,
        ticketExpiresAt: finalTicketExpiresAt,

        courierName,
        phoneNumber,
        nationalId,
        residence,
        clientId,
        hubId,
        zoneId,
        position,
        vehicleType: normalizedVehicleType,
        accountManagerId,
        interviewerId,
        signedWithHr,
        feedback,
        hrFeedback,
        crmFeedback,
        followUp1,
        followUp2,
        followUp3,
        courierStatus,
        securityResult,
        notes,
      },
      { transaction: t }
    );

    newInterviewId = newInterview.id;

    // ✅ IMPORTANT: sync driver row from interview داخل نفس transaction
    await upsertDriverFromInterviewId(newInterview.id, { transaction: t });

    // ✅ Trigger inventory decrement (best-effort)
    if (isCourierActive(courierStatus)) {
      try {
        inventoryAction = await sequelize.transaction(
          { transaction: t },
          async (tInv) => applyPendingRequestDecrementForInterview(newInterview, tInv)
        );
      } catch (invErr) {
        inventoryAction = {
          applied: false,
          error: invErr.message,
          statusCode: invErr.statusCode || 500,
        };
      }
    }

    await t.commit();
  } catch (error) {
    if (t && !t.finished) {
      try {
        await t.rollback();
      } catch (_) {}
    }

    console.error('createInterview error:', error);
    return res
      .status(error.statusCode || 500)
      .json({ message: error.message || 'Internal server error' });
  }

  // ===== post-commit read =====
  try {
    const fullInterview = await Interview.findByPk(newInterviewId, {
      include: INTERVIEW_INCLUDES,
    });

    const payload = fullInterview?.toJSON ? fullInterview.toJSON() : fullInterview;
    return res.status(201).json({ ...payload, inventoryAction });
  } catch (error) {
    console.error('createInterview post-commit read error:', error);
    return res.status(201).json({ id: newInterviewId, inventoryAction });
  }
};

// PUT /api/interviews/:id
exports.updateInterview = async (req, res) => {
  const t = await sequelize.transaction();
  let inventoryAction = null;

  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const interview = await Interview.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!interview) {
      await t.rollback();
      return res.status(404).json({ message: 'Interview not found' });
    }

    const fields = [
      'date',
      'ticketNo',
      'ticketExpiresAt',
      'courierName',
      'phoneNumber',
      'nationalId',
      'residence',
      'clientId',
      'hubId',
      'zoneId',
      'position',
      'vehicleType',
      'accountManagerId',
      'interviewerId',
      'signedWithHr',
      'feedback',
      'hrFeedback',
      'crmFeedback',
      'followUp1',
      'followUp2',
      'followUp3',
      'courierStatus',
      'securityResult',
      'notes',
    ];

    const wasSigned = (interview.hrFeedback || '')
      .toString()
      .toLowerCase()
      .includes('signed');

    const wasActive = isCourierActive(interview.courierStatus);

    for (const f of fields) {
      if (Object.prototype.hasOwnProperty.call(req.body, f)) {
        if (f === 'vehicleType') {
          const raw = req.body[f];
          const vt = normalizeVehicleType(raw);
          if (raw && !vt) {
            await t.rollback();
            return res.status(400).json({
              message: 'Invalid vehicleType. Must match PendingRequestItem ENUM.',
            });
          }
          interview.vehicleType = vt;
        } else {
          interview[f] = req.body[f];
        }
      }
    }

    const isNowSigned = (interview.hrFeedback || '')
      .toString()
      .toLowerCase()
      .includes('signed');

    if (!wasSigned && isNowSigned && !interview.ticketNo && interview.clientId) {
      interview.ticketNo = await generateUniqueTicketNo(interview.clientId);
      interview.ticketExpiresAt = addDays(new Date(), 14);
    }

    await interview.save({ transaction: t });

    // ✅ IMPORTANT: sync driver row from interview داخل نفس transaction
    await upsertDriverFromInterviewId(interview.id, { transaction: t });

    const isNowActive = isCourierActive(interview.courierStatus);

    if (!wasActive && isNowActive) {
      try {
        inventoryAction = await sequelize.transaction(
          { transaction: t },
          async (tInv) => applyPendingRequestDecrementForInterview(interview, tInv)
        );
      } catch (invErr) {
        inventoryAction = {
          applied: false,
          error: invErr.message,
          statusCode: invErr.statusCode || 500,
        };
      }
    }

    await t.commit();

    const full = await Interview.findByPk(interview.id, {
      include: INTERVIEW_INCLUDES,
    });

    const payload = full?.toJSON ? full.toJSON() : full;
    return res.json({ ...payload, inventoryAction });
  } catch (error) {
    if (t && !t.finished) {
      try {
        await t.rollback();
      } catch (_) {}
    }

    console.error('updateInterview error:', error);
    return res
      .status(error.statusCode || 500)
      .json({ message: error.message || 'Internal server error' });
  }
};

// DELETE /api/interviews/:id
exports.deleteInterview = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const interview = await Interview.findByPk(id);
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    await interview.destroy();
    return res.json({ message: 'Interview deleted' });
  } catch (error) {
    console.error('deleteInterview error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
