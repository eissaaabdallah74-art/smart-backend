// src/services/kpi.service.js
const {
  KpiElement,
  UserKpiConfig,
  UserKpiEvaluation,
  Auth,
  Interview,
  sequelize,
  PublicHoliday,
  SystemSetting,
} = require('../models');
const { Op } = require('sequelize');

class KpiService {
  /**
   * Get all available KPI Elements
   */
  async getAllKpiElements() {
    return await KpiElement.findAll({
      where: { isActive: true },
      order: [['id', 'ASC']],
    });
  }

  /**
   * Update User's KPI configurations
   * @param {number} authUserId
   * @param {number} kpiAmount
   * @param {Array} configs - Array of { kpiElementId, weightPercentage, targetValue }
   */
  async updateUserKpiConfig(authUserId, kpiAmount, configs) {
    const transaction = await sequelize.transaction();
    try {
      // 1. Update Auth user kpiAmount
      await Auth.update(
        { kpiAmount },
        { where: { id: authUserId }, transaction }
      );

      // 2. Delete existing configs
      await UserKpiConfig.destroy({
        where: { authUserId },
        transaction,
      });

      // 3. Create new configs
      if (configs && configs.length > 0) {
        const configData = configs.map((c) => ({
          authUserId,
          kpiElementId: c.kpiElementId,
          weightPercentage: c.weightPercentage,
          targetValue: c.targetValue,
          managerRollupTarget: c.managerRollupTarget !== undefined ? c.managerRollupTarget : c.targetValue,
        }));
        await UserKpiConfig.bulkCreate(configData, { transaction });

        // 4. Sync interviewTarget back to Auth if account_manager_target is present
        const personalTargetElement = await KpiElement.findOne({
          where: { calculationType: 'account_manager_target' },
          transaction
        });

        if (personalTargetElement) {
          const personalConfig = configs.find(c => c.kpiElementId === personalTargetElement.id);
          if (personalConfig) {
            await Auth.update(
              { interviewTarget: personalConfig.targetValue || 0 },
              { where: { id: authUserId }, transaction }
            );
          }
        }
      }

      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get User's KPI configuration
   */
  async getUserKpiConfig(authUserId) {
    const user = await Auth.findByPk(authUserId, {
      attributes: ['id', 'fullName', 'kpiAmount', 'position', 'weekendPolicy'],
    });

    if (!user) throw new Error('User not found');

    const configs = await UserKpiConfig.findAll({
      where: { authUserId },
      include: [
        {
          model: KpiElement,
          as: 'kpiElement',
        },
      ],
    });

    return {
      user,
      configs,
    };
  }

  /**
   * Submit Manual KPI Evaluation (e.g. Admin Vote)
   */
  async submitManualEvaluation(userKpiConfigId, month, year, achievedValue, evaluatedById) {
    // Upsert evaluation for the month/year
    const existing = await UserKpiEvaluation.findOne({
      where: { userKpiConfigId, month, year },
    });

    if (existing) {
      existing.achievedValue = achievedValue;
      existing.evaluatedById = evaluatedById;
      await existing.save();
      return existing;
    } else {
      return await UserKpiEvaluation.create({
        userKpiConfigId,
        month,
        year,
        achievedValue,
        evaluatedById,
      });
    }
  }

  /**
   * Calculate Monthly KPI for a User
   */
  async calculateMonthlyKpi(authUserId, month, year) {
    const { user, configs } = await this.getUserKpiConfig(authUserId);

    if (!user || !configs.length) {
      return { totalEarned: 0, kpiAmount: user ? user.kpiAmount : 0, elements: [] };
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const holidayRatio = await this.getHolidayAdjustmentRatio(month, year, user.weekendPolicy);

    let totalEarned = 0;
    const elementsResult = [];

    const baseKpiAmount = parseFloat(user.kpiAmount) || 0;

    const isLeadership = ['manager', 'supervisor', 'senior'].includes(user.position?.toLowerCase());
    const subIds = await this.getAllSubordinateIds(authUserId);
    const numericSubIds = subIds.map(id => Number(id));

    for (const config of configs) {
      const element = config.kpiElement;
      let targetValue = parseFloat(config.targetValue) || 0; 

      // Apply Public Holiday adjustment for fixed target types (excluding manual votes)
      if (targetValue > 0 && element.calculationType !== 'manual') {
        targetValue = Math.round(targetValue * holidayRatio);
      }

      const weight = parseFloat(config.weightPercentage) || 0;
      const maxAmountForElement = (weight / 100) * baseKpiAmount;
      
      const isHierarchicalType = [
        'account_manager_target',
        'account_manager_day1',
        'interviewer_recruitment',
        'recruitment',
        'day1'
      ].includes(element.calculationType);

      let achievedValue = 0;
      let dynamicTargetOverride = null;

      // 2. Calculate values based on Calculation Type
      const allRelevantIds = [authUserId, ...numericSubIds];
      const targetIds = (isLeadership && numericSubIds.length > 0) ? allRelevantIds : [authUserId];

      if (element.calculationType === 'account_manager_target') {
        // Achievement: Signed with HR (for Account Managers) - based on creation/signing date
        achievedValue = await Interview.count({
          where: {
            accountManagerId: { [Op.in]: targetIds },
            signedWithHr: { [Op.in]: ['Signed A Contract With HR', 'hiring from hold'] },
            createdAt: { [Op.between]: [startDate, endDate] },
          },
        });
      } else if (element.calculationType === 'account_manager_day1' || element.calculationType === 'day1') {
        // Achievement: Actually started (day1Date is set) OR CRM approved it (crmDay1ApprovedAt is set) in this month
        achievedValue = await Interview.count({
          where: {
            accountManagerId: { [Op.in]: targetIds },
            [Op.or]: [
              { day1Date: { [Op.between]: [startDate, endDate] } },
              { crmDay1ApprovedAt: { [Op.between]: [startDate, endDate] } }
            ]
          },
        });
        // Target: Signed with HR in this month (Denominator for conversion)
        const signedCount = await Interview.count({
          where: {
            accountManagerId: { [Op.in]: targetIds },
            signedWithHr: { [Op.in]: ['Signed A Contract With HR', 'hiring from hold'] },
            createdAt: { [Op.between]: [startDate, endDate] },
          },
        });
        dynamicTargetOverride = signedCount;
      } else if (element.calculationType === 'interviewer_recruitment' || element.calculationType === 'recruitment') {
        // Achievement: Signed with HR from interviews CONDUCTED in this month
        achievedValue = await Interview.count({
          where: {
            interviewerId: { [Op.in]: targetIds },
            signedWithHr: 'Signed A Contract With HR',
            date: { [Op.between]: [startDate, endDate] },
          },
        });
        // Target: Total Interviews conducted in this month that are Signed or Will Think
        const totalInterviews = await Interview.count({
          where: {
            interviewerId: { [Op.in]: targetIds },
            date: { [Op.between]: [startDate, endDate] },
            signedWithHr: {
              [Op.in]: ['Signed A Contract With HR', 'Will Think About Our Offers']
            }
          },
        });
        dynamicTargetOverride = totalInterviews;
      }
 else if (element.calculationType === 'manual') {
        const evalRecord = await UserKpiEvaluation.findOne({
          where: { userKpiConfigId: config.id, month, year },
        });
        achievedValue = evalRecord ? parseFloat(evalRecord.achievedValue) : 0;
        targetValue = 10; // Vote is out of 10
      }

      // 3. Calculate dynamic target for FIXED types (Hierarchical Target Summing)
      if (element.calculationType === 'account_manager_target' && isLeadership && numericSubIds.length > 0) {
        // Fetch ALL fixed targets from the entire subtree
        const subConfigs = await UserKpiConfig.findAll({
          where: { authUserId: { [Op.in]: numericSubIds } },
          include: [{
            model: KpiElement,
            as: 'kpiElement',
            where: { calculationType: element.calculationType }
          }]
        });
        
        const subordinatesSum = subConfigs.reduce((sum, c) => {
           const val = parseFloat(c.managerRollupTarget !== null && c.managerRollupTarget !== undefined ? c.managerRollupTarget : c.targetValue) || 0;
           return sum + val;
        }, 0);
        
        // Sum the adjusted manager target and adjusted subordinates total
        dynamicTargetOverride = targetValue + Math.round(subordinatesSum * holidayRatio);
      }

      // 4. Apply Dynamic Target Override (Hierarchical Sum or Conversion Denominator)
      if (dynamicTargetOverride !== null) {
        targetValue = dynamicTargetOverride;
      }

      // 5. Final safety: Target cannot be 0 for ratio
      const finalTarget = targetValue || 1;


      // 4. Calculate earned ratio (Capped at 1.0 based on user requirements for now)
      let achievementRatio = achievedValue / finalTarget;
      
      if (element.calculationType === 'interviewer_recruitment' || element.calculationType === 'recruitment') {
        if (achievementRatio >= 0.75) {
          achievementRatio = 1.0;
        } else {
          achievementRatio = achievementRatio / 0.75;
        }
      }

      if (achievementRatio > 1) {
        achievementRatio = 1; // Cap at 100% of target
      }

      const earnedAmount = maxAmountForElement * achievementRatio;
      totalEarned += earnedAmount;

      elementsResult.push({
        kpiElementId: element.id,
        nameAr: element.nameAr,
        nameEn: element.nameEn,
        calculationType: element.calculationType,
        weightPercentage: weight,
        targetValue: finalTarget,
        achievedValue,
        maxAmount: maxAmountForElement,
        earnedAmount,
        achievementRatio: achievementRatio * 100, // as percentage
      });
    }

    return {
      authUserId,
      month,
      year,
      baseKpiAmount,
      totalEarned,
      elements: elementsResult,
    };
  }

  /**
   * Recursively get all subordinate IDs for a user
   * @param {number} authUserId 
   */
  async getAllSubordinateIds(authUserId) {
    let allSubIds = [];
    let currentLevelIds = [parseInt(authUserId)];

    while (currentLevelIds.length > 0) {
      const subordinates = await Auth.findAll({
        where: { managerId: { [Op.in]: currentLevelIds } },
        attributes: ['id'],
        raw: true
      });

      const subIds = subordinates.map(s => parseInt(s.id));
      if (subIds.length === 0) break;

      allSubIds = [...allSubIds, ...subIds];
      currentLevelIds = subIds;
    }
    return allSubIds;
  }

  /**
   * Calculate working days ratio for a month (excluding Fridays and Public Holidays)
   * Formula: (Actual Working Days / Normal Working Days)
   */
  async getHolidayAdjustmentRatio(month, year, weekendPolicy = null) {
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    
    // Fetch Global Weekend Days setting (default to Friday = 5)
    const weekendSetting = await SystemSetting.findByPk("weekend_days");
    let globalWeekendDays = [5];
    let globalSaturdayOff = 'all';

    if (weekendSetting) {
      const v = weekendSetting.value;
      if (Array.isArray(v)) {
        globalWeekendDays = v;
      } else if (v && typeof v === 'object') {
        globalWeekendDays = v.days || [5];
        globalSaturdayOff = v.saturdayOff || 'all';
      }
    }

    // Determine specific weekend days for this user
    let userWeekendDays = new Set(globalWeekendDays);
    let saturdaysOffCount = null;

    if (weekendPolicy) {
      if (typeof weekendPolicy === 'string') {
        try {
          weekendPolicy = JSON.parse(weekendPolicy);
        } catch (e) {
          weekendPolicy = null;
        }
      }
    }

    if (weekendPolicy) {
      userWeekendDays = new Set();
      if (weekendPolicy.fridayOff) userWeekendDays.add(5);
      
      if (weekendPolicy.saturdayOff === 'all') {
        userWeekendDays.add(6);
      } else if (weekendPolicy.saturdayOff !== 'none') {
        saturdaysOffCount = parseInt(weekendPolicy.saturdayOff);
      }
    } else {
      // Use global policy
      userWeekendDays = new Set(globalWeekendDays);
      if (globalSaturdayOff === 'all') {
        userWeekendDays.add(6);
      } else if (globalSaturdayOff !== 'none') {
        saturdaysOffCount = parseInt(globalSaturdayOff);
      }
    }

    let normalWorkingDays = 0;
    let totalSaturdays = 0;

    for (let d = 1; d <= lastDayOfMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dayOfWeek = date.getDay();
      
      if (dayOfWeek === 6) totalSaturdays++;

      if (!userWeekendDays.has(dayOfWeek)) {
        normalWorkingDays++;
      }
    }

    // Subtract Saturdays if policy is partial (e.g., 2 Saturdays off)
    if (saturdaysOffCount !== null) {
      const actualSaturdaysToSubtract = Math.min(totalSaturdays, saturdaysOffCount);
      normalWorkingDays = Math.max(0, normalWorkingDays - actualSaturdaysToSubtract);
    }

    if (normalWorkingDays === 0) return 1;

    // Fetch public holidays for this month
    const holidays = await PublicHoliday.findAll({
      where: {
        date: {
          [Op.between]: [
            `${year}-${String(month).padStart(2, '0')}-01`,
            `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`
          ]
        }
      }
    });

    let holidaysInWorkingDays = 0;
    for (const h of holidays) {
      const hDate = new Date(h.date);
      const hDay = hDate.getDay();
      
      // A holiday counts only if it's on a working day
      let isWorkingDay = !userWeekendDays.has(hDay);
      if (hDay === 6 && saturdaysOffCount !== null) {
        // If it's a partial Saturday policy, we assume holidays don't overlap with the "off" Saturdays for conservative calculation
        // Or we can just count it as a holiday if it's a working Saturday. 
        // For simplicity, if it's a Saturday and we have partial Saturdays off, we skip it or count it.
        // Let's assume holidays are primarily on Sunday-Thursday/Friday.
      }
      
      if (isWorkingDay) {
        holidaysInWorkingDays++;
      }
    }

    const actualWorkingDays = Math.max(0, normalWorkingDays - holidaysInWorkingDays);
    return actualWorkingDays / normalWorkingDays;
  }

  async updateKpiElement(id, data) {
    const { KpiElement } = require('../models');
    const element = await KpiElement.findByPk(id);
    if (!element) throw new Error('KPI Element not found');

    await element.update(data);
    return element;
  }

  async createKpiElement(data) {
    const { KpiElement } = require('../models');
    return await KpiElement.create(data);
  }

  async deleteKpiElement(id) {
    const { KpiElement } = require('../models');
    const element = await KpiElement.findByPk(id);
    if (!element) throw new Error('KPI Element not found');
    return await element.destroy();
  }
}

module.exports = new KpiService();
