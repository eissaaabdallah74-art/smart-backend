// src/constants/vehicle-types.js
const VEHICLE_TYPES = [
  'SEDAN',
  'VAN',
  'BIKE',
  'DABABA',
  'NKR',
  'TRICYCLE',
  'JUMBO_4',
  'JUMBO_6',
  'HELPER',
  'DRIVER',
  'WORKER',
];

const VEHICLE_TYPES_SET = new Set(VEHICLE_TYPES);

module.exports = { VEHICLE_TYPES, VEHICLE_TYPES_SET };
