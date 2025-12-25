// src/services/interview-inventory.service.js
const { Op, Sequelize } = require('sequelize');
const { PendingRequest, PendingRequestItem } = require('../models');
const { VEHICLE_TYPES_SET } = require('../constants/vehicle-types');

function isCourierActive(v) {
  return (v || '').toString().trim().toLowerCase() === 'active';
}

function normalizeVehicleType(v) {
  if (v === null || v === undefined || v === '') return null;
  const x = String(v).trim().toUpperCase();
  return VEHICLE_TYPES_SET.has(x) ? x : null;
}

/**
 * Apply the action:
 * If interview.courierStatus === 'active' AND interview.inventoryAppliedAt is null:
 *  - find latest pending request for same clientId (+ hubId/zoneId if exist)
 *  - find item with same vehicleType
 *  - decrement vehicleCount by 1 (not below 0)
 *  - mark interview.inventoryAppliedAt + references
 */
async function applyInterviewActivationToPendingRequest(interview, { transaction, sequelize }) {
  if (!transaction) throw new Error('Transaction is required');
  if (!sequelize) throw new Error('sequelize instance is required');

  // Not active => no-op
  if (!isCourierActive(interview.courierStatus)) {
    return { applied: false, reason: 'courier_not_active' };
  }

  // Already applied => no-op
  if (interview.inventoryAppliedAt) {
    return { applied: false, reason: 'already_applied' };
  }

  const vehicleType = normalizeVehicleType(interview.vehicleType);
  if (!vehicleType) {
    const err = new Error('vehicleType is required & must be a valid enum when courierStatus is active');
    err.statusCode = 400;
    throw err;
  }

  // build pending request where
  const headerWhere = {
    clientId: interview.clientId,
    status: { [Op.in]: ['APPROVED', 'PENDING'] },
  };

  if (interview.hubId) headerWhere.hubId = interview.hubId;
  if (interview.zoneId) headerWhere.zoneId = interview.zoneId;

  // Prefer APPROVED then PENDING, newest first
  const header = await PendingRequest.findOne({
    where: headerWhere,
    transaction,
    lock: transaction.LOCK.UPDATE,
    order: [
      [
        sequelize.literal(
          "CASE WHEN status='APPROVED' THEN 0 WHEN status='PENDING' THEN 1 ELSE 2 END"
        ),
        'ASC',
      ],
      ['requestDate', 'DESC'],
      ['id', 'DESC'],
    ],
  });

  if (!header) {
    const err = new Error('No PendingRequest found for this client/hub/zone to deduct from');
    err.statusCode = 404;
    throw err;
  }

  const item = await PendingRequestItem.findOne({
    where: {
      pendingRequestId: header.id,
      vehicleType,
    },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!item) {
    const err = new Error(`No PendingRequestItem found with vehicleType=${vehicleType} under pendingRequestId=${header.id}`);
    err.statusCode = 404;
    throw err;
  }

  if ((item.vehicleCount || 0) <= 0) {
    const err = new Error(`No remaining vehicleCount for vehicleType=${vehicleType} (already 0)`);
    err.statusCode = 409;
    throw err;
  }

  // decrement safely under lock
  item.vehicleCount = Number(item.vehicleCount) - 1;
  await item.save({ transaction });

  // mark interview as applied
  interview.inventoryAppliedAt = new Date();
  interview.inventoryPendingRequestId = header.id;
  interview.inventoryPendingRequestItemId = item.id;
  await interview.save({ transaction });

  return {
    applied: true,
    pendingRequestId: header.id,
    pendingRequestItemId: item.id,
    vehicleType,
    newVehicleCount: item.vehicleCount,
  };
}

module.exports = {
  applyInterviewActivationToPendingRequest,
  normalizeVehicleType,
  isCourierActive,
};
