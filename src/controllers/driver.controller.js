const { Driver, DriverAttendance, DriverLoan, Vendor, AuditLog, PendingRequest, PendingRequestItem, Client, Hub, Zone, Payroll, sequelize } = require('../models');
const { backfillDriversFromInterviews } = require('../services/driver-sync.service');

const driverWritableFields = [
  'name',
  'fullNameArabic',
  'email',
  'courierPhone',
  'courierId',
  'residence',
  'courierCode',
  'clientName',
  'hub',
  'area',
  'module',
  'vehicleType',
  'contractor',
  'pointOfContact',
  'accountManager',
  'interviewer',
  'hrRepresentative',
  'hiringDate',
  'day1Date',
  'vLicenseExpiryDate',
  'dLicenseExpiryDate',
  'idExpiryDate',
  'liabilityAmount',
  'signed',
  'signedWithHr',
  'contractStatus',
  'hiringStatus',
  'securityQueryStatus',
  'securityQueryComment',
  'exceptionBy',
  'vendorId',
  'monthlySalary',
  'paymentMethod',
  'bankName',
  'bankAccountNumber',
  'walletName',
  'walletNumber',
  'notes',
  'isBlacklisted',
  'blacklistReason'
];

function buildDriverPayload(body = {}) {
  const payload = {};

  for (const field of driverWritableFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      payload[field] = body[field];
    }
  }

  return payload;
}

