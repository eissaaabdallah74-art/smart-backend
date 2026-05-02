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
  formatLocalEgyptianPhone,
};

function formatLocalEgyptianPhone(raw) {
  if (!raw) return null;
  let p = String(raw).replace(/\D/g, '');
  if (!p) return null;

  if (p.startsWith('0020') && p.length >= 13) p = p.substring(3);
  else if (p.startsWith('20') && p.length >= 12) p = p.substring(2);
  else if (p.startsWith('02') && p.length >= 12) p = p.substring(2);
  
  if (p.startsWith('1') && p.length === 10) {
    p = '0' + p;
  }
  
  return p;
}
