// src/controllers/loans.controller.js
const { Op } = require('sequelize');
const db = require('../models');

const { LoanRequest, Auth } = db;

function isOperationSeniorOrJunior(user) {
  return (
    user &&
    user.role === 'operation' &&
    (user.position === 'senior' || user.position === 'junior')
  );
}

function includeUsers() {
  return [
    {
      model: Auth,
      as: 'requester',
      attributes: ['id', 'fullName', 'email', 'role', 'position', 'isActive'],
    },
    {
      model: Auth,
      as: 'decidedBy',
      attributes: ['id', 'fullName', 'email', 'role', 'position', 'isActive'],
    },
  ];
}

// ================== Staff: Create Loan Request ==================
// POST /api/operations/loans
exports.createLoanRequest = async (req, res) => {
  try {
    const user = req.user;

    // السماح: admin أو operation senior/junior فقط
    if (user.role !== 'admin' && !isOperationSeniorOrJunior(user)) {
      return res.status(403).json({
        message: 'Only operation senior/junior (or admin) can create loan requests',
      });
    }

    const { amount, note } = req.body;

    const numAmount = Number(amount);
    if (!amount || Number.isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ message: 'Valid amount is required' });
    }

    const created = await LoanRequest.create({
      requesterId: user.id,
      amount: numAmount,
      note: note ? String(note).trim() : null,
      status: 'pending',
    });

    const full = await LoanRequest.findByPk(created.id, {
      include: includeUsers(),
    });

    return res.status(201).json(full);
  } catch (error) {
    console.error('createLoanRequest error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ================== Staff: My Requests ==================
// GET /api/operations/loans/my
exports.getMyLoanRequests = async (req, res) => {
  try {
    const user = req.user;

    // السماح: admin أو operation senior/junior فقط
    if (user.role !== 'admin' && !isOperationSeniorOrJunior(user)) {
      return res.status(403).json({
        message: 'Only operation senior/junior (or admin) can view their loans',
      });
    }

    const rows = await LoanRequest.findAll({
      where: { requesterId: user.id },
      include: includeUsers(),
      order: [['created_at', 'DESC']],
    });

    return res.json(rows);
  } catch (error) {
    console.error('getMyLoanRequests error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ================== Manager: List All (with filters) ==================
// GET /api/operations/loans?status=&requesterId=&q=
exports.getLoans = async (req, res) => {
  try {
    const { status, requesterId, q } = req.query;

    const where = {};
    if (status) where.status = status;
    if (requesterId) where.requesterId = Number(requesterId);

    // لو فيه q نفلتر على requester.fullName/email
    const requesterInclude = {
      model: Auth,
      as: 'requester',
      attributes: ['id', 'fullName', 'email', 'role', 'position', 'isActive'],
    };

    if (q) {
      requesterInclude.where = {
        [Op.or]: [
          { fullName: { [Op.like]: `%${q}%` } },
          { email: { [Op.like]: `%${q}%` } },
        ],
      };
      requesterInclude.required = true;
    }

    const rows = await LoanRequest.findAll({
      where,
      include: [
        requesterInclude,
        {
          model: Auth,
          as: 'decidedBy',
          attributes: ['id', 'fullName', 'email', 'role', 'position', 'isActive'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    return res.json(rows);
  } catch (error) {
    console.error('getLoans error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ================== Manager: Pending Only ==================
// GET /api/operations/loans/pending
exports.getPendingLoans = async (req, res) => {
  try {
    const rows = await LoanRequest.findAll({
      where: { status: 'pending' },
      include: includeUsers(),
      order: [['created_at', 'DESC']],
    });

    return res.json(rows);
  } catch (error) {
    console.error('getPendingLoans error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ================== Manager: Approve ==================
// PATCH /api/operations/loans/:id/approve  body: { managerNote? }
exports.approveLoan = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id parameter' });

    const { managerNote } = req.body;

    const row = await LoanRequest.findByPk(id);
    if (!row) return res.status(404).json({ message: 'Loan request not found' });

    if (row.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending requests can be approved' });
    }

    row.status = 'approved';
    row.decidedById = req.user.id;
    row.managerNote = managerNote ? String(managerNote).trim() : null;
    row.decidedAt = new Date();

    await row.save();

    const full = await LoanRequest.findByPk(row.id, { include: includeUsers() });
    return res.json(full);
  } catch (error) {
    console.error('approveLoan error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ================== Manager: Reject ==================
// PATCH /api/operations/loans/:id/reject  body: { managerNote? }
exports.rejectLoan = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id parameter' });

    const { managerNote } = req.body;

    const row = await LoanRequest.findByPk(id);
    if (!row) return res.status(404).json({ message: 'Loan request not found' });

    if (row.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending requests can be rejected' });
    }

    row.status = 'rejected';
    row.decidedById = req.user.id;
    row.managerNote = managerNote ? String(managerNote).trim() : null;
    row.decidedAt = new Date();

    await row.save();

    const full = await LoanRequest.findByPk(row.id, { include: includeUsers() });
    return res.json(full);
  } catch (error) {
    console.error('rejectLoan error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
