// src/seed/kpi-elements.seed.js
const { KpiElement } = require('../models');

const kpiElementsData = [
  {
    nameAr: 'التارجت (Account Manager)',
    nameEn: 'Target (Account Manager)',
    calculationType: 'account_manager_target',
  },
  {
    nameAr: 'أكتيف أول يوم (Day 1 Active)',
    nameEn: 'Day 1 Active',
    calculationType: 'account_manager_day1',
  },
  {
    nameAr: 'التعيين (Recruitment)',
    nameEn: 'Recruitment',
    calculationType: 'interviewer_recruitment',
  },
  {
    nameAr: 'تقييم الإدارة (Vote)',
    nameEn: 'Admin Vote',
    calculationType: 'manual',
  },
];

async function seedKpiElements() {
  try {
    for (const data of kpiElementsData) {
      await KpiElement.findOrCreate({
        where: { calculationType: data.calculationType },
        defaults: data,
      });
    }
    console.log('✅ KPI Elements seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding KPI Elements:', error);
  }
}

module.exports = seedKpiElements;
