// src/controllers/client.controller.js
const { Op } = require('sequelize');
const { Client, Auth, sequelize } = require('../models');
const {
  canSeeAllClients,
  applyClientScopeWhere,
} = require('../middlewares/client-scope.helpers');

// helper بسيط لعمل default لقيم الشركة و النوع
function normalizeCompany(company) {
  if (company === '1' || company === '2') return company;
  if (!company || company === '') return '1'; // الديفولت
  return company;
}

function normalizeClientType(clientType) {
  if (clientType && String(clientType).trim() !== '') return clientType;
  return 'Class A'; // الديفولت
}

// sanitize: لو value مش رقم صالح → null
function normalizeAccountManagerId(val) {
  if (val === null || typeof val === 'undefined' || val === '') return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

// GET /api/clients
// اختياري q للبحث العام: ?q=aramex
exports.getAllClients = async (req, res) => {
  try {
    const { q } = req.query;
    const where = {};

    // ✅ apply scoping
    applyClientScopeWhere(where, req.user);

    if (q) {
      const like = { [Op.like]: `%${q}%` };

      // ملاحظة: where فيه account_manager_id already
      // هنضيف OR تحت AND تلقائياً (Sequelize بيعملها كويس)
      where[Op.or] = [
        { name: like },
        { crm: like },
        { pointOfContact: like },
        { contactEmail: like },
        { accountManager: like }, // legacy
        // البحث بالحقول الجديدة
        { clientType: like },
        { company: like },
      ];
    }

    const clients = await Client.findAll({
      where,
      order: [['id', 'ASC']],
      include: [
        {
          model: Auth,
          as: 'accountManagerUser',
          attributes: ['id', 'fullName', 'email', 'role', 'position'],
          required: false,
        },
      ],
    });

    return res.json(clients);
  } catch (error) {
    console.error('getAllClients error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/clients/:id
exports.getClientById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const where = { id };
    applyClientScopeWhere(where, req.user);

    const client = await Client.findOne({
      where,
      include: [
        {
          model: Auth,
          as: 'accountManagerUser',
          attributes: ['id', 'fullName', 'email', 'role', 'position'],
          required: false,
        },
      ],
    });

    if (!client) {
      // نخليها 404 عشان ما نكشفش وجود عميل مش بتاعه
      return res.status(404).json({ message: 'Client not found' });
    }

    return res.json(client);
  } catch (error) {
    console.error('getClientById error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/clients
// body: { name, crm, phoneNumber, pointOfContact, contactEmail, accountManager, accountManagerId?, contractDate, contractTerminationDate, isActive, company, clientType }
exports.createClient = async (req, res) => {
  try {
    const {
      name,
      crm,
      phoneNumber,
      pointOfContact,
      contactEmail,

      accountManager, // legacy (optional)
      accountManagerId, // ✅ NEW (optional)

      contractDate,
      contractTerminationDate,
      isActive,
      company,
      clientType,
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Client name is required' });
    }

    const user = req.user;

    // ✅ decide owner
    let finalAccountManagerId = null;

    if (canSeeAllClients(user)) {
      // admin/crm/manager can assign
      finalAccountManagerId = normalizeAccountManagerId(accountManagerId);

      // لو ما بعتش accountManagerId → سيبه null
      // أو لو عايز ديفولت لنفسه: finalAccountManagerId ??= user.id;
    } else {
      // any other user: forced to himself
      finalAccountManagerId = user.id;
    }

    const newClient = await Client.create({
      name,
      crm,
      phoneNumber,
      pointOfContact,
      contactEmail,

      accountManager: accountManager || null, // legacy
      accountManagerId: finalAccountManagerId, // ✅

      contractDate,
      contractTerminationDate,
      isActive: typeof isActive === 'boolean' ? isActive : true,
      company: normalizeCompany(company),
      clientType: normalizeClientType(clientType),
    });

    return res.status(201).json(newClient);
  } catch (error) {
    console.error('createClient error:', error);

    if (error.name === 'SequelizeValidationError') {
      const first = error.errors && error.errors[0];
      return res
        .status(400)
        .json({ message: first?.message || 'Validation error' });
    }

    return res.status(500).json({ message: 'Internal server error' });
  }
};

// PUT /api/clients/:id
// body: أي subset من الحقول
exports.updateClient = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const where = { id };
    applyClientScopeWhere(where, req.user);

    const client = await Client.findOne({ where });
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const user = req.user;

    const {
      name,
      crm,
      phoneNumber,
      pointOfContact,
      contactEmail,

      accountManager, // legacy
      accountManagerId, // ✅ NEW

      contractDate,
      contractTerminationDate,
      isActive,
      company,
      clientType,
    } = req.body;

    if (typeof name !== 'undefined') client.name = name;
    if (typeof crm !== 'undefined') client.crm = crm;
    if (typeof phoneNumber !== 'undefined') client.phoneNumber = phoneNumber;
    if (typeof pointOfContact !== 'undefined')
      client.pointOfContact = pointOfContact;
    if (typeof contactEmail !== 'undefined') client.contactEmail = contactEmail;

    // legacy
    if (typeof accountManager !== 'undefined') client.accountManager = accountManager;

    // ✅ accountManagerId update policy:
    // - admin/crm/manager يقدر يغير owner
    // - غير كده ممنوع يغيره (يتجاهل input)
    if (typeof accountManagerId !== 'undefined' && canSeeAllClients(user)) {
      client.accountManagerId = normalizeAccountManagerId(accountManagerId);
    }

    if (typeof contractDate !== 'undefined') client.contractDate = contractDate;
    if (typeof contractTerminationDate !== 'undefined')
      client.contractTerminationDate = contractTerminationDate;
    if (typeof isActive !== 'undefined') client.isActive = isActive;
    if (typeof company !== 'undefined')
      client.company = normalizeCompany(company);
    if (typeof clientType !== 'undefined')
      client.clientType = normalizeClientType(clientType);

    await client.save();

    return res.json(client);
  } catch (error) {
    console.error('updateClient error:', error);

    if (error.name === 'SequelizeValidationError') {
      const first = error.errors && error.errors[0];
      return res
        .status(400)
        .json({ message: first?.message || 'Validation error' });
    }

    return res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /api/clients/:id
exports.deleteClient = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const where = { id };
    applyClientScopeWhere(where, req.user);

    const client = await Client.findOne({ where });
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    await client.destroy();

    return res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('deleteClient error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/clients/bulk-import
// body: Array of { id?, name, crm, phoneNumber, pointOfContact, contactEmail, accountManager, accountManagerId?, contractDate, contractTerminationDate, isActive, company, clientType }
exports.bulkImportClients = async (req, res) => {
  try {
    const body = req.body;
    const rows = Array.isArray(body?.clients)
      ? body.clients
      : Array.isArray(body)
      ? body
      : null;

    if (!rows || !Array.isArray(rows)) {
      return res
        .status(400)
        .json({ message: 'Invalid payload, expected array of clients.' });
    }

    const user = req.user;
    const t = await sequelize.transaction();

    try {
      const created = [];
      const updated = [];
      const skipped = [];

      for (const raw of rows) {
        if (!raw) continue;

        const {
          id,
          name,
          crm,
          phoneNumber,
          pointOfContact,
          contactEmail,

          accountManager, // legacy
          accountManagerId, // ✅

          contractDate,
          contractTerminationDate,
          isActive,
          company,
          clientType,
        } = raw;

        if (!name || String(name).trim() === '') {
          skipped.push({ reason: 'missing-name', row: raw });
          continue;
        }

        // ✅ decide owner per row
        let rowAccountManagerId = null;
        if (canSeeAllClients(user)) {
          rowAccountManagerId = normalizeAccountManagerId(accountManagerId);
        } else {
          rowAccountManagerId = user.id;
        }

        let client = null;
        if (id) {
          const findWhere = { id: Number(id) };
          applyClientScopeWhere(findWhere, user);

          client = await Client.findOne({ where: findWhere, transaction: t });
        }

        if (client) {
          if (typeof name !== 'undefined') client.name = name;
          if (typeof crm !== 'undefined') client.crm = crm;
          if (typeof phoneNumber !== 'undefined')
            client.phoneNumber = phoneNumber;
          if (typeof pointOfContact !== 'undefined')
            client.pointOfContact = pointOfContact;
          if (typeof contactEmail !== 'undefined')
            client.contactEmail = contactEmail;

          if (typeof accountManager !== 'undefined')
            client.accountManager = accountManager;

          // ✅ owner update only for admin/crm/manager
          if (canSeeAllClients(user)) {
            client.accountManagerId = rowAccountManagerId;
          }

          if (typeof contractDate !== 'undefined')
            client.contractDate = contractDate;
          if (typeof contractTerminationDate !== 'undefined')
            client.contractTerminationDate = contractTerminationDate;
          if (typeof isActive !== 'undefined') client.isActive = isActive;
          if (typeof company !== 'undefined')
            client.company = normalizeCompany(company);
          if (typeof clientType !== 'undefined')
            client.clientType = normalizeClientType(clientType);

          await client.save({ transaction: t });
          updated.push(client.id);
        } else {
          // ✅ non-admin users can only create clients for themselves
          const createdClient = await Client.create(
            {
              name,
              crm,
              phoneNumber,
              pointOfContact,
              contactEmail,

              accountManager: accountManager || null,
              accountManagerId: rowAccountManagerId,

              contractDate,
              contractTerminationDate,
              isActive: typeof isActive === 'boolean' ? isActive : true,
              company: normalizeCompany(company),
              clientType: normalizeClientType(clientType),
            },
            { transaction: t }
          );
          created.push(createdClient.id);
        }
      }

      await t.commit();

      return res.json({
        total: rows.length,
        createdCount: created.length,
        updatedCount: updated.length,
        skippedCount: skipped.length,
      });
    } catch (err) {
      await t.rollback();
      console.error('bulkImportClients error (tx):', err);
      return res.status(500).json({ message: 'Failed to import clients' });
    }
  } catch (error) {
    console.error('bulkImportClients error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};