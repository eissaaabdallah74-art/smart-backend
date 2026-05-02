// src/services/driver-sync.service.js
const { Interview, Driver, Client, Hub, Zone, Auth, Vendor } = require('../models');
const {
  DRIVER_CONTRACT_STATUSES,
  SIGNED_WITH_HR_STATUSES,
} = require('../constants/enums');

const INTERVIEW_INCLUDES = [
  { model: Client, as: 'client', attributes: ['id', 'name', 'pointOfContact'] },
  { model: Hub, as: 'hub', attributes: ['id', 'name'] },
  { model: Zone, as: 'zone', attributes: ['id', 'name'] },
  { model: Vendor, as: 'vendor', attributes: ['id', 'name', 'code'] },
  { model: Auth, as: 'accountManager', attributes: ['id', 'fullName'] },
  { model: Auth, as: 'interviewer', attributes: ['id', 'fullName'] },
];

function normPhone(v) {
  if (!v) return null;
  const x = String(v).replace(/[^\d]/g, '');
  return x || null;
}

function isHrSigned(interview) {
  const hr = (interview.hrFeedback || '').toString().toLowerCase();
  return hr.includes('signed');
}

/** ===== Normalizers (to protect ENUM writes) ===== */

function normalizeDriverContractStatus(v) {
  if (v === null || v === undefined || v === '') return null;
  const x = String(v).trim().toLowerCase();

  if (x === 'active') return 'Active';
  if (x === 'inactive') return 'Inactive';
  if (x === 'resigned') return 'Resigned';
  if (x === 'hold zone' || x === 'holdzone' || x === 'hold') return 'Hold zone';

  if (
    x === 'unreachable/reschedule' ||
    x === 'unreachable' ||
    x === 'reschedule' ||
    x === 'unreachable - reschedule'
  ) {
    return 'Unreachable/Reschedule';
  }

  return null;
}

function normalizeSignedWithHr(v) {
  if (v === null || v === undefined || v === '') return null;
  const x = String(v).trim().toLowerCase();

  if (x === 'signed a contract with hr' || x === 'signed') {
    return 'Signed A Contract With HR';
  }
  if (x === 'will think about our offers' || x === 'will think') {
    return 'Will Think About Our Offers';
  }
  if (x === 'missing documents' || x === 'missing docs') {
    return 'Missing documents';
  }
  if (x === 'unqualified') {
    return 'Unqualified';
  }

  // If already exact value, keep it (ENUM exact match)
  if (SIGNED_WITH_HR_STATUSES.includes(v)) return v;

  return null;
}

function deriveSignedWithHr(interview) {
  const normalized = normalizeSignedWithHr(interview.signedWithHr);
  if (normalized) return normalized;

  if (isHrSigned(interview)) return 'Signed A Contract With HR';

  return null;
}

function deriveDriverContractStatus(interview) {
  const normalized = normalizeDriverContractStatus(interview.courierStatus);
  if (normalized) return normalized;

  return null;
}

function deriveHiringStatus(interview) {
  return interview.courierStatus ?? null;
}

/**
 * Upsert Driver from Interview (by phoneNumber)
 */
async function upsertDriverFromInterviewId(interviewId, { transaction, audit } = {}) {
  const interview = await Interview.findByPk(interviewId, {
    include: INTERVIEW_INCLUDES,
    transaction,
  });

  if (!interview) return null;

  const phone = normPhone(interview.phoneNumber);
  if (!phone) return null;

  // ✅ NEW: vendor is mandatory
  const vendorId = Number(interview.vendorId);
  if (!vendorId || Number.isNaN(vendorId)) {
    const err = new Error('Interview.vendorId is required to sync Driver');
    err.statusCode = 400;
    throw err;
  }

  const signedWithHr = deriveSignedWithHr(interview);

  const payload = {
    vendorId,

    name: interview.courierName || '—',
    courierPhone: phone,
    courierId: interview.courierId ?? null,
    nationalId: interview.nationalId ?? null,

    residence: interview.residence ?? null,

    clientName: interview.client?.name ?? null,
    pointOfContact: interview.client?.pointOfContact ?? null, // ✅ Map Point of Contact from Client
    hub: interview.hub?.name ?? null,
    area: interview.zone?.name ?? null,

    contractor: interview.vendor?.name ?? null, // ✅ Map Vendor Name to Contractor
    accountManager: interview.accountManager?.fullName ?? null, // ✅ Map names
    interviewer: interview.interviewer?.fullName ?? null,
    hrRepresentative: interview.interviewer?.fullName ?? null, // ✅ Default to interviewer

    vehicleType: interview.vehicleType ?? null,
    vehiclePlateNumber: interview.vehiclePlateNumber ?? null,
    module: interview.module ?? null,

    hiringStatus: deriveHiringStatus(interview),
    securityQueryStatus: interview.securityResult ?? null, // ✅ Map Security
    securityQueryComment: interview.notes ?? null,

    contractStatus: deriveDriverContractStatus(interview),
    signedWithHr,

    signed: !!isHrSigned(interview) || signedWithHr === 'Signed A Contract With HR',

    vLicenseExpiryDate: interview.vLicenseExpiryDate ?? null,
    dLicenseExpiryDate: interview.dLicenseExpiryDate ?? null,
    idExpiryDate: interview.idExpiryDate ?? null,
  };

  const day1Date =
    typeof interview.get === 'function' ? interview.get('day1Date') : interview.day1Date;
  if (typeof day1Date !== 'undefined') {
    payload.day1Date = day1Date ?? null;
  }

  const hiringDate =
    typeof interview.get === 'function' ? interview.get('hiringDate') : interview.hiringDate;
  if (typeof hiringDate !== 'undefined') {
    payload.hiringDate = hiringDate ?? null;
  }

  const existing = await Driver.findOne({
    where: { courierPhone: phone },
    transaction,
  });

  if (!existing) {
    const created = await Driver.create(payload, { transaction, audit });
    return { driver: created, created: true };
  }

  await existing.update(payload, { transaction, audit });
  return { driver: existing, created: false };
}

/**
 * Backfill: create/update drivers for all interviews
 */
async function backfillDriversFromInterviews({ transaction, audit } = {}) {
  const interviews = await Interview.findAll({
    attributes: ['id'],
    order: [['id', 'ASC']],
    transaction,
  });

  let created = 0;
  let updated = 0;

  for (const row of interviews) {
    const res = await upsertDriverFromInterviewId(row.id, { transaction, audit });
    if (res?.created) created += 1;
    else if (res) updated += 1;
  }

  return { created, updated, total: interviews.length };
}

module.exports = {
  upsertDriverFromInterviewId,
  backfillDriversFromInterviews,
};