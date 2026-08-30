// src/controllers/employee.controller.js
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Employee, EmployeeEmployment, EmployeePayrollInsurance, EmployeeDocument, EmployeeEducation, EmployeeEvaluation, Auth, sequelize } = require('../models');

const BCRYPT_SALT_ROUNDS = 10;

function normalizeNationalId(v) {
  if (v === null || typeof v === 'undefined') return null;
  return String(v).trim();
}

function generateTempPassword(length = 10) {
  // safe-ish temp pass (no ambiguous chars)
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += charset[bytes[i] % charset.length];
  return out;
}

function pickPagination(query) {
  const limit = Math.min(Number(query.limit || 50), 200);
  const offset = Math.max(Number(query.offset || 0), 0);
  return { limit, offset };
}

// ================== Employees CRUD ==================

exports.createEmployee = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      fullName,
      nationalId,
      birthDate,
      maritalStatus,
      religion,
      nationality,
      birthPlace,
      fullAddress,

      // employment (optional)
      employment = {},
    } = req.body;

    if (!fullName || !nationalId) {
      await t.rollback();
      return res.status(400).json({ message: 'fullName and nationalId are required' });
    }

    const nid = normalizeNationalId(nationalId);
    if (!/^\d{14}$/.test(nid)) {
      await t.rollback();
      return res.status(400).json({ message: 'nationalId must be 14 digits' });
    }

    const existing = await Employee.findOne({ where: { nationalId: nid } });
    if (existing) {
      await t.rollback();
      return res.status(400).json({ message: 'Employee with same nationalId already exists' });
    }

    const employee = await Employee.create(
      {
        fullName,
        nationalId: nid,
        birthDate: birthDate || null,
        maritalStatus: maritalStatus || 'unknown',
        religion: religion || 'unknown',
        nationality: nationality || null,
        birthPlace: birthPlace || null,
        fullAddress: fullAddress || null,
      },
      { transaction: t }
    );

    // Always create Employment row to mirror sheet logic
    const employmentRow = await EmployeeEmployment.create(
      {
        employeeId: employee.id,
        isWorking: typeof employment.isWorking === 'boolean' ? employment.isWorking : true,
        department: employment.department || null,
        jobTitle: employment.jobTitle || null,
        corporateEmail: employment.corporateEmail || null,
        hireDate: employment.hireDate || null,
        terminationDate: employment.terminationDate || null,
        nationalIdExpiryDate: employment.nationalIdExpiryDate || null,
        companyNumber: employment.companyNumber || null,
        personalPhone: employment.personalPhone || null,

        annualLeaveBalance: Number.isFinite(Number(employment.annualLeaveBalance))
          ? Number(employment.annualLeaveBalance)
          : 21,
        annualLeaveUsed: Number.isFinite(Number(employment.annualLeaveUsed))
          ? Number(employment.annualLeaveUsed)
          : 0,
        annualLeaveRemaining: Number.isFinite(Number(employment.annualLeaveRemaining))
          ? Number(employment.annualLeaveRemaining)
          : null,

        missingPapersText: employment.missingPapersText || null,
        companyCode: employment.companyCode || null,
        sheetLastUpdateAt: employment.sheetLastUpdateAt || null,
        adminNotes: employment.adminNotes || null,
      },
      { transaction: t }
    );

    // If remaining not provided compute it
    if (employmentRow.annualLeaveRemaining === null) {
      const rem = Math.max((employmentRow.annualLeaveBalance || 0) - (employmentRow.annualLeaveUsed || 0), 0);
      employmentRow.annualLeaveRemaining = rem;
      await employmentRow.save({ transaction: t });
    }

    await t.commit();

    const payload = await Employee.findByPk(employee.id, {
      include: [{ model: EmployeeEmployment, as: 'employment' }],
    });

    return res.status(201).json(payload);
  } catch (error) {
    await t.rollback();
    console.error('createEmployee error:', error);

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'Duplicate unique field (nationalId or corporateEmail)' });
    }
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ message: error.errors?.[0]?.message || 'Validation error' });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getEmployees = async (req, res) => {
  try {
    const { q, department, isWorking, hasAccount, includeAccount } = req.query;
    const { limit, offset } = pickPagination(req.query);

    const where = {};
    const employmentWhere = {};

    if (q) {
      where[Op.or] = [
        { fullName: { [Op.like]: `%${q}%` } },
        { nationalId: { [Op.like]: `%${q}%` } },
      ];
    }

    if (typeof hasAccount !== 'undefined') {
      where.authUserId = hasAccount === 'true' ? { [Op.ne]: null } : null;
    }

    if (department) employmentWhere.department = department;
    if (typeof isWorking !== 'undefined') employmentWhere.isWorking = isWorking === 'true';

    const rows = await Employee.findAndCountAll({
      where,
      include: [
        { model: EmployeeEmployment, as: 'employment', required: false, where: Object.keys(employmentWhere).length ? employmentWhere : undefined },
        ...(includeAccount === 'true'
          ? [{ model: Auth, as: 'account', required: false, attributes: ['id', 'fullName', 'email', 'role', 'position', 'isActive', 'hireDate', 'terminationDate', 'creationDate', 'created_at', 'updated_at', 'weekendPolicy', 'interviewTarget', 'kpiAmount', 'managerId'] }]
          : []),
      ],
      order: [['id', 'DESC']],
      limit,
      offset,
    });

    return res.json({
      total: rows.count,
      limit,
      offset,
      data: rows.rows,
    });
  } catch (error) {
    console.error('getEmployees error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getDepartments = async (req, res) => {
  try {
    const rows = await EmployeeEmployment.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('department')), 'department']],
      where: {
        department: { [Op.ne]: null }
      },
      order: [['department', 'ASC']],
    });
    const departments = rows.map(r => r.department).filter(Boolean);
    return res.json(departments);
  } catch (error) {
    console.error('getDepartments error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getEmployeeById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id parameter' });

    const employee = await Employee.findByPk(id, {
      include: [
        { model: EmployeeEmployment, as: 'employment' },
        { model: EmployeeDocument, as: 'documents' },
        { model: EmployeeEducation, as: 'educations' },
        { model: EmployeeEvaluation, as: 'evaluations' },
        // account optional (limited fields + governance/kpis/weekendPolicy)
        { model: Auth, as: 'account', required: false, attributes: ['id', 'fullName', 'email', 'role', 'position', 'isActive', 'hireDate', 'terminationDate', 'creationDate', 'weekendPolicy', 'interviewTarget', 'kpiAmount', 'managerId'] },
      ],
    });

    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    return res.json(employee);
  } catch (error) {
    console.error('getEmployeeById error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updateEmployee = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const employee = await Employee.findByPk(id, { transaction: t });
    if (!employee) {
      await t.rollback();
      return res.status(404).json({ message: 'Employee not found' });
    }

    const {
      fullName,
      nationalId,
      birthDate,
      maritalStatus,
      religion,
      nationality,
      birthPlace,
      fullAddress,
      employment,
    } = req.body;

    if (typeof fullName !== 'undefined') employee.fullName = fullName;

    if (typeof nationalId !== 'undefined') {
      const nid = normalizeNationalId(nationalId);
      if (!/^\d{14}$/.test(nid)) {
        await t.rollback();
        return res.status(400).json({ message: 'nationalId must be 14 digits' });
      }
      employee.nationalId = nid;
    }

    if (typeof birthDate !== 'undefined') employee.birthDate = birthDate || null;
    if (typeof maritalStatus !== 'undefined') employee.maritalStatus = maritalStatus || 'unknown';
    if (typeof religion !== 'undefined') employee.religion = religion || 'unknown';
    if (typeof nationality !== 'undefined') employee.nationality = nationality || null;
    if (typeof birthPlace !== 'undefined') employee.birthPlace = birthPlace || null;
    if (typeof fullAddress !== 'undefined') employee.fullAddress = fullAddress || null;

    await employee.save({ transaction: t });

    if (employment && typeof employment === 'object') {
      let emp = await EmployeeEmployment.findByPk(employee.id, { transaction: t });
      if (!emp) {
        emp = await EmployeeEmployment.create({ employeeId: employee.id }, { transaction: t });
      }

      const up = employment;

      if (typeof up.isWorking !== 'undefined') {
        emp.isWorking = !!up.isWorking;
        if (emp.isWorking === false) {
          if (employee.authUserId) {
            const authAcc = await Auth.findByPk(employee.authUserId, { transaction: t });
            if (authAcc) {
              authAcc.isActive = false;
              await authAcc.save({ transaction: t });
            }
          }
          let pRow = await EmployeePayrollInsurance.findByPk(employee.id, { transaction: t });
          if (!pRow) {
            pRow = await EmployeePayrollInsurance.create({ employeeId: employee.id }, { transaction: t });
          }
          pRow.medicalInsuranceStatus = 'resigned_of_insurance';
          pRow.socialInsuranceStatus = 'resigned_of_insurance';
          await pRow.save({ transaction: t });
        }
      }
      if (typeof up.department !== 'undefined') emp.department = up.department || null;
      if (typeof up.jobTitle !== 'undefined') emp.jobTitle = up.jobTitle || null;
      if (typeof up.corporateEmail !== 'undefined') emp.corporateEmail = up.corporateEmail || null;
      if (typeof up.hireDate !== 'undefined') emp.hireDate = up.hireDate || null;
      if (typeof up.terminationDate !== 'undefined') emp.terminationDate = up.terminationDate || null;
      if (typeof up.nationalIdExpiryDate !== 'undefined') emp.nationalIdExpiryDate = up.nationalIdExpiryDate || null;
      if (typeof up.companyNumber !== 'undefined') emp.companyNumber = up.companyNumber || null;
      if (typeof up.personalPhone !== 'undefined') emp.personalPhone = up.personalPhone || null;

      if (typeof up.annualLeaveBalance !== 'undefined') emp.annualLeaveBalance = Number(up.annualLeaveBalance) || 0;
      if (typeof up.annualLeaveUsed !== 'undefined') emp.annualLeaveUsed = Number(up.annualLeaveUsed) || 0;
      if (typeof up.annualLeaveRemaining !== 'undefined') {
        emp.annualLeaveRemaining = Number(up.annualLeaveRemaining);
      } else {
        emp.annualLeaveRemaining = Math.max((emp.annualLeaveBalance || 0) - (emp.annualLeaveUsed || 0), 0);
      }

      if (typeof up.missingPapersText !== 'undefined') emp.missingPapersText = up.missingPapersText || null;
      if (typeof up.companyCode !== 'undefined') emp.companyCode = up.companyCode || null;
      if (typeof up.sheetLastUpdateAt !== 'undefined') emp.sheetLastUpdateAt = up.sheetLastUpdateAt || null;
      if (typeof up.adminNotes !== 'undefined') emp.adminNotes = up.adminNotes || null;

      await emp.save({ transaction: t });
    }

    await t.commit();

    const payload = await Employee.findByPk(employee.id, {
      include: [{ model: EmployeeEmployment, as: 'employment' }],
    });

    return res.json(payload);
  } catch (error) {
    await t.rollback();
    console.error('updateEmployee error:', error);

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'Duplicate unique field (nationalId or corporateEmail)' });
    }
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ message: error.errors?.[0]?.message || 'Validation error' });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ================== Payroll (Finance/Admin) ==================

