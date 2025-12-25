// src/services/driver-sync.service.js
const { Interview, Driver, Client, Hub, Zone, Auth } = require('../models');

const INTERVIEW_INCLUDES = [
  { model: Client, as: 'client', attributes: ['id', 'name'] },
  { model: Hub, as: 'hub', attributes: ['id', 'name'] },
  { model: Zone, as: 'zone', attributes: ['id', 'name'] },
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

function deriveContractStatus(interview) {
  // استخدم signedWithHr لو موجود، وإلا استنتج من hrFeedback
  if (interview.signedWithHr) return interview.signedWithHr;
  if (isHrSigned(interview)) return 'Signed A Contract With HR';
  return null;
}

function deriveHiringStatus(interview) {
  // عندك في Interview اسمها courierStatus، وعندك في Driver اسمها hiringStatus
  return interview.courierStatus ?? null;
}

/**
 * Upsert Driver from Interview (by phoneNumber)
 * - يملأ clientName/hub/area من الـ relations (client/hub/zone)
 * - يملأ vehicleType, hiringStatus, contractStatus, signed
 */
async function upsertDriverFromInterviewId(interviewId, { transaction } = {}) {
  const interview = await Interview.findByPk(interviewId, {
    include: INTERVIEW_INCLUDES,
    transaction,
  });

  if (!interview) return null;

  const phone = normPhone(interview.phoneNumber);
  if (!phone) return null;

  const payload = {
    name: interview.courierName || '—',
    courierPhone: phone,

    residence: interview.residence ?? null,

    clientName: interview.client?.name ?? null,
    hub: interview.hub?.name ?? null,

    // غالبًا zone هي الـ "Area" عندك
    area: interview.zone?.name ?? null,

    vehicleType: interview.vehicleType ?? null,

    hiringStatus: deriveHiringStatus(interview),
    contractStatus: deriveContractStatus(interview),

    signed: !!isHrSigned(interview),
  };

  // لو عندك day1Date في Interview DB ومش متسجل في الموديل، هيفضل null هنا
  // لو ضفت day1Date للموديل هينقل تلقائيًا
  if (Object.prototype.hasOwnProperty.call(interview, 'day1Date')) {
    payload.day1Date = interview.day1Date ?? null;
  }

  // Upsert by courierPhone
  const existing = await Driver.findOne({
    where: { courierPhone: phone },
    transaction,
  });

  if (!existing) {
    const created = await Driver.create(payload, { transaction });
    return { driver: created, created: true };
  }

  await existing.update(payload, { transaction });
  return { driver: existing, created: false };
}

/**
 * Backfill: create/update drivers for all interviews
 */
async function backfillDriversFromInterviews({ transaction } = {}) {
  const interviews = await Interview.findAll({
    attributes: ['id'],
    order: [['id', 'ASC']],
    transaction,
  });

  let created = 0;
  let updated = 0;

  for (const row of interviews) {
    const res = await upsertDriverFromInterviewId(row.id, { transaction });
    if (res?.created) created += 1;
    else if (res) updated += 1;
  }

  return { created, updated, total: interviews.length };
}

module.exports = {
  upsertDriverFromInterviewId,
  backfillDriversFromInterviews,
};
