// src/services/loans/loan-month.utils.js

function isValidMonth(month) {
  return !!month && /^\d{4}-\d{2}$/.test(String(month));
}

function monthToIndex(month) {
  // YYYY-MM -> number index for easy add/sub
  if (!isValidMonth(month)) throw new Error("Invalid month format YYYY-MM");
  const [y, m] = String(month).split("-").map(Number);
  return y * 12 + (m - 1);
}

function indexToMonth(idx) {
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`;
}

function addMonths(month, add) {
  const idx = monthToIndex(month);
  return indexToMonth(idx + Number(add || 0));
}

function getYearFromMonth(month) {
  if (!isValidMonth(month)) return null;
  return Number(String(month).slice(0, 4));
}

module.exports = { isValidMonth, monthToIndex, indexToMonth, addMonths, getYearFromMonth };
