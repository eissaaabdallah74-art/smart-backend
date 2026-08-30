const { Op, fn, col, where: seqWhere } = require('sequelize');
const { Driver, Vendor, Client } = require('../models');

// GET /api/tracking
exports.getAll = async (req, res) => {
  try {
    const { q, driverId, filter, page, limit } = req.query;
    const { id: userId, role } = req.user;
    
    // We only paginate if page/limit are provided. Otherwise, keep array for backward compatibility
    const isPaginated = page && limit;
    const pageNum = isPaginated ? parseInt(page, 10) : 1;
    const limitNum = isPaginated ? parseInt(limit, 10) : null;
    const offset = isPaginated ? (pageNum - 1) * limitNum : null;

    const baseWhere = {};

    // 🔐 التصفية حسب الصلاحيات (Role-based filtering)
    if (role === 'operation' || role === 'poc') {
      // جلب الشركات المسندة لهذا الـ Account Manager فقط
      const managedClients = await Client.findAll({
        where: { accountManagerId: userId },
        attributes: ['name'],
      });
      const clientNames = managedClients.map((c) => c.name);
      baseWhere.clientName = { [Op.in]: clientNames };
    }

    if (driverId) {
      baseWhere.id = Number(driverId);
    }

    if (q) {
      baseWhere[Op.or] = [
        { name: { [Op.like]: `%${q}%` } },
        { courierPhone: { [Op.like]: `%${q}%` } },
        { courierCode: { [Op.like]: `%${q}%` } },
        { clientName: { [Op.like]: `%${q}%` } },
      ];
    }

    // Clone baseWhere for the filtered list query
    const listWhere = { ...baseWhere };

    // Function to generate the date diff conditions
    const getExpiredCondition = () => ({
      [Op.or]: [
        seqWhere(fn('DATEDIFF', col('id_expiry_date'), fn('NOW')), { [Op.lt]: 0 }),
        seqWhere(fn('DATEDIFF', col('d_license_expiry_date'), fn('NOW')), { [Op.lt]: 0 }),
        seqWhere(fn('DATEDIFF', col('v_license_expiry_date'), fn('NOW')), { [Op.lt]: 0 }),
      ]
    });

    const getCriticalCondition = () => ({
      [Op.or]: [
        seqWhere(fn('DATEDIFF', col('id_expiry_date'), fn('NOW')), { [Op.between]: [0, 30] }),
        seqWhere(fn('DATEDIFF', col('d_license_expiry_date'), fn('NOW')), { [Op.between]: [0, 30] }),
        seqWhere(fn('DATEDIFF', col('v_license_expiry_date'), fn('NOW')), { [Op.between]: [0, 30] }),
      ]
    });

    const getWarningCondition = () => ({
      [Op.or]: [
        seqWhere(fn('DATEDIFF', col('id_expiry_date'), fn('NOW')), { [Op.between]: [31, 60] }),
        seqWhere(fn('DATEDIFF', col('d_license_expiry_date'), fn('NOW')), { [Op.between]: [31, 60] }),
        seqWhere(fn('DATEDIFF', col('v_license_expiry_date'), fn('NOW')), { [Op.between]: [31, 60] }),
      ]
    });

    if (filter === 'expired') {
      listWhere[Op.and] = [getExpiredCondition()];
    } else if (filter === 'critical') {
      listWhere[Op.and] = [getCriticalCondition()];
    } else if (filter === 'warning') {
      listWhere[Op.and] = [getWarningCondition()];
    }

    const queryOptions = {
      where: listWhere,
      include: [
        {
          model: Vendor,
          as: 'vendor',
          attributes: ['id', 'name'],
        },
      ],
      order: [['id', 'ASC']],
    };

    if (isPaginated) {
      queryOptions.limit = limitNum;
      queryOptions.offset = offset;
      
      const [
        totalCount,
        expiredCount,
        criticalCount,
        warningCount,
        { rows, count }
      ] = await Promise.all([
        Driver.count({ where: baseWhere }),
        Driver.count({ where: { ...baseWhere, ...getExpiredCondition() } }),
        Driver.count({ where: { ...baseWhere, ...getCriticalCondition() } }),
        Driver.count({ where: { ...baseWhere, ...getWarningCondition() } }),
        Driver.findAndCountAll(queryOptions)
      ]);

      const transformed = rows.map((d) => ({
        id: d.id,
        driverId: d.id,
        idExpiryDate: d.idExpiryDate,
        dLicenseExpiryDate: d.dLicenseExpiryDate,
        vLicenseExpiryDate: d.vLicenseExpiryDate,
        notes: d.notes,
        driver: d,
      }));

      return res.json({
        data: transformed,
        meta: {
          total: count,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(count / limitNum),
          stats: {
            total: totalCount,
            expired: expiredCount,
            critical: criticalCount,
            warning: warningCount
          }
        }
      });
    }

    const rows = await Driver.findAll(queryOptions);

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
