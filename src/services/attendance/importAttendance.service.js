// src/services/attendance/importAttendance.service.js
const XLSX = require('xlsx');
const { Op } = require('sequelize');
const {
  AttendanceImport,
  AttendanceDay,
  EmployeeAttendanceProfile,
  Employee, // ✅ NEW
  sequelize,
} = require('../../models');

const {
  normalizeKey,
  parseYesTrue,
  parseDurationToMinutes,
  parseSheetDateToISO,
  parseClockDateTime,
  getMonthKeyFromISODate,
} = require('./attendance.utils');

function normalizeRowKeys(row) {
  const out = {};
  for (const k of Object.keys(row || {})) out[normalizeKey(k)] = row[k];
  return out;
}

function pick(row, ...keys) {
  for (const k of keys) {
    const nk = normalizeKey(k);
    if (Object.prototype.hasOwnProperty.call(row, nk)) return row[nk];
  }
  return null;
}

/**
 * Normalize National ID:
 * - keep digits only
 * - handle Excel scientific notation (e.g. 2.96E+13)
 * - return only if 14 digits
 */
function normalizeNationalId(value) {
  if (value === null || typeof value === 'undefined') return null;

  // If it's a number -> integer string
  if (typeof value === 'number' && Number.isFinite(value)) {
    const s = String(Math.trunc(value));
    return s.length === 14 ? s : null;
  }

  let s = String(value).trim();
  if (!s) return null;

  // handle scientific notation strings
  if (/^\d+(\.\d+)?[eE][+-]?\d+$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) s = String(Math.trunc(n));
  }

  s = s.replace(/[^\d]/g, ''); // digits only
  if (s.length !== 14) return null;

  return s;
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function importAttendanceFromBuffer({ buffer, filename, uploadedBy }) {
  const t = await sequelize.transaction();
  try {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = wb.SheetNames?.[0];
    if (!sheetName) {
      await t.rollback();
      return { ok: false, message: 'No sheets found in file' };
    }

    const ws = wb.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });

    if (!rawRows.length) {
      await t.rollback();
      return { ok: false, message: 'Empty sheet' };
    }

    // detect month from first valid date
    let month = null;
    const normalizedRows = [];
    const dateSet = new Set();

    // collect national ids found in sheet (normalized) for faster DB query
    const nidSet = new Set();

    for (const rr of rawRows) {
      const row = normalizeRowKeys(rr);

      const dateISO = parseSheetDateToISO(pick(row, 'date'));
      if (dateISO) {
        dateSet.add(dateISO);
        if (!month) month = getMonthKeyFromISODate(dateISO);
      }
      row.__dateISO = dateISO;

      // read National ID (optional)
      const nidRaw = pick(
        row,
        'national id',
        'nationalid',
        'national_id',
        'nid',
        'id number',
        'id',
        'رقم البطاقة',
        'رقم البطاقه'
      );
      const nid = normalizeNationalId(nidRaw);
      row.__nationalId = nid;
      if (nid) nidSet.add(nid);

      normalizedRows.push(row);
    }

    if (!month) {
      await t.rollback();
      return { ok: false, message: 'Could not detect month (missing Date column)' };
    }

    const imp = await AttendanceImport.create(
      {
        month,
        status: 'processing',
        originalFilename: filename || null,
        uploadedBy: uploadedBy || null,
      },
      { transaction: t }
    );

    // Build mapping for EmpNo / AC-No (fallback)
    const profiles = await EmployeeAttendanceProfile.findAll({ transaction: t });
    const byEmpNo = new Map();
    const byAcNo = new Map();
    for (const p of profiles) {
      if (p.attendanceEmpNo) byEmpNo.set(String(p.attendanceEmpNo).trim(), p.employeeId);
      if (p.attendanceAcNo) byAcNo.set(String(p.attendanceAcNo).trim(), p.employeeId);
    }

    // Build map for National ID -> employeeId
    const byNationalId = new Map();

    if (nidSet.size > 0) {
      const nidList = Array.from(nidSet);
      const chunks = chunkArray(nidList, 500);

      for (const part of chunks) {
        const emps = await Employee.findAll({
          where: { nationalId: { [Op.in]: part } },
          attributes: ['id', 'nationalId'],
          transaction: t,
        });

        for (const e of emps) {
          if (e.nationalId) byNationalId.set(String(e.nationalId).trim(), e.id);
        }
      }
    }

    const unmatchedSample = [];
    let unmatchedCount = 0;

    const dayRows = [];

    for (const row of normalizedRows) {
      const dateISO = row.__dateISO;
      if (!dateISO) continue;

      const empNo = pick(row, 'emp no', 'empno', 'emp no.');
      const acNo = pick(row, 'ac-no', 'ac no', 'ac-no.', 'acno');
      const name = pick(row, 'name');

      const empNoKey = empNo ? String(empNo).trim() : null;
      const acNoKey = acNo ? String(acNo).trim() : null;

      const nationalIdKey = row.__nationalId || null;

      // ✅ 1) Primary: match by nationalId
      let employeeId = null;
      if (nationalIdKey && byNationalId.has(nationalIdKey)) {
        employeeId = byNationalId.get(nationalIdKey);
      } else {
        // ✅ 2) Fallback: old mapping by EmpNo/AcNo (optional)
        if (empNoKey && byEmpNo.has(empNoKey)) employeeId = byEmpNo.get(empNoKey);
        else if (acNoKey && byAcNo.has(acNoKey)) employeeId = byAcNo.get(acNoKey);
      }

      const absentVal = pick(row, 'absent');
      const absent = parseYesTrue(absentVal);

      const lateMin = parseDurationToMinutes(pick(row, 'late'));

      const clockIn = parseClockDateTime(dateISO, pick(row, 'clock in', 'clockin'));
      const clockOut = parseClockDateTime(dateISO, pick(row, 'clock out', 'clockout'));

      if (!employeeId) {
        unmatchedCount += 1;

        if (unmatchedSample.length < 50) {
          unmatchedSample.push({
            date: dateISO,
            empNo: empNoKey,
            acNo: acNoKey,
            name: name || null,
            nationalId: nationalIdKey,
            late: lateMin,
            absent,
            reason: nationalIdKey ? 'nationalId_not_found' : 'no_identifier_match',
          });
        }
        continue;
      }

      dayRows.push({
        importId: imp.id,
        employeeId,
        month,
        date: dateISO,
        clockIn,
        clockOut,
        lateMinutes: lateMin,
        absent,
        rawJson: {
          empNo: empNoKey,
          acNo: acNoKey,
          name: name || null,
          nationalId: nationalIdKey,
        },
      });
    }

    // Upsert days for this import
    if (dayRows.length) {
      await AttendanceDay.bulkCreate(dayRows, {
        transaction: t,
        // خليها زي ما كانت عندك لتفادي اختلاف أسماء الأعمدة في الموديل
        updateOnDuplicate: ['clock_in', 'clock_out', 'late_minutes', 'absent', 'raw_json'],
      });
    }

    // Update import stats
    await imp.update(
      {
        status: 'done',
        workingDaysCount: dateSet.size,
        rowsCount: normalizedRows.length,
        matchedRowsCount: dayRows.length,
        unmatchedRowsCount: unmatchedCount, // ✅ الحقيقي
        unmatchedSampleJson: unmatchedSample.length ? unmatchedSample : null,
      },
      { transaction: t }
    );

    await t.commit();

    return {
      ok: true,
      importId: imp.id,
      month,
      workingDaysCount: dateSet.size,
      matchedRowsCount: dayRows.length,
      unmatchedSample,
    };
  } catch (e) {
    await t.rollback();
    throw e;
  }
}

module.exports = { importAttendanceFromBuffer };
