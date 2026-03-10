const { DriverLoan, Driver, Auth } = require('../models');

const loanWritableFields = [
  'driverId',
  'amount',
  'paymentMethod',
  'bankName',
  'bankAccountNumber',
  'walletName',
  'walletNumber',
  'ticketRequested',
  'requestText',
  'personalIdFrontImage',
  'personalIdBackImage',
  'clientNameSnapshot',
  'phoneNumberSnapshot',
  'hubSnapshot',
  'status',
  'decidedById',
  'decidedAt',
  'notes',
];

function buildLoanPayload(body = {}) {
  const payload = {};

  for (const field of loanWritableFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      payload[field] = body[field];
    }
  }

  return payload;
}

// GET /api/driver-loans
exports.getAllDriverLoans = async (req, res) => {
  try {
    const where = {};

    if (req.query.driverId !== undefined) {
      const driverId = Number(req.query.driverId);
      if (Number.isNaN(driverId)) {
        return res.status(400).json({ message: 'Invalid driverId query param' });
      }
      where.driverId = driverId;
    }

    if (req.query.status) {
      where.status = String(req.query.status);
    }

    const loans = await DriverLoan.findAll({
      where,
      include: [
        {
          model: Driver,
          as: 'driver',
          attributes: [
            'id',
            'name',
            'fullNameArabic',
            'courierPhone',
            'clientName',
            'hub',
            'vendorId',
          ],
          required: false,
        },
        {
          model: Auth,
          as: 'decidedBy',
          attributes: ['id', 'fullName', 'email', 'role'],
          required: false,
        },
      ],
      order: [['id', 'DESC']],
    });

    return res.json(loans);
  } catch (error) {
    console.error('getAllDriverLoans error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/driver-loans/:id
exports.getDriverLoanById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const loan = await DriverLoan.findByPk(id, {
      include: [
        {
          model: Driver,
          as: 'driver',
          attributes: [
            'id',
            'name',
            'fullNameArabic',
            'courierPhone',
            'clientName',
            'hub',
            'vendorId',
          ],
          required: false,
        },
        {
          model: Auth,
          as: 'decidedBy',
          attributes: ['id', 'fullName', 'email', 'role'],
          required: false,
        },
      ],
    });

    if (!loan) {
      return res.status(404).json({ message: 'Driver loan not found' });
    }

    return res.json(loan);
  } catch (error) {
    console.error('getDriverLoanById error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/driver-loans
exports.createDriverLoan = async (req, res) => {
  try {
    const audit = req.audit;
    const payload = buildLoanPayload(req.body || {});

    if (!payload.driverId) {
      return res.status(400).json({ message: 'driverId is required' });
    }

    if (!payload.amount) {
      return res.status(400).json({ message: 'amount is required' });
    }

    if (!payload.paymentMethod) {
      return res.status(400).json({ message: 'paymentMethod is required' });
    }

    const driver = await Driver.findByPk(payload.driverId);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    // auto snapshots from driver if not sent
    if (!payload.clientNameSnapshot) {
      payload.clientNameSnapshot = driver.clientName || null;
    }

    if (!payload.phoneNumberSnapshot) {
      payload.phoneNumberSnapshot = driver.courierPhone || null;
    }

    if (!payload.hubSnapshot) {
      payload.hubSnapshot = driver.hub || null;
    }

    // optional auto decision metadata
    if (
      payload.status &&
      ['approved', 'rejected', 'disbursed', 'cancelled', 'closed'].includes(
        payload.status
      )
    ) {
      if (!payload.decidedAt) payload.decidedAt = new Date();
      if (!payload.decidedById && req.user?.id) payload.decidedById = req.user.id;
    }

    const loan = await DriverLoan.create(payload, { audit });
    return res.status(201).json(loan);
  } catch (error) {
    console.error('createDriverLoan error:', error);

    if (error.name === 'SequelizeValidationError') {
      const first = error.errors && error.errors[0];
      return res.status(400).json({
        message: first?.message || 'Validation error',
      });
    }

    return res.status(500).json({ message: 'Internal server error' });
  }
};

// PUT /api/driver-loans/:id
exports.updateDriverLoan = async (req, res) => {
  try {
    const audit = req.audit;
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const loan = await DriverLoan.findByPk(id);
    if (!loan) {
      return res.status(404).json({ message: 'Driver loan not found' });
    }

    const payload = buildLoanPayload(req.body || {});

    if (payload.driverId) {
      const driver = await Driver.findByPk(payload.driverId);
      if (!driver) {
        return res.status(404).json({ message: 'Driver not found' });
      }
    }

    if (
      payload.status &&
      ['approved', 'rejected', 'disbursed', 'cancelled', 'closed'].includes(
        payload.status
      )
    ) {
      if (!payload.decidedAt) payload.decidedAt = new Date();
      if (!payload.decidedById && req.user?.id) payload.decidedById = req.user.id;
    }

    for (const key of Object.keys(payload)) {
      loan[key] = payload[key];
    }

    await loan.save({ audit });
    return res.json(loan);
  } catch (error) {
    console.error('updateDriverLoan error:', error);

    if (error.name === 'SequelizeValidationError') {
      const first = error.errors && error.errors[0];
      return res.status(400).json({
        message: first?.message || 'Validation error',
      });
    }

    return res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /api/driver-loans/:id
exports.deleteDriverLoan = async (req, res) => {
  try {
    const audit = req.audit;
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const loan = await DriverLoan.findByPk(id);
    if (!loan) {
      return res.status(404).json({ message: 'Driver loan not found' });
    }

    await loan.destroy({ audit });
    return res.json({ message: 'Driver loan deleted successfully' });
  } catch (error) {
    console.error('deleteDriverLoan error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};