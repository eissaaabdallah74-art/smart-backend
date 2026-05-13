// src/controllers/kpi.controller.js
const kpiService = require('../services/kpi.service');

exports.getAllKpiElements = async (req, res, next) => {
  try {
    const elements = await kpiService.getAllKpiElements();
    res.status(200).json({ success: true, data: elements });
  } catch (error) {
    next(error);
  }
};

exports.getUserKpiConfig = async (req, res, next) => {
  try {
    const authUserId = req.params.authUserId;
    const config = await kpiService.getUserKpiConfig(authUserId);
    res.status(200).json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
};

exports.updateUserKpiConfig = async (req, res, next) => {
  try {
    const authUserId = req.params.authUserId;
    const { kpiAmount, configs } = req.body;

    await kpiService.updateUserKpiConfig(authUserId, kpiAmount, configs);
    res.status(200).json({ success: true, message: 'KPI Configuration updated successfully' });
  } catch (error) {
    next(error);
  }
};

exports.submitManualEvaluation = async (req, res, next) => {
  try {
    const { userKpiConfigId, month, year, achievedValue } = req.body;
    const evaluatedById = req.user.id; // from auth middleware

    const evaluation = await kpiService.submitManualEvaluation(
      userKpiConfigId,
      month,
      year,
      achievedValue,
      evaluatedById
    );

    res.status(200).json({ success: true, data: evaluation, message: 'Evaluation submitted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.calculateMonthlyKpi = async (req, res, next) => {
  try {
    const authUserId = req.params.authUserId;
    const { month, year } = req.query; // e.g. ?month=5&year=2026

    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'Month and year are required' });
    }

    const result = await kpiService.calculateMonthlyKpi(authUserId, parseInt(month), parseInt(year));
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.updateKpiElement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nameAr, nameEn, isActive } = req.body;
    const updated = await kpiService.updateKpiElement(id, { nameAr, nameEn, isActive });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

exports.createKpiElement = async (req, res, next) => {
  try {
    const { nameAr, nameEn, calculationType, isActive } = req.body;
    const element = await kpiService.createKpiElement({ nameAr, nameEn, calculationType, isActive });
    res.status(201).json({ success: true, data: element });
  } catch (error) {
    next(error);
  }
};

exports.deleteKpiElement = async (req, res, next) => {
  try {
    const { id } = req.params;
    await kpiService.deleteKpiElement(id);
    res.status(200).json({ success: true, message: 'KPI Element deleted' });
  } catch (error) {
    next(error);
  }
};
