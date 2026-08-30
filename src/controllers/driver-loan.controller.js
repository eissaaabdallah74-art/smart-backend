const { DriverLoan, Driver, Auth, DriverNotification, Vendor } = require('../models');

const loanWritableFields = [
  'driverId',
  'amount',
  'installmentsCount',
  'paidAmount',
  'paymentMethod',
  'bankName',
  'bankAccountNumber',
  'walletName',
  'walletNumber',
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
    const { Op } = require('sequelize');
    const { driverId, status, page, limit, q, clientName } = req.query;

    const isPaginated = page && limit;
    const pageNum = isPaginated ? parseInt(page, 10) : 1;
    const limitNum = isPaginated ? parseInt(limit, 10) : null;
    const offset = isPaginated ? (pageNum - 1) * limitNum : null;

    const where = {};

    if (driverId !== undefined) {
      const dId = Number(driverId);
      if (Number.isNaN(dId)) {
        return res.status(400).json({ message: 'Invalid driverId query param' });
      }
      where.driverId = dId;
    }

    if (status) {
      where.status = String(status);
    }

    const driverWhere = {};
    if (clientName) {
      driverWhere.clientName = clientName;
    }
    if (q) {
      const qNum = Number(q);
      const isNum = !Number.isNaN(qNum);
      const searchConditions = [
        { name: { [Op.like]: `%${q}%` } },
        { courierPhone: { [Op.like]: `%${q}%` } },
        { clientName: { [Op.like]: `%${q}%` } },
      ];
      
      // If the query is a number, we also search by Loan ID.
      // This requires using top-level OR with $driver.name$ syntax or similar.
      if (isNum) {
        where[Op.or] = [
          { id: qNum },
          { '$driver.name$': { [Op.like]: `%${q}%` } },
          { '$driver.courierPhone$': { [Op.like]: `%${q}%` } },
          { '$driver.client_name$': { [Op.like]: `%${q}%` } }
        ];
      } else {
        where[Op.or] = searchConditions.map(cond => {
          const key = Object.keys(cond)[0];
          return { [`$driver.${key === 'clientName' ? 'client_name' : key}$`]: cond[key] };
        });
      }
    }

    const queryOptions = {
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
          where: Object.keys(driverWhere).length ? driverWhere : undefined,
          required: !!q || !!clientName, // Only require if searching by driver fields
        },
        {
          model: Auth,
          as: 'decidedBy',
          attributes: ['id', 'fullName', 'email', 'role'],
          required: false,
        },
      ],
      order: [['id', 'DESC']],
    };

    if (isPaginated) {
      queryOptions.limit = limitNum;
      queryOptions.offset = offset;
      const { rows, count } = await DriverLoan.findAndCountAll(queryOptions);
      return res.json({
        data: rows,
        meta: {
          total: count,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(count / limitNum)
        }
      });
    }

    const loans = await DriverLoan.findAll(queryOptions);
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

    const driver = await Driver.findByPk(payload.driverId, {
      include: [{ model: Vendor, as: 'vendor' }]
    });
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    if (driver.vendor) {
      const isSMV = driver.vendor.name && driver.vendor.name.trim().toLowerCase() === 'smv';
      if (!isSMV) {
         const vBank = driver.vendor.walletOrBankAccount || '';
         const isWallet = vBank.toLowerCase().includes('vodafone') || 
                          vBank.toLowerCase().includes('wallet') || 
                          vBank.toLowerCase().includes('cash') || 
                          vBank.toLowerCase().includes('محفظ') ||
                          vBank.toLowerCase().includes('فودافون') ||
                          vBank.toLowerCase().includes('كاش');
         
         payload.paymentMethod = isWallet ? 'wallet' : 'bank';
         if (isWallet) {
             payload.walletName = vBank;
             payload.walletNumber = driver.vendor.walletOrBankAccountNumber;
             payload.bankName = null;
             payload.bankAccountNumber = null;
         } else {
             payload.bankName = vBank;
             payload.bankAccountNumber = driver.vendor.walletOrBankAccountNumber;
             payload.walletName = null;
             payload.walletNumber = null;
         }
      }
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

    // If loan is NOT pending, restrict updates to core fields
    if (loan.status !== 'pending') {
      const restrictedFields = ['driverId', 'amount', 'installmentsCount', 'paymentMethod', 'bankName', 'bankAccountNumber', 'walletName', 'walletNumber'];
      for (const field of restrictedFields) {
        if (payload[field] !== undefined) {
          delete payload[field]; // discard updates to restricted fields
        }
      }
    }

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

    const oldStatus = loan.status;

    for (const key of Object.keys(payload)) {
      loan[key] = payload[key];
    }

    await loan.save({ audit });

    // Automation: Alert driver of loan decision
    try {
        if (oldStatus !== loan.status && (loan.status === 'approved' || loan.status === 'rejected')) {
             await DriverNotification.create({
                 driverId: loan.driverId,
                 title: loan.status === 'approved' ? 'قبول طلب السلفة (Loan Approved)' : 'رفض طلب السلفة (Loan Rejected)',
                 message: loan.status === 'approved' ? `تم قبول طلب السلفة الخاص بك بقيمة ${loan.amount}.` : `تم رفض طلب السلفة الخاص بك. الرجاء مراجعة الإدارة لمزيد من التفاصيل.`,
                 type: 'popup',
                 isRead: false
             });
        }
    } catch (autoErr) {
        console.error('Driver loan automation error:', autoErr);
    }

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

    if (loan.status !== 'pending') {
      return res.status(403).json({ message: 'Cannot delete a loan that has already been processed.' });
    }

    await loan.destroy({ audit });
    return res.json({ message: 'Driver loan deleted successfully' });
  } catch (error) {
    console.error('deleteDriverLoan error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};