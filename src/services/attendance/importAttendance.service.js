const XLSX = require('xlsx');
const { Op } = require('sequelize');
const {
  AttendanceImport,
  AttendanceDay,
  EmployeeAttendanceProfile,
  Employee,
  AttendanceRawLog,
  EmployeeDeviceMapping,
  Auth,
  sequelize,
} = require('../../models');

const dayjs = require('dayjs');

const {
  normalizeKey,
  parseYesTrue,
  parseDurationToMinutes,
  parseSheetDateToISO,
  parseClockDateTime,
  getMonthKeyFromISODate,
} = require('./attendance.utils');

function getMonthBounds(month) {
  const [y, m] = String(month).split("-").map((x) => Number(x));
  const lastDay = new Date(y, m, 0).getDate();
  return {
    start: `${month}-01`,
    end: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

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

function normalizeNationalId(value) {
  if (value === null || typeof value === 'undefined') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const s = String(Math.trunc(value));
    return s.length === 14 ? s : null;
  }
  let s = String(value).trim();
  if (!s) return null;
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

async function syncAttendanceFromRawLogs({ month, uploadedBy, startTime = "09:00" }) {
  const t = await sequelize.transaction();
  try {
    const { start, end } = getMonthBounds(month);

    // 1. Fetch all raw logs for the month
    const logs = await AttendanceRawLog.findAll({
      where: {
        punchTime: {
          [Op.between]: [new Date(`${start} 00:00:00`), new Date(`${end} 23:59:59`)]
        }
      },
      order: [['punchTime', 'ASC']],
      transaction: t
    });

    if (!logs.length) {
      await t.rollback();
      return { ok: false, message: 'No logs found for this month' };
    }

    // 2. Fetch all mappings
    const mappings = await EmployeeDeviceMapping.findAll({ transaction: t });
    const mappingMap = new Map();
    for (const m of mappings) {
      mappingMap.set(`${m.attendanceDeviceId}-${m.deviceUserId}`, m.employeeId);
    }

    // 3. Group logs by employee and date
    const grouped = {}; // employeeId -> date -> logs[]
    const dateSet = new Set();

    for (const log of logs) {
      const empId = mappingMap.get(`${log.attendanceDeviceId}-${log.deviceUserId}`);
      if (!empId) continue;

      const dateStr = dayjs(log.punchTime).format('YYYY-MM-DD');
      dateSet.add(dateStr);

      if (!grouped[empId]) grouped[empId] = {};
      if (!grouped[empId][dateStr]) grouped[empId][dateStr] = [];
      grouped[empId][dateStr].push(log);
    }

    // 4. Create Import record
    const imp = await AttendanceImport.create({
      month,
      status: 'processing',
      originalFilename: `SYNC_FROM_DEVICE_${startTime.replace(':', '')}`,
      uploadedBy
    }, { transaction: t });

    // 5. Build Day records
    const dayRows = [];
    const [startH, startM] = startTime.split(':').map(Number);

    // Fetch auth policies for custom attendance time
    const authUsers = await Auth.findAll({
      where: { id: Object.keys(grouped).map(Number) },
      attributes: ['id', 'weekendPolicy'],
      transaction: t
    });
    const userPolicyMap = new Map();
    for (const u of authUsers) {
      let policy = u.weekendPolicy;
      if (typeof policy === 'string') {
        try { policy = JSON.parse(policy); } catch(e) { policy = {}; }
      }
      userPolicyMap.set(u.id, policy || {});
    }

    for (const empIdStr of Object.keys(grouped)) {
      const employeeId = parseInt(empIdStr, 10);
      const dates = grouped[empIdStr];

      let empStartH = startH;
      let empStartM = startM;
      const policy = userPolicyMap.get(employeeId);
      if (policy && policy.attendanceTime) {
        const parts = policy.attendanceTime.split(':');
        if (parts.length >= 2) {
          empStartH = parseInt(parts[0], 10);
          empStartM = parseInt(parts[1], 10);
        }
      }

      for (const dateISO of Object.keys(dates)) {
        const dayLogs = dates[dateISO];
        const clockIn = dayLogs[0].punchTime;
        const clockOut = dayLogs.length > 1 ? dayLogs[dayLogs.length - 1].punchTime : null;

        // Calculate late minutes
        const refStartTime = dayjs(dateISO).hour(empStartH).minute(empStartM).second(0);
        const actualIn = dayjs(clockIn);
        const lateMinutes = Math.max(0, actualIn.diff(refStartTime, 'minute'));

        dayRows.push({
          importId: imp.id,
          employeeId,
          month,
          date: dateISO,
          clockIn,
          clockOut,
          lateMinutes,
          absent: false,
          rawJson: { source: 'device_sync', logsCount: dayLogs.length, shiftStart: startTime }
        });
      }
    }

    // 6. Bulk Create Days
    if (dayRows.length) {
      await AttendanceDay.bulkCreate(dayRows, { transaction: t });
    }

    // 7. Update Import
    await imp.update({
      status: 'done',
      workingDaysCount: dateSet.size,
      rowsCount: logs.length,
      matchedRowsCount: dayRows.length,
      unmatchedRowsCount: 0 
    }, { transaction: t });

    await t.commit();
    return { ok: true, importId: imp.id, month, matchedRowsCount: dayRows.length };

  } catch (error) {
    await t.rollback();
    throw error;
  }
}

async function importAttendanceFromBuffer({ buffer, filename, uploadedBy }) {
  // ... (rest of the file)

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

    // Fetch auth policies to adjust late minutes if custom attendance time is set
    const authUsersForImport = await Auth.findAll({
      attributes: ['id', 'weekendPolicy'],
      transaction: t
    });
    const authUserPolicyMap = new Map();
    for (const u of authUsersForImport) {
      authUserPolicyMap.set(u.id, u.weekendPolicy || {});
    }

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

      let lateMin = parseDurationToMinutes(pick(row, 'late'));

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

      if (employeeId && clockIn) {
        const policy = authUserPolicyMap.get(employeeId);
        if (policy && policy.attendanceTime) {
          const parts = policy.attendanceTime.split(':');
          if (parts.length >= 2) {
            const empStartH = parseInt(parts[0], 10);
            const empStartM = parseInt(parts[1], 10);
            const refStartTime = dayjs(dateISO).hour(empStartH).minute(empStartM).second(0);
            const actualIn = dayjs(clockIn);
            // Re-calculate late minutes overriding ZKTeco if custom time is provided
            lateMin = Math.max(0, actualIn.diff(refStartTime, 'minute'));
          }
        }
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

module.exports = { importAttendanceFromBuffer, syncAttendanceFromRawLogs };
