const { Op } = require('sequelize');
const { Driver, Vendor, Client } = require('../models');

// GET /api/tracking
exports.getAll = async (req, res) => {
  try {
    const { q, driverId } = req.query;
    const { id: userId, role } = req.user;
    const where = {};

    // 🔐 التصفية حسب الصلاحيات (Role-based filtering)
    if (role === 'operation') {
      // جلب الشركات المسندة لهذا الـ Account Manager فقط
      const managedClients = await Client.findAll({
        where: { accountManagerId: userId },
        attributes: ['name'],
      });
      const clientNames = managedClients.map((c) => c.name);
      where.clientName = { [Op.in]: clientNames };
    }

    if (driverId) {
      where.id = Number(driverId);
    }

    if (q) {
      where[Op.or] = [
        { name: { [Op.like]: `%${q}%` } },
        { courierPhone: { [Op.like]: `%${q}%` } },
        { courierCode: { [Op.like]: `%${q}%` } },
        { clientName: { [Op.like]: `%${q}%` } },
      ];
    }

    const rows = await Driver.findAll({
      where,
      include: [
        {
          model: Vendor,
          as: 'vendor',
          attributes: ['id', 'name'],
        },
      ],
      order: [['id', 'ASC']],
    });

    // Match the frontend's expected "TrackingRow" structure for backward compatibility
    const transformed = rows.map((d) => ({
      id: d.id, // We use the driver ID as the tracking Row ID now
      driverId: d.id,
      dspShortcode: null, // Legacy field
      dasFirstName: null, // Legacy field
      dasLastName: null, // Legacy field
      dasUsername: null, // Legacy field
      visaSponsorshipOnDsp: null, // Legacy field
      birthDate: null, // Legacy field
      vehiclePlateNumber: null, // Legacy field
      criminalRecordIssueDate: null, // Legacy field
      idExpiryDate: d.idExpiryDate,
      dLicenseExpiryDate: d.dLicenseExpiryDate,
      vLicenseExpiryDate: d.vLicenseExpiryDate,
      notes: d.notes,
      driver: d,
    }));

    res.json(transformed);
  } catch (err) {
    console.error('getAll tracking error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/tracking/:id (maps to Driver ID)
exports.getOne = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const d = await Driver.findByPk(id, {
      include: [{ model: Vendor, as: 'vendor' }],
    });

    if (!d) return res.status(404).json({ message: 'Driver not found' });

    res.json({
      id: d.id,
      driverId: d.id,
      idExpiryDate: d.idExpiryDate,
      dLicenseExpiryDate: d.dLicenseExpiryDate,
      vLicenseExpiryDate: d.vLicenseExpiryDate,
      notes: d.notes,
      driver: d,
    });
  } catch (err) {
    console.error('getOne tracking error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// PUT /api/tracking/:id (updates Driver expiry dates)
exports.update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const d = await Driver.findByPk(id);
    if (!d) return res.status(404).json({ message: 'Driver not found' });

    const {
      idExpiryDate,
      dLicenseExpiryDate,
      vLicenseExpiryDate,
      notes
    } = req.body;

    await d.update({
      idExpiryDate,
      dLicenseExpiryDate,
      vLicenseExpiryDate,
      notes
    });

    const refreshed = await Driver.findByPk(id, {
      include: [{ model: Vendor, as: 'vendor' }],
    });

    res.json({
      id: refreshed.id,
      driverId: refreshed.id,
      idExpiryDate: refreshed.idExpiryDate,
      dLicenseExpiryDate: refreshed.dLicenseExpiryDate,
      vLicenseExpiryDate: refreshed.vLicenseExpiryDate,
      notes: refreshed.notes,
      driver: refreshed,
    });
  } catch (err) {
    console.error('update tracking error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Disabled methods no longer needed in the simplified architecture
exports.create = (req, res) => res.status(405).json({ message: 'Use Driver creation API instead' });
exports.bulkUpsert = (req, res) => res.status(405).json({ message: 'Method disabled in simplified architecture' });
exports.remove = (req, res) => res.status(405).json({ message: 'Delete Driver instead' });
