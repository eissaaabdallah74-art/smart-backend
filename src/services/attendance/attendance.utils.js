const dayjs = require('dayjs');

function normalizeKey(k) {
  return String(k || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[._-]+/g, ' ')
    .trim();
}

function parseYesTrue(v) {
  if (v === true) return true;
  if (v === 1) return true;
  const s = String(v || '').trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === '1';
}

// handles: "01:20", "0:15", "00:15", "1.5" (hours), number in minutes
function parseDurationToMinutes(v) {
  if (v === null || typeof v === 'undefined' || v === '') return 0;

  if (typeof v === 'number') {
    // many exports give hours as fraction, but late usually as time. We'll treat:
    // if <= 24 -> hours, else minutes
    if (v <= 24) return Math.round(v * 60);
    return Math.round(v);
  }

  const s = String(v).trim();
  if (!s) return 0;

  // HH:MM
  const m = s.match(/^(\d{1,3}):(\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);

  // "0.25" hours etc
  const n = Number(s);
  if (Number.isFinite(n)) {
    if (n <= 24) return Math.round(n * 60);
    return Math.round(n);
  }

  return 0;
}

// parse date from sheet to YYYY-MM-DD
function parseSheetDateToISO(v) {
  if (!v) return null;

  if (v instanceof Date) return dayjs(v).format('YYYY-MM-DD');

  const s = String(v).trim();
  if (!s) return null;

  // try common formats
  const d1 = dayjs(s);
  if (d1.isValid()) return d1.format('YYYY-MM-DD');

  return null;
}

// clock time could be "09:12" or datetime
function parseClockDateTime(dateISO, v) {
  if (!v) return null;
  if (v instanceof Date) return v;

  const s = String(v).trim();
  if (!s) return null;

  // time-only
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const hh = String(m[1]).padStart(2, '0');
    const mm = String(m[2]).padStart(2, '0');
    const ss = String(m[3] || '00').padStart(2, '0');
    return dayjs(`${dateISO} ${hh}:${mm}:${ss}`, 'YYYY-MM-DD HH:mm:ss').toDate();
  }

  const d = dayjs(s);
  if (d.isValid()) return d.toDate();

  return null;
}

function getMonthKeyFromISODate(dateISO) {
  return String(dateISO).slice(0, 7); // YYYY-MM
}

module.exports = {
  normalizeKey,
  parseYesTrue,
  parseDurationToMinutes,
  parseSheetDateToISO,
  parseClockDateTime,
  getMonthKeyFromISODate,
};
