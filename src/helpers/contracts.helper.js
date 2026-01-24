// src/helpers/contracts.helper.js
const { Op } = require('sequelize');

function normalizeDateOnly(value) {
  if (value === null || value === undefined || value === '') return null;

  // Excel serial number (لو جايلك من import بالفرونت)
  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return date.toISOString().split('T')[0];
  }

  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }

  const str = String(value).trim();
  if (!str) return null;

  // دعم "YYYY/MM/DD" و "YYYY-MM-DD"
  const normalized = str.replace(/\//g, '-');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;

  return d.toISOString().split('T')[0];
}

function normalizeContractStatus(value) {
  if (!value) return 'active';
  const s = String(value).trim().toLowerCase();

  // Arabic
  if (s.includes('ساري')) return 'active';
  if (s.includes('منتهي')) return 'expired';
  if (s.includes('فسخ')) return 'terminated';

  // English
  if (['active', 'valid', 'running'].includes(s)) return 'active';
  if (['expired', 'ended', 'finished'].includes(s)) return 'expired';
  if (['terminated', 'canceled', 'cancelled'].includes(s)) return 'terminated';

  return 'active';
}

/**
 * يحدّث summary fields في clients:
 * - isActive: true لو فيه contract status=active
 * - contractDate: startDate للـ active contract لو موجود، وإلا آخر startDate
 * - contractTerminationDate: endDate للـ active (أو آخر endDate) عند عدم وجود active
 */
async function syncClientSummary(models, clientId, transaction) {
  const { Client, ClientContract } = models;

  const contracts = await ClientContract.findAll({
    where: { clientId },
    order: [
      ['startDate', 'DESC'],
      ['id', 'DESC'],
    ],
    transaction,
  });

  if (!contracts.length) return;

  const active = contracts.find((c) => c.status === 'active') || null;
  const latest = contracts[0];

  const isActive = !!active;
  const contractDate = (active?.startDate || latest.startDate || null) ?? null;

  // لو مفيش active => termination date من آخر endDate لو موجود
  let termination = null;
  if (!isActive) {
    termination = latest.endDate || null;
  }

  await Client.update(
    {
      isActive,
      contractDate,
      contractTerminationDate: termination,
    },
    { where: { id: clientId }, transaction }
  );
}

module.exports = {
  normalizeDateOnly,
  normalizeContractStatus,
  syncClientSummary,
};
