const { KpiElement } = require('../src/models');
const { Op } = require('sequelize');

async function mergeKpis() {
  try {
    // 1. Delete specialized targets
    const deleted = await KpiElement.destroy({
      where: {
        calculationType: {
          [Op.in]: ['operation_team_target', 'supply_chain_team_target']
        }
      }
    });
    console.log(`✅ Deleted ${deleted} specialized team target elements.`);

    // 2. Update the main target name
    await KpiElement.update(
      {
        nameAr: 'تارجت التوظيف (Recruitment Target)',
        nameEn: 'Recruitment Target'
      },
      {
        where: { calculationType: 'account_manager_target' }
      }
    );
    console.log('✅ Updated Account Manager Target to Recruitment Target.');

  } catch (error) {
    console.error('❌ Error merging KPIs:', error);
  } finally {
    process.exit();
  }
}

mergeKpis();
