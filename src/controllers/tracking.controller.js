const { Op } = require('sequelize');
const { Tracking, Driver } = require('../models');

// GET /api/tracking?q=&driverId=
exports.getAll = async (req, res) => {
  try {
    const { q, driverId } = req.query;
    const where = {};

    if (driverId) {
      where.driverId = Number(driverId);
    }

    if (q) {
      where[Op.or] = [
        { dspShortcode: { [Op.like]: `%${q}%` } },
        { dasUsername: { [Op.like]: `%${q}%` } },
      ];
    }

    const rows = await Tracking.findAll({
      where,
      include: [
        {
          model: Driver,
          as: 'driver',
          attributes: [
            'id',
            'name',
            'courierPhone',
            'courierId',
            'courierCode',
            'clientName',
            'vehicleType',
          ],
        },
      ],
      order: [['id', 'ASC']],
    });

    res.json(rows);
  } catch (err) {
    console.error('getAll tracking error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/tracking/:id
exports.getOne = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const row = await Tracking.findByPk(id, {
      include: [
        {
          model: Driver,
          as: 'driver',
        },
      ],
    });

    if (!row) return res.status(404).json({ message: 'Tracking row not found' });

    res.json(row);
  } catch (err) {
    console.error('getOne tracking error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/tracking
exports.create = async (req, res) => {
  try {
    const {
      driverId,
      dspShortcode,
      dasFirstName,
      dasLastName,
      dasUsername,
      visaSponsorshipOnDsp,
      birthDate,
      vehiclePlateNumber,
      criminalRecordIssueDate,
      idExpiryDate,
      dLicenseExpiryDate,
      vLicenseExpiryDate,
      notes,
    } = req.body;

    if (!driverId) {
      return res.status(400).json({ message: 'driverId is required' });
    }

    const created = await Tracking.create({
      driverId,
      dspShortcode,
      dasFirstName,
      dasLastName,
      dasUsername,
      visaSponsorshipOnDsp,
      birthDate,
      vehiclePlateNumber,
      criminalRecordIssueDate,
      idExpiryDate,
      dLicenseExpiryDate,
      vLicenseExpiryDate,
      notes,
    });

    const withDriver = await Tracking.findByPk(created.id, {
      include: [
        {
          model: Driver,
          as: 'driver',
        },
      ],
    });

    res.status(201).json(withDriver);
  } catch (err) {
    console.error('create tracking error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// PUT /api/tracking/:id
exports.update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const row = await Tracking.findByPk(id);
    if (!row) return res.status(404).json({ message: 'Tracking row not found' });

    await row.update(req.body);

    const withDriver = await Tracking.findByPk(id, {
      include: [
        {
          model: Driver,
          as: 'driver',
        },
      ],
    });

    res.json(withDriver);
  } catch (err) {
    console.error('update tracking error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/tracking/bulk
exports.bulkUpsert = async (req, res) => {
  try {
    const payload = req.body;

    if (!Array.isArray(payload)) {
      return res.status(400).json({ message: 'Body must be an array' });
    }

    const updatableFields = [
      'driverId',
      'dspShortcode',
      'dasFirstName',
      'dasLastName',
      'dasUsername',
      'visaSponsorshipOnDsp',
      'birthDate',
      'vehiclePlateNumber',
      'criminalRecordIssueDate',
      'idExpiryDate',
      'dLicenseExpiryDate',
      'vLicenseExpiryDate',
      'notes',
    ];

    const ids = [];

    for (const item of payload) {
      if (!item || typeof item !== 'object') continue;

      const data = {};
      for (const field of updatableFields) {
        if (Object.prototype.hasOwnProperty.call(item, field)) {
          data[field] = item[field];
        }
      }

      // محتاجين driverId أو id علشان نعرف نـupsert
      if (!data.driverId && !item.id) {
        continue;
      }

      let row = null;

      if (item.id) {
        const numericId = Number(item.id);
        if (!Number.isNaN(numericId)) {
          row = await Tracking.findByPk(numericId);
        }
      }

      if (!row && data.driverId) {
        row = await Tracking.findOne({
          where: { driverId: Number(data.driverId) },
        });
      }

      if (row) {
        await row.update(data);
      } else if (data.driverId) {
        row = await Tracking.create(data);
      }

      if (row) {
        ids.push(row.id);
      }
    }

    if (!ids.length) {
      return res.json([]);
    }

    const rows = await Tracking.findAll({
      where: { id: ids },
      include: [
        {
          model: Driver,
          as: 'driver',
          attributes: [
            'id',
            'name',
            'courierPhone',
            'courierId',
            'courierCode',
            'clientName',
            'vehicleType',
          ],
        },
      ],
      order: [['id', 'ASC']],
    });

    res.json(rows);
  } catch (err) {
    console.error('bulkUpsert tracking error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /api/tracking/:id
exports.remove = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const row = await Tracking.findByPk(id);
    if (!row) return res.status(404).json({ message: 'Tracking row not found' });

    await row.destroy();
    res.json({ message: 'Tracking row deleted' });
  } catch (err) {
    console.error('delete tracking error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
