// src/controllers/client-contracts.controller.js
const { Op } = require('sequelize');
const { Client, ClientContract, sequelize } = require('../models');
const {
  normalizeDateOnly,
  normalizeContractStatus,
  syncClientSummary,
} = require('../helpers/contracts.helper');

// GET /api/client-contracts?q=&status=&clientId=
exports.getAllContracts = async (req, res) => {
  try {
    const { q, status, clientId } = req.query;

    const where = {};
    if (status) where.status = status;
    if (clientId) where.clientId = Number(clientId);

    if (q) {
      const like = { [Op.like]: `%${q}%` };
      where[Op.or] = [{ contractNumber: like }, { notes: like }];
    }

    const contracts = await ClientContract.findAll({
      where,
      include: [{ model: Client, as: 'client', attributes: ['id', 'name'] }],
      order: [['id', 'DESC']],
    });

    return res.json(contracts);
  } catch (err) {
    console.error('getAllContracts error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/client-contracts/:id
exports.getContractById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });

    const contract = await ClientContract.findByPk(id, {
      include: [{ model: Client, as: 'client', attributes: ['id', 'name'] }],
    });

    if (!contract) return res.status(404).json({ message: 'Contract not found' });
    return res.json(contract);
  } catch (err) {
    console.error('getContractById error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/client-contracts
exports.createContract = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      clientId,
      contractNumber,
      startDate,
      endDate,
      duration,
      notes,
      status,
      renewalAlertDate,
    } = req.body;

    const cid = Number(clientId);
    if (!cid || Number.isNaN(cid)) {
      await t.rollback();
      return res.status(400).json({ message: 'clientId is required' });
    }

    const s = normalizeDateOnly(startDate);
    if (!s) {
      await t.rollback();
      return res.status(400).json({ message: 'startDate is required' });
    }

    const e = normalizeDateOnly(endDate);
    if (e && new Date(e) < new Date(s)) {
      await t.rollback();
      return res.status(400).json({ message: 'endDate must be >= startDate' });
    }

    const ra = normalizeDateOnly(renewalAlertDate);
    const st = normalizeContractStatus(status);

    const created = await ClientContract.create(
      {
        clientId: cid,
        contractNumber: contractNumber ?? null,
        startDate: s,
        endDate: e,
        duration: duration ?? null,
        notes: notes ?? null,
        status: st,
        renewalAlertDate: ra,
      },
      { transaction: t }
    );

    await syncClientSummary({ Client, ClientContract }, cid, t);
    await t.commit();

    return res.status(201).json(created);
  } catch (err) {
    await t.rollback();
    console.error('createContract error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// PUT /api/client-contracts/:id
exports.updateContract = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid id' });
    }

    const contract = await ClientContract.findByPk(id, { transaction: t });
    if (!contract) {
      await t.rollback();
      return res.status(404).json({ message: 'Contract not found' });
    }

    const payload = { ...req.body };

    if (payload.startDate !== undefined) payload.startDate = normalizeDateOnly(payload.startDate);
    if (payload.endDate !== undefined) payload.endDate = normalizeDateOnly(payload.endDate);
    if (payload.renewalAlertDate !== undefined)
      payload.renewalAlertDate = normalizeDateOnly(payload.renewalAlertDate);
    if (payload.status !== undefined) payload.status = normalizeContractStatus(payload.status);

    const s = payload.startDate ?? contract.startDate;
    const e = payload.endDate ?? contract.endDate;
    if (s && e && new Date(e) < new Date(s)) {
      await t.rollback();
      return res.status(400).json({ message: 'endDate must be >= startDate' });
    }

    await contract.update(payload, { transaction: t });

    await syncClientSummary({ Client, ClientContract }, contract.clientId, t);
    await t.commit();

    return res.json(contract);
  } catch (err) {
    await t.rollback();
    console.error('updateContract error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /api/client-contracts/:id
exports.deleteContract = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid id' });
    }

    const contract = await ClientContract.findByPk(id, { transaction: t });
    if (!contract) {
      await t.rollback();
      return res.status(404).json({ message: 'Contract not found' });
    }

    const cid = contract.clientId;
    await contract.destroy({ transaction: t });

    await syncClientSummary({ Client, ClientContract }, cid, t);
    await t.commit();

    return res.json({ message: 'Contract deleted successfully' });
  } catch (err) {
    await t.rollback();
    console.error('deleteContract error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/client-contracts/bulk-import
// body: Array أو { contracts: Array }
exports.bulkImportContracts = async (req, res) => {
  const body = req.body;
  const rows = Array.isArray(body?.contracts) ? body.contracts : Array.isArray(body) ? body : null;

  if (!rows) {
    return res.status(400).json({ message: 'Invalid payload, expected array of contracts.' });
  }

  const t = await sequelize.transaction();
  try {
    let createdClients = 0;
    let createdContracts = 0;
    let updatedContracts = 0;
    let skipped = 0;

    for (const raw of rows) {
      if (!raw) continue;

      const clientName = (raw.clientName ?? raw['اسم الشركة'] ?? raw.name ?? '').toString().trim();
      const contractNumber = (raw.contractNumber ?? raw['رقم العقد'] ?? raw.crm ?? null);
      const startDate = normalizeDateOnly(raw.startDate ?? raw['تاريخ بداية العقد']);
      const endDate = normalizeDateOnly(raw.endDate ?? raw['تاريخ نهاية العقد']);
      const duration = (raw.duration ?? raw['مدة العقد'] ?? null);
      const notes = (raw.notes ?? raw['ملاحظات'] ?? null);
      const status = normalizeContractStatus(raw.status ?? raw['حالة العقد']);
      const renewalAlertDate = normalizeDateOnly(raw.renewalAlertDate ?? raw['تنبيه التجديد']);

      if (!clientName || !startDate) {
        skipped++;
        continue;
      }

      // 1) نجيب أو ننشئ Client
      let client = await Client.findOne({ where: { name: clientName }, transaction: t });
      if (!client) {
        client = await Client.create(
          {
            name: clientName,
            crm: contractNumber ? String(contractNumber) : null, // اختياري: ممكن تسيبه null
            isActive: true,
            company: '1',
            companyCode: 'SMV',
            contractDate: startDate,
            contractTerminationDate: null,
          },
          { transaction: t }
        );
        createdClients++;
      }

      // 2) upsert contract by (clientId + contractNumber) لو رقم العقد موجود
      let existing = null;
      if (contractNumber) {
        existing = await ClientContract.findOne({
          where: { clientId: client.id, contractNumber: String(contractNumber) },
          transaction: t,
        });
      }

      if (existing) {
        await existing.update(
          {
            startDate,
            endDate,
            duration: duration ? String(duration) : null,
            notes: notes ? String(notes) : null,
            status,
            renewalAlertDate,
          },
          { transaction: t }
        );
        updatedContracts++;
      } else {
        await ClientContract.create(
          {
            clientId: client.id,
            contractNumber: contractNumber ? String(contractNumber) : null,
            startDate,
            endDate,
            duration: duration ? String(duration) : null,
            notes: notes ? String(notes) : null,
            status,
            renewalAlertDate,
          },
          { transaction: t }
        );
        createdContracts++;
      }

      await syncClientSummary({ Client, ClientContract }, client.id, t);
    }

    await t.commit();

    return res.json({
      total: rows.length,
      createdClients,
      createdContracts,
      updatedContracts,
      skipped,
    });
  } catch (err) {
    await t.rollback();
    console.error('bulkImportContracts error:', err);
    return res.status(500).json({ message: 'Failed to import contracts' });
  }
};
