const kpiService = require('./src/services/kpi.service.js');
async function test() {
  const ratio = await kpiService.getHolidayAdjustmentRatio(6, 2026, { fridayOff: true, saturdayOff: 'all' });
  console.log('Ratio:', ratio);
  
  // also check khaled eissa's target
  const res = await kpiService.calculateMonthlyKpi(50, 6, 2026); // assume id is somewhere, let's just log ratio for now
}
test().catch(console.error).finally(() => process.exit(0));
