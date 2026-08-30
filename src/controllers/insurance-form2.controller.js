// src/controllers/insurance-form2.controller.js
const { Employee, EmployeeEmployment, EmployeePayrollInsurance, EmployeeForm2, sequelize } = require('../models');
const { Op } = require('sequelize');

exports.getEmployeesForm2Status = async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const companyCode = req.query.companyCode;
    const inForm2 = req.query.inForm2; // 'true', 'false', or empty for all

    // Build the query
    const empWhere = {};
    const empIncludeWhere = {};

    if (companyCode) {
      empIncludeWhere.companyCode = companyCode;
    }

    const includeArray = [
      {
        model: EmployeeEmployment,
        as: 'employment',
        where: empIncludeWhere,
        required: !!companyCode,
      },
      {
        model: EmployeePayrollInsurance,
        as: 'payrollInsurance',
        required: false,
      },
      {
        model: EmployeeForm2,
        as: 'form2Records',
        required: false,
        where: { year }, // Only join the form2 record for this year
      },
    ];

    let employees = await Employee.findAll({
      where: empWhere,
      include: includeArray,
      order: [['id', 'DESC']],
    });

    // We can filter in memory or via SQL. SQL is preferred but complex with LEFT JOIN and where.
    // Let's filter in memory for inForm2 since it's a left join status.
    if (inForm2 === 'true') {
      employees = employees.filter(e => e.form2Records && e.form2Records.length > 0);
    } else if (inForm2 === 'false') {
      employees = employees.filter(e => !e.form2Records || e.form2Records.length === 0);
    }

    // Map the results for the frontend
    const mapped = employees.map(e => {
      const emp = e.employment || {};
      const payroll = e.payrollInsurance || {};
      const isInForm2 = e.form2Records && e.form2Records.length > 0;

      return {
        id: e.id,
        fullName: e.fullName,
        nationalId: e.nationalId,
        jobTitle: emp.jobTitle,
        companyCode: emp.companyCode,
        hireDate: emp.hireDate,
        socialInsuranceStatus: payroll.socialInsuranceStatus || 'not_insured',
        insuranceNumber: payroll.insuranceNumber,
        socialInsuranceDate: payroll.socialInsuranceDate,
        socialInsuranceExitDate: payroll.socialInsuranceExitDate,
        socialInsuranceExitReason: payroll.socialInsuranceExitReason,
        isInForm2,
        year,
      };
    });

    return res.json({
      ok: true,
      data: mapped,
    });
  } catch (error) {
    console.error('getEmployeesForm2Status error:', error);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

exports.toggleEmployeeForm2 = async (req, res) => {
  try {
    const employeeId = parseInt(req.body.employeeId, 10);
    const year = parseInt(req.body.year, 10);

    if (!employeeId || !year) {
      return res.status(400).json({ ok: false, message: 'Missing employeeId or year' });
    }

    const t = await sequelize.transaction();

    try {
      // Validate socialInsuranceStatus
      const payroll = await EmployeePayrollInsurance.findByPk(employeeId, { transaction: t });
      if (!payroll || payroll.socialInsuranceStatus !== 'done') {
        await t.rollback();
        return res.status(400).json({ ok: false, message: 'Employee must have socialInsuranceStatus = done' });
      }

      // Check if already in Form 2
      const existing = await EmployeeForm2.findOne({
        where: { employeeId, year },
        transaction: t,
      });

      let added = false;
      if (existing) {
        // Remove it
        await existing.destroy({ transaction: t });
        added = false;
      } else {
        // Add it
        await EmployeeForm2.create({ employeeId, year }, { transaction: t });
        added = true;
      }

      await t.commit();
      return res.json({ ok: true, data: { added } });
    } catch (innerError) {
      await t.rollback();
      throw innerError;
    }
  } catch (error) {
    console.error('toggleEmployeeForm2 error:', error);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};
