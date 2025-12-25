// src/utils/phone-normalizer.js
function normalizePhoneEG(raw) {
  if (!raw) return null;

  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('20')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);

  if (digits.length < 8) return null;

  return `20${digits}`;
}

// ✅ alias باسم normalizePhone عشان الـ controller يفضل زي ما هو
module.exports = {
  normalizePhoneEG,
  normalizePhone: normalizePhoneEG,
};