// GET /api/drivers
exports.getAllDrivers = async (req, res) => {
  try {
    const drivers = await Driver.findAll({
      include: [
        {
          model: Vendor,
          as: 'vendor',
          attributes: ['id', 'name'],
          required: false,
        },
      ],
      order: [['id', 'ASC']],
    });

    return res.json(drivers);
  } catch (error) {
    console.error('getAllDrivers error:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

// GET /api/drivers/blacklist
exports.getBlacklistedDrivers = async (req, res) => {
  try {
    const drivers = await Driver.findAll({
      where: { isBlacklisted: true },
      include: [
        {
          model: Vendor,
          as: 'vendor',
          attributes: ['id', 'name'],
          required: false,
        },
      ],
      order: [['id', 'DESC']],
    });

    return res.json(drivers);
  } catch (error) {
    console.error('getBlacklistedDrivers error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/drivers/:id/blacklist
exports.toggleBlacklist = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const driver = await Driver.findByPk(id);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    const { isBlacklisted, reason } = req.body;
    
    // Toggle logic
    const newValue = isBlacklisted !== undefined ? isBlacklisted : !driver.isBlacklisted;
    
    driver.isBlacklisted = newValue;
    driver.blacklistReason = newValue ? reason || null : null;
    driver.blacklistedAt = newValue ? new Date() : null;

    if (newValue) {
       driver.hiringStatus = 'Inactive';
    }

    await driver.save({ audit: req.audit });

    return res.json(driver);
  } catch (error) {
    console.error('toggleBlacklist error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/drivers/sync-from-interviews
exports.syncDriversFromInterviews = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const audit = req.audit;

    const result = await backfillDriversFromInterviews({
      transaction: t,
      audit,
    });

    await t.commit();
    return res.json({ success: true, ...result });
  } catch (error) {
    if (t && !t.finished) {
      try {
        await t.rollback();
      } catch (_) {}
    }

    console.error('syncDriversFromInterviews error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

// POST /api/drivers/bulk
exports.bulkUpsertDrivers = async (req, res) => {
  const rows = Array.isArray(req.body) ? req.body : [];
  if (!rows.length) {
    return res
      .status(400)
      .json({ message: 'Request body must be a non-empty array.' });
  }

  const audit = req.audit;

  const payload = rows
    .map((row) => {
      const obj = {};

      if (row.id !== undefined && row.id !== null && row.id !== '') {
        const idNum = Number(row.id);
        if (!Number.isNaN(idNum)) obj.id = idNum;
      }

      for (const field of driverWritableFields) {
        if (Object.prototype.hasOwnProperty.call(row, field)) {
          obj[field] = row[field];
        }
      }

      return obj;
    })
    .filter((row) => row.name && String(row.name).trim().length);

  if (!payload.length) {
    return res
      .status(400)
      .json({ message: 'No valid driver rows to import (missing name).' });
  }

  const t = await sequelize.transaction();

  try {
    const individual =
      String(process.env.AUDIT_BULK_INDIVIDUAL || '').toLowerCase() === 'true';

    if (!individual) {
      await Driver.bulkCreate(payload, {
        updateOnDuplicate: driverWritableFields,
        transaction: t,
      });

      if (AuditLog && audit) {
        await AuditLog.create(
          {
            entityType: 'Driver',
            entityId: 0,
            action: 'UPDATE',
            actorId: audit.actorId || null,
            changes: {
              bulk: {
                requestedRows: rows.length,
                acceptedRows: payload.length,
              },
            },
            meta: audit,
          },
          { transaction: t }
        );
      }
    } else {
      let created = 0;
      let updated = 0;

      for (const row of payload) {
        let existing = null;

        if (row.id) {
          existing = await Driver.findByPk(row.id, { transaction: t });
        } else if (row.courierPhone) {
          existing = await Driver.findOne({
            where: { courierPhone: row.courierPhone },
            transaction: t,
          });
        }

        if (!existing) {
          await Driver.create(row, { transaction: t, audit });
          created += 1;
        } else {
          for (const f of driverWritableFields) {
            if (Object.prototype.hasOwnProperty.call(row, f)) {
              existing[f] = row[f];
            }
          }

          await existing.save({ transaction: t, audit });
          updated += 1;
        }
      }

      if (AuditLog && audit) {
        await AuditLog.create(
          {
            entityType: 'Driver',
            entityId: 0,
            action: 'UPDATE',
            actorId: audit.actorId || null,
            changes: {
              bulk: {
                requestedRows: rows.length,
                acceptedRows: payload.length,
                created,
                updated,
                mode: 'individual',
              },
            },
            meta: audit,
          },
          { transaction: t }
        );
      }
    }

    await t.commit();

    const drivers = await Driver.findAll({ order: [['id', 'ASC']] });
    return res.json(drivers);
  } catch (error) {
    if (t && !t.finished) {
      try {
        await t.rollback();
      } catch (_) {}
    }

    console.error('bulkUpsertDrivers error:', error);

    if (error.name === 'SequelizeValidationError') {
      const first = error.errors && error.errors[0];
      return res.status(400).json({
        message: first?.message || 'Validation error',
      });
    }

    return res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/drivers/:id
exports.getDriverById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const driver = await Driver.findByPk(id, {
      include: [
        {
          model: Vendor,
          as: 'vendor',
          attributes: ['id', 'name'],
          required: false,
        },
        {
          model: DriverLoan,
          as: 'loans',
          separate: true,
          order: [['id', 'DESC']],
        },
        {
          model: Payroll,
          as: 'payrolls',
          separate: true,
          order: [['year', 'DESC'], ['month', 'DESC']],
          limit: 1,
        },
      ],
    });

    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    return res.json(driver);
  } catch (error) {
    console.error('getDriverById error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/drivers
exports.createDriver = async (req, res) => {
  try {
    const audit = req.audit;
    const payload = buildDriverPayload(req.body || {});

    if (!payload.name) {
      return res.status(400).json({ message: 'Driver name is required' });
    }

    if (!payload.vendorId) {
      return res.status(400).json({ message: 'vendorId is required' });
    }

    const driver = await Driver.create(payload, { audit });
    return res.status(201).json(driver);
  } catch (error) {
    console.error('createDriver error:', error);

    if (error.name === 'SequelizeValidationError') {
      const first = error.errors && error.errors[0];
      return res.status(400).json({
        message: first?.message || 'Validation error',
      });
    }

    return res.status(500).json({ message: 'Internal server error' });
  }
};

// PUT /api/drivers/:id
exports.updateDriver = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const audit = req.audit;
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const driver = await Driver.findByPk(id, { transaction: t });
    if (!driver) {
      await t.rollback();
      return res.status(404).json({ message: 'Driver not found' });
    }

    const wasActive = (driver.hiringStatus || '').toLowerCase() !== 'inactive';

    console.log('[DEBUG] Express req.body:', req.body);
    const payload = buildDriverPayload(req.body || {});
    console.log('[DEBUG] updateDriver payload:', payload);
    for (const key of Object.keys(payload)) {
      if (payload[key] !== undefined) {
        driver[key] = payload[key];
      }
    }

    if (payload.isBlacklisted !== undefined) {
       if (payload.isBlacklisted && !driver.blacklistedAt) {
          driver.blacklistedAt = new Date();
       } else if (!payload.isBlacklisted) {
          driver.blacklistedAt = null;
          driver.blacklistReason = null;
       }
    }

    if (driver.isBlacklisted && (driver.hiringStatus || '').toLowerCase() === 'active') {
       await t.rollback();
       return res.status(400).json({ message: 'لا يمكن تفعيل مندوب مسجل في القائمة السوداء. يرجى إزالته أولاً.' });
    }

    await driver.save({ audit, transaction: t });

    const isNowInactive = (driver.hiringStatus || '').toLowerCase() === 'inactive';

    if (req.body.createReplacementRequest === true && wasActive && isNowInactive) {
      try {
        let resolvedClientId = null;
        let resolvedHubId = null;
        let resolvedZoneId = null;

        if (driver.clientName) {
           const cl = await Client.findOne({ where: { name: driver.clientName }, transaction: t });
           if (cl) resolvedClientId = cl.id;
        }
        if (driver.hub) {
           const h = await Hub.findOne({ where: { name: driver.hub }, transaction: t });
           if (h) resolvedHubId = h.id;
        }
        if (driver.area) {
           const z = await Zone.findOne({ where: { name: driver.area }, transaction: t });
           if (z) resolvedZoneId = z.id;
        }

        if (resolvedClientId) {
          const replacementHeader = await PendingRequest.create({
             clientId: resolvedClientId,
             hubId: resolvedHubId || null,
             zoneId: resolvedZoneId || null,
             requestDate: new Date().toISOString().split('T')[0],
             billingMonth: null,
             status: 'APPROVED',
             priority: 'high',
             notes: `Auto-generated replacement request for ${driver.name || 'Courier'} due to InActive status.`,
             createdBy: req.user?.id || req.body.updatedById || null,
          }, { transaction: t });

          await PendingRequestItem.create({
             pendingRequestId: replacementHeader.id,
             vehicleType: driver.vehicleType || 'Unknown',
             vehicleCount: 1,
             orderPrice: null,
             guaranteeMinOrders: null,
             fixedAmount: null,
             allowanceAmount: null,
             totalAmount: null,
          }, { transaction: t });
        }
      } catch (replErr) {
        console.error("Replacement Request error in Driver:", replErr);
      }
    }

    await t.commit();
    return res.json(driver);
  } catch (error) {
    if (t && !t.finished) {
      try { await t.rollback(); } catch (_) {}
    }
    console.error('updateDriver error:', error);

    if (error.name === 'SequelizeValidationError') {
      const first = error.errors && error.errors[0];
      return res.status(400).json({
        message: first?.message || 'Validation error',
      });
    }

    return res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /api/drivers/:id
exports.deleteDriver = async (req, res) => {
  try {
    const audit = req.audit;
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const driver = await Driver.findByPk(id);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    await driver.destroy({ audit });
    return res.json({ message: 'Driver deleted successfully' });
  } catch (error) {
    console.error('deleteDriver error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/drivers/blacklist/all
exports.getBlacklistedDrivers = async (req, res) => {
  try {
    const drivers = await Driver.findAll({
      where: {
        isBlacklisted: true
      },
      include: [
        {
          model: Vendor,
          as: 'vendor',
          attributes: ['id', 'name'],
        },
      ],
      order: [['blacklistedAt', 'DESC'], ['id', 'DESC']]
    });

    return res.json(drivers);
  } catch (error) {
    console.error('getBlacklistedDrivers error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/drivers/:id/blacklist
exports.toggleBlacklist = async (req, res) => {
  try {
    const audit = req.audit;
    const id = Number(req.params.id);
    const { isBlacklisted, reason } = req.body;

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const driver = await Driver.findByPk(id);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    if (isBlacklisted && driver.hiringStatus === 'Active') {
       await driver.update({
         isBlacklisted: true,
         blacklistReason: reason || null,
         blacklistedAt: new Date(),
         hiringStatus: 'Inactive'
       }, { audit });
    } else if (isBlacklisted) {
       await driver.update({
         isBlacklisted: true,
         blacklistReason: reason || null,
         blacklistedAt: new Date()
       }, { audit });
    } else {
       await driver.update({
         isBlacklisted: false,
         blacklistReason: null,
         blacklistedAt: null
       }, { audit });
    }

    return res.json(driver);
  } catch (error) {
    console.error('toggleBlacklist error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/drivers/attendance/daily
exports.getDriverAttendances = async (req, res) => {
  try {
    const { month, year, clientName } = req.query;
    const { Op } = require('sequelize');

    const whereClause = {};
    if (month && year) {
      const mNum = Number(month);
      const yNum = Number(year);
      if (!Number.isNaN(mNum) && !Number.isNaN(yNum)) {
        const startDate = new Date(yNum, mNum - 1, 1);
        const endDate = new Date(yNum, mNum, 0);
        whereClause.date = {
          [Op.between]: [
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0],
          ],
        };
      }
    }

    const driverWhere = {};
    let includeRequired = false;
    if (clientName) {
      driverWhere.clientName = clientName;
      includeRequired = true;
    }

    const attendances = await DriverAttendance.findAll({
      where: whereClause,
      include: [
        {
          model: Driver,
          as: 'driver',
          attributes: ['id', 'name', 'courierPhone', 'clientName', 'hub', 'area', 'vehicleType'],
          where: driverWhere,
          required: includeRequired,
        },
      ],
      order: [['date', 'DESC']],
    });

    return res.json({ success: true, attendances });
  } catch (error) {
    console.error('getDriverAttendances error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// PATCH /api/drivers/attendance/:id/approval
exports.updateAttendanceApproval = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid attendance id' });
    }

    const { approvalStatus } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(approvalStatus)) {
      return res.status(400).json({ message: 'Invalid approval status value' });
    }

    const attendance = await DriverAttendance.findByPk(id, {
      include: [
        {
          model: Driver,
          as: 'driver',
          attributes: ['id', 'name', 'courierPhone', 'clientName', 'hub', 'area', 'vehicleType'],
        },
      ],
    });

    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    attendance.approvalStatus = approvalStatus;
    await attendance.save({ audit: req.audit });

    return res.json({ success: true, attendance });
  } catch (error) {
    console.error('updateAttendanceApproval error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// PATCH /api/drivers/attendance/bulk-status
exports.bulkUpdateAttendanceStatus = async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: 'Array of attendance ids is required' });
    }
    if (!['present', 'absent'].includes(status)) {
      return res.status(400).json({ message: 'Valid status (present/absent) is required' });
    }

    await DriverAttendance.update(
      { status },
      { where: { id: ids } }
    );

    return res.json({ success: true, updatedCount: ids.length });
  } catch (error) {
    console.error('bulkUpdateAttendanceStatus error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};