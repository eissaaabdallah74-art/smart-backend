const { SystemAlias } = require('../models');

const coreAliases = [
  { code: 'DRIVER_NAME', name: 'Driver Name', description: 'Used to link row to master driver' },
  { code: 'NATIONAL_ID', name: 'National ID', description: 'Used as an alternative identifier for driver' },
  { code: 'SUPPLIER', name: 'Supplier / Vendor', description: 'Used for supplier commissions' },
  { code: 'VEHICLE_TYPE', name: 'Vehicle Type', description: 'Bike, Van, Car, etc.' },
  { code: 'WORKING_DAYS', name: 'Working Days', description: 'Used for fixed day calculations' },
  { code: 'UNIT_COUNT', name: 'Unit Count (Orders/Stops)', description: 'Used for per-unit calculations' },
  { code: 'EXTRA_KM', name: 'Extra KM', description: 'Extra distance calculation' },
  { code: 'BASE_SALARY', name: 'Base Salary', description: 'Gross basic salary before deductions' },
  { code: 'ORDERS_TOTAL', name: 'Orders Total Value', description: 'Total value computed from orders' },
  { code: 'KM_TOTAL', name: 'Extra KM Total Value', description: 'Total value computed from extra KMs' },
  { code: 'NET_SALARY', name: 'Net Salary', description: 'Final net salary for validation' },
  { code: 'TOTAL_SALARY', name: 'Total Overall', description: 'Final total overall for validation' },
  { code: 'DEDUCTION', name: 'General Deduction', description: 'Generic deduction' },
  { code: 'BONUS_ALLOWANCE', name: 'Bonus / Allowance', description: 'Generic bonus or allowance' },
  { code: 'SMART_COMMISSION', name: 'Smart Commission', description: 'Commission for the system' },
  { code: 'CUSTOM', name: 'Custom Metric', description: 'Any other metric' },
  { code: 'EXPECTED_NET_SALARY', name: 'Expected Net Salary', description: 'For mismatch comparison' },
  { code: 'EXPECTED_TOTAL_OVERALL', name: 'Expected Total Overall', description: 'For mismatch comparison' },
  { code: 'IGNORE', name: 'Ignored Column', description: 'Column exists in Excel but is unused' }
];

module.exports = async function seedSystemAliases() {
  console.log('Seeding System Aliases...');
  try {
    for (const alias of coreAliases) {
      const existing = await SystemAlias.findOne({ where: { code: alias.code } });
      if (!existing) {
        await SystemAlias.create({
          ...alias,
          isCore: true
        });
      } else {
        // Ensure it's marked as core
        if (!existing.isCore) {
          await existing.update({ isCore: true });
        }
      }
    }
    console.log('✅ System Aliases seeded successfully.');
  } catch (error) {
    console.error('❌ Error seeding System Aliases:', error);
  }
};
