const { Driver, DriverLoan, Vendor, AuditLog, sequelize } = require('../models');
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

    const payload = buildDriverPayload(req.body || {});
    for (const key of Object.keys(payload)) {
      driver[key] = payload[key];
    }

    await driver.save({ audit });
    return res.json(driver);
  } catch (error) {
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