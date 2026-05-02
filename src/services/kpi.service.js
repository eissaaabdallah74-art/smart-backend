// src/services/kpi.service.js
const {
  KpiElement,
  UserKpiConfig,
  UserKpiEvaluation,
  Auth,
  Interview,
  sequelize,
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
        }));
        await UserKpiConfig.bulkCreate(configData, { transaction });
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
      attributes: ['id', 'fullName', 'kpiAmount'],
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

    let totalEarned = 0;
    const elementsResult = [];

    const baseKpiAmount = parseFloat(user.kpiAmount) || 0;

    for (const config of configs) {
      const element = config.kpiElement;
      const targetValue = parseFloat(config.targetValue) || 1; // avoid div by 0
      const weight = parseFloat(config.weightPercentage) || 0;
      const maxAmountForElement = (weight / 100) * baseKpiAmount;
      
      let achievedValue = 0;

      // 1. Calculate achieved value based on type
      if (element.calculationType === 'account_manager_target') {
        achievedValue = await Interview.count({
          where: {
            accountManagerId: authUserId,
            signedWithHr: 'Signed A Contract With HR',
            createdAt: { [Op.between]: [startDate, endDate] }
          }
        });
      } else if (element.calculationType === 'account_manager_day1') {
        achievedValue = await Interview.count({
          where: {
            accountManagerId: authUserId,
            day1Date: {
              [Op.between]: [startDate, endDate]
            }
          }
        });
      } else if (element.calculationType === 'interviewer_recruitment') {
        achievedValue = await Interview.count({
          where: {
            interviewerId: authUserId,
            signedWithHr: 'Signed A Contract With HR',
            createdAt: { [Op.between]: [startDate, endDate] }
          }
        });
      } else if (element.calculationType === 'manual') {
        // Read from evaluation table
        const evalRecord = await UserKpiEvaluation.findOne({
          where: { userKpiConfigId: config.id, month, year }
        });
        achievedValue = evalRecord ? parseFloat(evalRecord.achievedValue) : 0;
      }

      // 2. Calculate earned ratio (Capped at 1.0 based on user requirements for now)
      let achievementRatio = achievedValue / targetValue;
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
        targetValue,
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
}

module.exports = new KpiService();
