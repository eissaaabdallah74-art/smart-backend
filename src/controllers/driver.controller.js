// src/controllers/driver.controller.js
const { Driver, sequelize } = require('../models');

const {
  backfillDriversFromInterviews,
} = require('../services/driver-sync.service');

// 🟠 الحقول اللي مسموح نعمل لها update / upsert من API & bulk import
const updatableFields = [
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
  'contractStatus',
  'hiringStatus',
  'securityQueryStatus',
  'securityQueryComment',
  'exceptionBy',
  'notes',
];

// GET /api/drivers
exports.getAllDrivers = async (req, res) => {
  try {
    const drivers = await Driver.findAll({
      order: [['id', 'ASC']],
    });
    return res.json(drivers);
  } catch (error) {
    console.error('getAllDrivers error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/drivers/sync-from-interviews
// backfill مرة واحدة (أو لما تحب)
exports.syncDriversFromInterviews = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const result = await backfillDriversFromInterviews({ transaction: t });
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
  try {
    const rows = Array.isArray(req.body) ? req.body : [];
    if (!rows.length) {
      return res
        .status(400)
        .json({ message: 'Request body must be a non-empty array.' });
    }

    const payload = rows
      .map((row) => {
        const obj = {};

        if (row.id !== undefined && row.id !== null && row.id !== '') {
          const idNum = Number(row.id);
          if (!Number.isNaN(idNum)) {
            obj.id = idNum;
          }
        }

        for (const field of updatableFields) {
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

    await Driver.bulkCreate(payload, {
      updateOnDuplicate: updatableFields,
    });

    const drivers = await Driver.findAll({
      order: [['id', 'ASC']],
    });

    return res.json(drivers);
  } catch (error) {
    console.error('bulkUpsertDrivers error:', error);
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

    const driver = await Driver.findByPk(id);
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
    const {
      name,
      fullNameArabic,
      email,
      courierPhone,
      courierId,
      residence,
      courierCode,
      clientName,
      hub,
      area,
      module,
      vehicleType,
      contractor,
      pointOfContact,
      accountManager,
      interviewer,
      hrRepresentative,
      hiringDate,
      day1Date,
      vLicenseExpiryDate,
      dLicenseExpiryDate,
      idExpiryDate,
      liabilityAmount,
      signed,
      contractStatus,
      hiringStatus,
      securityQueryStatus,
      securityQueryComment,
      exceptionBy,
      notes,
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Driver name is required' });
    }

    const driver = await Driver.create({
      name,
      fullNameArabic,
      email,
      courierPhone,
      courierId,
      residence,
      courierCode,
      clientName,
      hub,
      area,
      module,
      vehicleType,
      contractor,
      pointOfContact,
      accountManager,
      interviewer,
      hrRepresentative,
      hiringDate,
      day1Date,
      vLicenseExpiryDate,
      dLicenseExpiryDate,
      idExpiryDate,
      liabilityAmount,
      signed,
      contractStatus,
      hiringStatus,
      securityQueryStatus,
      securityQueryComment,
      exceptionBy,
      notes,
    });

    return res.status(201).json(driver);
  } catch (error) {
    console.error('createDriver error:', error);

    if (error.name === 'SequelizeValidationError') {
      const first = error.errors && error.errors[0];
      return res
        .status(400)
        .json({ message: first?.message || 'Validation error' });
    }

    return res.status(500).json({ message: 'Internal server error' });
  }
};

// PUT /api/drivers/:id
exports.updateDriver = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const driver = await Driver.findByPk(id);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    for (const field of updatableFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        driver[field] = req.body[field];
      }
    }

    await driver.save();

    return res.json(driver);
  } catch (error) {
    console.error('updateDriver error:', error);

    if (error.name === 'SequelizeValidationError') {
      const first = error.errors && error.errors[0];
      return res
        .status(400)
        .json({ message: first?.message || 'Validation error' });
    }

    return res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /api/drivers/:id
exports.deleteDriver = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const driver = await Driver.findByPk(id);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    await driver.destroy();
    return res.json({ message: 'Driver deleted successfully' });
  } catch (error) {
    console.error('deleteDriver error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
