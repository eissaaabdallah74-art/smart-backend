const { Op } = require('sequelize');
const { Client, sequelize } = require('../models');

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

// GET /api/clients
// اختياري q للبحث العام: ?q=aramex
exports.getAllClients = async (req, res) => {
  try {
    const { q } = req.query;
    const where = {};

    if (q) {
      const like = { [Op.like]: `%${q}%` };
      where[Op.or] = [
        { name: like },
        { crm: like },
        { pointOfContact: like },
        { contactEmail: like },
        { accountManager: like },
        // إضافة الحقول الجديدة للبحث
        { clientType: like },
        { company: like },
      ];
    }

    const clients = await Client.findAll({
      where,
      order: [['id', 'ASC']],
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

    const client = await Client.findByPk(id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    return res.json(client);
  } catch (error) {
    console.error('getClientById error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/clients
// body: { name, crm, phoneNumber, pointOfContact, contactEmail, accountManager, contractDate, contractTerminationDate, isActive, company, clientType }
exports.createClient = async (req, res) => {
  try {
    const {
      name,
      crm,
      phoneNumber,
      pointOfContact,
      contactEmail,
      accountManager,
      // الحقول الجديدة
      contractDate,
      contractTerminationDate,
      isActive,
      company,
      clientType,
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Client name is required' });
    }

    const newClient = await Client.create({
      name,
      crm,
      phoneNumber,
      pointOfContact,
      contactEmail,
      accountManager,
      // الحقول الجديدة
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

    const client = await Client.findByPk(id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const {
      name,
      crm,
      phoneNumber,
      pointOfContact,
      contactEmail,
      accountManager,
      // الحقول الجديدة
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
    if (typeof accountManager !== 'undefined')
      client.accountManager = accountManager;
    // تحديث الحقول الجديدة
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

    const client = await Client.findByPk(id);
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
// body: Array of { id?, name, crm, phoneNumber, pointOfContact, contactEmail, accountManager, contractDate, contractTerminationDate, isActive, company, clientType }
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
          accountManager,
          // الحقول الجديدة
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

        let client = null;
        if (id) {
          client = await Client.findByPk(Number(id), { transaction: t });
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
          // تحديث الحقول الجديدة
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
          const createdClient = await Client.create(
            {
              name,
              crm,
              phoneNumber,
              pointOfContact,
              contactEmail,
              accountManager,
              // الحقول الجديدة
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