exports.getPayroll = async (req, res) => {
  try {
    const employeeId = Number(req.params.id);
    if (Number.isNaN(employeeId)) return res.status(400).json({ message: 'Invalid id parameter' });

    const row = await EmployeePayrollInsurance.findByPk(employeeId);
    if (!row) return res.json(null);
    return res.json(row);
  } catch (error) {
    console.error('getPayroll error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.upsertPayroll = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const employeeId = Number(req.params.id);
    if (Number.isNaN(employeeId)) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const employee = await Employee.findByPk(employeeId, { transaction: t });
    if (!employee) {
      await t.rollback();
      return res.status(404).json({ message: 'Employee not found' });
    }

    const {
      medicalInsuranceStatus,
      socialInsuranceStatus,
      insuranceNumber,
      socialInsuranceDate,
      socialInsuranceExitDate,
      socialInsuranceExitReason,
      grossSalary,
      insuredSalary,
      employeeShare11,
      employerShare1875,
    } = req.body;

    let row = await EmployeePayrollInsurance.findByPk(employeeId, { transaction: t });
    if (!row) {
      row = await EmployeePayrollInsurance.create({ employeeId }, { transaction: t });
    }

    if (typeof medicalInsuranceStatus !== 'undefined') row.medicalInsuranceStatus = medicalInsuranceStatus;
    if (typeof socialInsuranceStatus !== 'undefined') {
      const oldStatus = row.socialInsuranceStatus;
      row.socialInsuranceStatus = socialInsuranceStatus;
      if (oldStatus !== 'done' && socialInsuranceStatus === 'done' && !row.socialInsuranceDate) {
        row.socialInsuranceDate = new Date().toISOString().split('T')[0];
      }
    }
    
    if (typeof insuranceNumber !== 'undefined') row.insuranceNumber = insuranceNumber || null;
    if (typeof socialInsuranceDate !== 'undefined') row.socialInsuranceDate = socialInsuranceDate || null;
    if (typeof socialInsuranceExitDate !== 'undefined') row.socialInsuranceExitDate = socialInsuranceExitDate || null;
    if (typeof socialInsuranceExitReason !== 'undefined') row.socialInsuranceExitReason = socialInsuranceExitReason || null;

    if (typeof grossSalary !== 'undefined') row.grossSalary = grossSalary;
    if (typeof insuredSalary !== 'undefined') row.insuredSalary = insuredSalary;
    if (typeof employeeShare11 !== 'undefined') row.employeeShare11 = employeeShare11;
    if (typeof employerShare1875 !== 'undefined') row.employerShare1875 = employerShare1875;

    await row.save({ transaction: t });
    await t.commit();

    return res.json(row);
  } catch (error) {
    await t.rollback();
    console.error('upsertPayroll error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ================== Documents (HR/Admin) ==================

exports.listDocuments = async (req, res) => {
  try {
    const employeeId = Number(req.params.id);
    if (Number.isNaN(employeeId)) return res.status(400).json({ message: 'Invalid id parameter' });

    const docs = await EmployeeDocument.findAll({
      where: { employeeId },
      order: [['docType', 'ASC']],
    });
    return res.json(docs);
  } catch (error) {
    console.error('listDocuments error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.upsertDocuments = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const employeeId = Number(req.params.id);
    if (Number.isNaN(employeeId)) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const employee = await Employee.findByPk(employeeId, { transaction: t });
    if (!employee) {
      await t.rollback();
      return res.status(404).json({ message: 'Employee not found' });
    }

    const { documents } = req.body;
    if (!Array.isArray(documents)) {
      await t.rollback();
      return res.status(400).json({ message: 'documents must be an array' });
    }

    // Replace strategy (simple & deterministic)
    await EmployeeDocument.destroy({ where: { employeeId }, transaction: t });

    const rows = documents.map((d) => ({
      employeeId,
      docType: d.docType,
      status: d.status || 'missing',
      fileUrl: d.fileUrl || null,
      notes: d.notes || null,
    }));

    const created = await EmployeeDocument.bulkCreate(rows, { transaction: t });

    await t.commit();
    return res.json(created);
  } catch (error) {
    await t.rollback();
    console.error('upsertDocuments error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ================== Education (HR/Admin) ==================

exports.listEducation = async (req, res) => {
  try {
    const employeeId = Number(req.params.id);
    if (Number.isNaN(employeeId)) return res.status(400).json({ message: 'Invalid id parameter' });

    const rows = await EmployeeEducation.findAll({
      where: { employeeId },
      order: [['graduationYear', 'DESC']],
    });
    return res.json(rows);
  } catch (error) {
    console.error('listEducation error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.replaceEducation = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const employeeId = Number(req.params.id);
    if (Number.isNaN(employeeId)) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const employee = await Employee.findByPk(employeeId, { transaction: t });
    if (!employee) {
      await t.rollback();
      return res.status(404).json({ message: 'Employee not found' });
    }

    const { educations } = req.body;
    if (!Array.isArray(educations)) {
      await t.rollback();
      return res.status(400).json({ message: 'educations must be an array' });
    }

    await EmployeeEducation.destroy({ where: { employeeId }, transaction: t });

    const rows = educations.map((e) => ({
      employeeId,
      degree: e.degree,
      major: e.major || null,
      institute: e.institute || null,
      graduationYear: e.graduationYear || null,
      grade: e.grade || null,
    }));

    const created = await EmployeeEducation.bulkCreate(rows, { transaction: t });
    await t.commit();

    return res.json(created);
  } catch (error) {
    await t.rollback();
    console.error('replaceEducation error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ================== Evaluation (HR/Admin) ==================

exports.upsertEvaluation = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const employeeId = Number(req.params.id);
    if (Number.isNaN(employeeId)) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const { year, performanceRating, commitmentGrade } = req.body;
    const y = Number(year);
    if (!Number.isFinite(y) || y < 2000 || y > 2100) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid year' });
    }

    const employee = await Employee.findByPk(employeeId, { transaction: t });
    if (!employee) {
      await t.rollback();
      return res.status(404).json({ message: 'Employee not found' });
    }

    let row = await EmployeeEvaluation.findOne({ where: { employeeId, year: y }, transaction: t });
    if (!row) {
      row = await EmployeeEvaluation.create({ employeeId, year: y }, { transaction: t });
    }

    if (typeof performanceRating !== 'undefined') row.performanceRating = performanceRating || null;
    if (typeof commitmentGrade !== 'undefined') row.commitmentGrade = commitmentGrade || null;

    await row.save({ transaction: t });
    await t.commit();

    return res.json(row);
  } catch (error) {
    await t.rollback();
    console.error('upsertEvaluation error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ================== Create Account (HR/Admin) ==================
// Flow: Employee exists -> create Auth user -> link employee.authUserId
exports.createAccountForEmployee = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const employeeId = Number(req.params.id);
    if (Number.isNaN(employeeId)) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid id parameter' });
    }

    const employee = await Employee.findByPk(employeeId, {
      include: [{ model: EmployeeEmployment, as: 'employment' }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!employee) {
      await t.rollback();
      return res.status(404).json({ message: 'Employee not found' });
    }

    if (employee.authUserId) {
      await t.rollback();
      return res.status(400).json({ message: 'Employee already linked to an account' });
    }

    const { email, role, position, tempPassword } = req.body;

    // Prefer email from body, otherwise from employment.corporateEmail
    const finalEmail = (email || employee.employment?.corporateEmail || '').trim();
    if (!finalEmail) {
      await t.rollback();
      return res.status(400).json({ message: 'Email is required (body.email or employment.corporateEmail)' });
    }

    // Ensure email not used
    const existingAuth = await Auth.findOne({ where: { email: finalEmail }, transaction: t });
    if (existingAuth) {
      await t.rollback();
      return res.status(400).json({ message: 'Email already exists in auth users' });
    }

    const pwd = (tempPassword && String(tempPassword).trim()) || generateTempPassword(10);
    const hashedPassword = await bcrypt.hash(pwd, BCRYPT_SALT_ROUNDS);

    const newUser = await Auth.create(
      {
        fullName: employee.fullName,
        email: finalEmail,
        password: hashedPassword,
        role: role || 'operation',
        position: position || null,
        isActive: true,
        hireDate: employee.employment?.hireDate || new Date(),
        creationDate: new Date(),
      },
      { transaction: t }
    );

    employee.authUserId = newUser.id;
    await employee.save({ transaction: t });

    await t.commit();

    // Return temp password once (do not log it)
    return res.status(201).json({
      message: 'Account created and linked successfully',
      account: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        position: newUser.position,
        isActive: newUser.isActive,
      },
      tempPassword: pwd,
    });
  } catch (error) {
    await t.rollback();
    console.error('createAccountForEmployee error:', error);

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'Email already exists' });
    }
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ message: error.errors?.[0]?.message || 'Validation error' });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
};
