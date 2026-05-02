// src/constants/vehicle-types.js
const VEHICLE_TYPES = [
  'BIKE',      // last mile and first mile
  'BYCYCLE',   // last mile and first mile
  'TRICYCLE',  // last mile and first mile
  'SEDAN',     // last mile and first mile 
  'VAN',       // last mile and first mile 
  'TRUCK_OPEN',   // last mile and first mile and middle mile and box
  'TRUCK_CLOSED',   // last mile and first mile and middle mile and box
  'TRUCK_REFRIGERATED',   // last mile and first mile and middle mile and box
  'NKR',       // last mile and first mile and middle mile and box
  'JUMBO_4_OPEN',   // first mile and middle mile and box
  'JUMBO_4_CLOSED',   // first mile and middle mile and box
  'JUMBO_4_REFRIGERATED',   // first mile and middle mile and box
  'JUMBO_6_OPEN',   // first mile and middle mile and box
  'JUMBO_6_CLOSED',   // first mile and middle mile and box
  'JUMBO_6_REFRIGERATED',   // first mile and middle mile and box
  'HELPER',    // All Modules
];

const VEHICLE_TYPES_SET = new Set(VEHICLE_TYPES);

module.exports = { VEHICLE_TYPES, VEHICLE_TYPES_SET };