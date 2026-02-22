// src/controllers/auth.controller.js
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const bcrypt = require("bcryptjs");

const {
  Auth,
  Employee,
  EmployeeEmployment,
  sequelize,
} = require("../models");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key";
const BCRYPT_SALT_ROUNDS = 10;

// =============== Helper: Build Auth Response ===============
function buildAuthResponse(auth) {
  const isAdmin = auth.role === "admin";

  const perms = {
    isAdmin,
    canUseAiAssistant: true,
    canViewUsers: isAdmin || auth.role === "hr",
    canCreateEntries:
      isAdmin ||
      auth.role === "crm" ||
      auth.role === "operation" ||
      auth.role === "supply_chain",
    canViewFinance: isAdmin || auth.role === "finance",
  };

  const token = jwt.sign(
    {
      id: auth.id,
      email: auth.email,
      role: auth.role,
      position: auth.position,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  return { token, user: auth, perms };
}

// ================== NEW Helper: Link/Unlink Employee ↔ Auth ==================
// We store the relation on Employee.authUserId (one-to-one)
async function setEmployeeLink({ authUserId, employeeId }, t) {
  // Unlink request (employeeId null / '' / 0)
  const unlink =
    employeeId === null ||
    typeof employeeId === "undefined" ||
    employeeId === "" ||
    Number(employeeId) === 0;

  // Find current employee linked to this auth user (if any)
  const currentLinked = await Employee.findOne({
    where: { authUserId },
    transaction: t,
    lock: t.LOCK.UPDATE,
  });

  if (unlink) {
    if (currentLinked) {
      currentLinked.authUserId = null;
      await currentLinked.save({ transaction: t });
    }
    return null;
  }

  const targetId = Number(employeeId);
  if (Number.isNaN(targetId) || targetId <= 0) {
    const err = new Error("Invalid employeeId");
    err.statusCode = 400;
    throw err;
  }

  // Load target employee (lock for safety)
  const target = await Employee.findByPk(targetId, {
    transaction: t,
    lock: t.LOCK.UPDATE,
  });

  if (!target) {
    const err = new Error("Employee not found");
    err.statusCode = 404;
    throw err;
  }

  // If target already linked to another user => reject
  if (target.authUserId && target.authUserId !== authUserId) {
    const err = new Error("Employee already linked to another account");
    err.statusCode = 400;
    throw err;
  }

  // If current linked employee is different => unlink it
  if (currentLinked && currentLinked.id !== targetId) {
    currentLinked.authUserId = null;
    await currentLinked.save({ transaction: t });
  }

  // Link target
  target.authUserId = authUserId;
  await target.save({ transaction: t });

  return target;
}

// ================== Auth: Login ==================
// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const authUser = await Auth.findOne({ where: { email } });

    if (!authUser) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, authUser.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!authUser.isActive) {
      return res
        .status(403)
        .json({ message: "This account is inactive. Please contact admin." });
    }

    const payload = buildAuthResponse(authUser);
    return res.json(payload);
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ================== CRUD: Accounts ==================

// GET /api/auth/users
// optional query: ?role=&active=&q=&includeEmployee=true
exports.getAllUsers = async (req, res) => {
  try {
    const { role, active, q, includeEmployee } = req.query;
    const where = {};

    if (role) where.role = role;
    if (typeof active !== "undefined") {
      where.isActive = active === "true";
    }
    if (q) {
      where[Op.or] = [
        { fullName: { [Op.like]: `%${q}%` } },
        { email: { [Op.like]: `%${q}%` } },
      ];
    }

    const include = [];
    if (includeEmployee === "true") {
      include.push({
        model: Employee,
        as: "employeeProfile",
        required: false,
        include: [
          {
            model: EmployeeEmployment,
            as: "employment",
            required: false,
          },
        ],
      });
    }

    const users = await Auth.findAll({
      where,
      include,
      order: [["id", "ASC"]],
    });

    return res.json(users);
  } catch (error) {
    console.error("getAllUsers error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// GET /api/auth/users/:id
// optional query: ?includeEmployee=true
exports.getUserById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid id parameter" });
    }

    const { includeEmployee } = req.query;
    const include = [];
    if (includeEmployee === "true") {
      include.push({
        model: Employee,
        as: "employeeProfile",
        required: false,
        include: [
          {
            model: EmployeeEmployment,
            as: "employment",
            required: false,
          },
        ],
      });
    }

    const authUser = await Auth.findByPk(id, { include });

    if (!authUser) {
      return res.status(404).json({ message: "Account not found" });
    }

    return res.json(authUser);
  } catch (error) {
    console.error("getUserById error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// POST /api/auth/users
// body: { fullName, email, password, role, position, isActive, hireDate, employeeId? }
// employeeId: (optional) to link employee after creating user
exports.createUser = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      fullName,
      email,
      password,
      role,
      position,
      isActive,
      hireDate,
      employeeId, // NEW
    } = req.body;

    if (!fullName || !email || !password) {
      await t.rollback();
      return res
        .status(400)
        .json({ message: "fullName, email and password are required" });
    }

    const existing = await Auth.findOne({ where: { email }, transaction: t });
    if (existing) {
      await t.rollback();
      return res.status(400).json({ message: "Email already exists" });
    }

    // Hash للباسورد قبل التخزين
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const newUser = await Auth.create(
      {
        fullName,
        email,
        password: hashedPassword,
        role,
        position,
        isActive,
        hireDate: hireDate || new Date(),
        creationDate: new Date(),
      },
      { transaction: t }
    );

    // NEW: Link employee if provided
    if (typeof employeeId !== "undefined") {
      await setEmployeeLink({ authUserId: newUser.id, employeeId }, t);
    }

    await t.commit();
    return res.status(201).json(newUser);
  } catch (error) {
    await t.rollback();
    console.error("createUser error:", error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({ message: "Email already exists" });
    }

    if (error.name === "SequelizeValidationError") {
      const first = error.errors && error.errors[0];
      if (first && first.path === "email" && first.validatorKey === "isEmail") {
        return res.status(400).json({ message: "Email is invalid" });
      }
      return res
        .status(400)
        .json({ message: first?.message || "Validation error" });
    }

    if (error.name === "SequelizeDatabaseError") {
      return res.status(400).json({ message: "Invalid data for user" });
    }

    return res.status(500).json({ message: "Internal server error" });
  }
};

// PUT /api/auth/users/:id
// body: subset من { fullName, email, password, role, position, isActive, hireDate, terminationDate, employeeId? }
// employeeId: (optional) to link/unlink employee with this user
exports.updateUser = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid id parameter" });
    }

    let {
      fullName,
      email,
      password,
      role,
      position,
      isActive,
      hireDate,
      terminationDate,
      employeeId, // NEW
    } = req.body;

    const authUser = await Auth.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!authUser) {
      await t.rollback();
      return res.status(404).json({ message: "Account not found" });
    }

    // إذا تم تعطيل الحساب، سجل تاريخ الإنهاء
    if (typeof isActive !== "undefined" && !isActive && authUser.isActive) {
      terminationDate = terminationDate || new Date();
    }

    // إذا تم تفعيل حساب كان معطلاً، امسح تاريخ الإنهاء
    if (typeof isActive !== "undefined" && isActive && !authUser.isActive) {
      terminationDate = null;
    }

    if (typeof fullName !== "undefined") authUser.fullName = fullName;
    if (typeof email !== "undefined") authUser.email = email;
    if (typeof role !== "undefined") authUser.role = role;
    if (typeof position !== "undefined") authUser.position = position;
    if (typeof isActive !== "undefined") authUser.isActive = isActive;
    if (typeof hireDate !== "undefined") authUser.hireDate = hireDate;
    if (typeof terminationDate !== "undefined")
      authUser.terminationDate = terminationDate;

    // لو فيه باسورد جديد ومش فاضي → نعمله hash
    if (typeof password !== "undefined" && password !== "") {
      const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
      authUser.password = hashedPassword;
    }

    await authUser.save({ transaction: t });

    // NEW: link/unlink employee if employeeId provided
    if (typeof employeeId !== "undefined") {
      await setEmployeeLink({ authUserId: authUser.id, employeeId }, t);
    }

    await t.commit();
    return res.json(authUser);
  } catch (error) {
    await t.rollback();
    console.error("updateUser error:", error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({ message: "Email already exists" });
    }

    if (error.name === "SequelizeValidationError") {
      const first = error.errors && error.errors[0];
      if (first && first.path === "email" && first.validatorKey === "isEmail") {
        return res.status(400).json({ message: "Email is invalid" });
      }
      return res
        .status(400)
        .json({ message: first?.message || "Validation error" });
    }

    if (error.name === "SequelizeDatabaseError") {
      return res.status(400).json({ message: "Invalid data for user" });
    }

    return res.status(500).json({ message: "Internal server error" });
  }
};

