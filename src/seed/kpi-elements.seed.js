// src/seed/kpi-elements.seed.js
const { KpiElement } = require('../models');

const kpiElementsData = [
  {
    nameAr: 'التارجت (Target)',
    nameEn: 'Target',
    calculationType: 'account_manager_target',
  },
  {
    nameAr: 'أكتيف أول يوم (Day 1)',
    nameEn: 'Day 1 Active',
    calculationType: 'account_manager_day1',
  },
  {
    nameAr: 'التعيينات (Recruitment)',
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
