const kpiService = require('../src/services/kpi.service.js');
const { Auth, UserKpiConfig } = require('../src/models');

async function test() {
  try {
    const users = await Auth.findAll({ where: { fullName: 'khaled Eissa' } });
    if (!users.length) {
      console.log('User not found');
      return;
    }
    const user = users[0];
    console.log('User Position:', user.position);

    const configs = await UserKpiConfig.findAll({ where: { authUserId: user.id } });
    console.log('DB Configs:', configs.map(c => ({
      kpiElementId: c.kpiElementId,
      targetValue: c.targetValue,
      managerRollupTarget: c.managerRollupTarget
    })));

    const kpiReport = await kpiService.calculateMonthlyKpi(user.id, 6, 2026);
    const targetEl = kpiReport.elements.find(e => e.calculationType === 'account_manager_target');
    console.log('Report Elements:', kpiReport.elements.map(e => ({
      type: e.calculationType,
      target: e.targetValue,
      achieved: e.achievedValue
    })));

    const ratio = await kpiService.getHolidayAdjustmentRatio(6, 2026, user.weekendPolicy);
    console.log('Holiday Ratio:', ratio);
  } catch(e) {
    console.error(e);
  }
}
test().finally(() => process.exit(0));
