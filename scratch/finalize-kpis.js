const { KpiElement } = require('../src/models');
const { Op } = require('sequelize');

async function finalizeKpis() {
  try {
    // 1. Delete everything except our 4 core calculation types
    const deleted = await KpiElement.destroy({
      where: {
        calculationType: {
          [Op.notIn]: [
            'account_manager_target',
            'account_manager_day1',
            'interviewer_recruitment',
            'manual'
          ]
        }
      }
    });
    console.log(`✅ Deleted ${deleted} unnecessary KPI elements.`);

    // 2. Update the names of the 4 core elements
    const updates = [
      { type: 'account_manager_target', ar: 'التارجت (Target)', en: 'Target' },
      { type: 'account_manager_day1', ar: 'أكتيف أول يوم (Day 1)', en: 'Day 1 Active' },
      { type: 'interviewer_recruitment', ar: 'التعيينات (Recruitment)', en: 'Recruitment' },
      { type: 'manual', ar: 'تقييم الإدارة (Vote)', en: 'Admin Vote' },
    ];

    for (const up of updates) {
      await KpiElement.update(
        { nameAr: up.ar, nameEn: up.en },
        { where: { calculationType: up.type } }
      );
    }
    console.log('✅ Finalized naming for the 4 core KPI elements.');

  } catch (error) {
    console.error('❌ Error finalizing KPIs:', error);
  } finally {
    process.exit();
  }
}

finalizeKpis();