// DELETE /api/auth/users/:id
// IMPORTANT: unlink employee first if linked
exports.deleteUser = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid id parameter" });
    }

    const authUser = await Auth.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!authUser) {
      await t.rollback();
      return res.status(404).json({ message: "Account not found" });
    }

    // unlink any employee linked to this auth user
    await setEmployeeLink({ authUserId: id, employeeId: null }, t);

    await authUser.destroy({ transaction: t });
    await t.commit();

    return res.json({ message: "Account deleted successfully" });
  } catch (error) {
    await t.rollback();
    console.error("deleteUser error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// =============== GET /api/auth/operation/staff =================
// Manager/Supervisor (Operation) + Admin يستعملوه عشان يجيبوا Team
exports.getOperationStaff = async (req, res) => {
  try {
    const { active, q } = req.query;
    const where = { role: "operation" };

    if (typeof active !== "undefined") {
      where.isActive = active === "true";
    }
    if (q) {
      where[Op.or] = [
        { fullName: { [Op.like]: `%${q}%` } },
        { email: { [Op.like]: `%${q}%` } },
      ];
    }

    const users = await Auth.findAll({
      where,
      order: [["fullName", "ASC"]],
      attributes: [
        "id",
        "fullName",
        "email",
        "role",
        "position",
        "isActive",
        "hireDate",
        "terminationDate",
        "creationDate",
        "created_at",
        "updated_at",
      ],
    });

    return res.json(users);
  } catch (error) {
    console.error("getOperationStaff error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ================== NEW: Employees for Users dropdown ==================
// GET /api/auth/employees/available?q=&isWorking=&department=&includeLinked=
exports.getAvailableEmployees = async (req, res) => {
  try {
    const { q, isWorking, department, includeLinked } = req.query;

    const where = {};
    if (includeLinked !== "true") {
      // default: only employees without accounts
      where.authUserId = null;
    }

    if (q) {
      where[Op.or] = [
        { fullName: { [Op.like]: `%${q}%` } },
        { nationalId: { [Op.like]: `%${q}%` } },
      ];
    }

    const employmentWhere = {};
    if (department) employmentWhere.department = department;
    if (typeof isWorking !== "undefined") {
      employmentWhere.isWorking = isWorking === "true";
    }

    // NOTE: createEmployee always creates employment row in your code
    const rows = await Employee.findAll({
      where,
      include: [
        {
          model: EmployeeEmployment,
          as: "employment",
          required: false,
          where: Object.keys(employmentWhere).length ? employmentWhere : undefined,
        },
      ],
      order: [["fullName", "ASC"]],
      limit: 500,
    });

    // Return minimal shape for dropdown
    const out = rows.map((e) => ({
      id: e.id,
      fullName: e.fullName,
      authUserId: e.authUserId || null,
      corporateEmail: e.employment?.corporateEmail || null,
      department: e.employment?.department || null,
      jobTitle: e.employment?.jobTitle || null,
      isWorking: typeof e.employment?.isWorking === "boolean" ? e.employment.isWorking : null,
    }));

    return res.json(out);
  } catch (error) {
    console.error("getAvailableEmployees error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
