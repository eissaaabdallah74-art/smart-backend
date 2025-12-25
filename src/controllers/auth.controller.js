  // src/controllers/auth.controller.js
  const jwt = require("jsonwebtoken");
  const { Op } = require("sequelize");
  const bcrypt = require("bcryptjs");
  const { Auth } = require("../models");

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
  exports.getAllUsers = async (req, res) => {
    try {
      const { role, active, q } = req.query;
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

      const users = await Auth.findAll({
        where,
        order: [["id", "ASC"]],
      });

      return res.json(users);
    } catch (error) {
      console.error("getAllUsers error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };

  // GET /api/auth/users/:id
  exports.getUserById = async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid id parameter" });
      }

      const authUser = await Auth.findByPk(id);

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
  // body: { fullName, email, password, role, position, isActive, hireDate }
  exports.createUser = async (req, res) => {
    try {
      const { fullName, email, password, role, position, isActive, hireDate } =
        req.body;

      if (!fullName || !email || !password) {
        return res
          .status(400)
          .json({ message: "fullName, email and password are required" });
      }

      const existing = await Auth.findOne({ where: { email } });
      if (existing) {
        return res.status(400).json({ message: "Email already exists" });
      }

      // Hash للباسورد قبل التخزين
      const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

      const newUser = await Auth.create({
        fullName,
        email,
        password: hashedPassword,
        role,
        position,
        isActive,
        hireDate: hireDate || new Date(), // إذا ما اتقدمش تاريخ التعيين، استخدم التاريخ الحالي
        creationDate: new Date(), // تاريخ الإنشاء دائماً الحالي
      });

      return res.status(201).json(newUser);
    } catch (error) {
      console.error("createUser error:", error);

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
  // body: subset من { fullName, email, password, role, position, isActive, hireDate, terminationDate }
  exports.updateUser = async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
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
      } = req.body;

      const authUser = await Auth.findByPk(id);
      if (!authUser) {
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

      await authUser.save();

      return res.json(authUser);
    } catch (error) {
      console.error("updateUser error:", error);

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
  exports.deleteUser = async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid id parameter" });
      }

      const authUser = await Auth.findByPk(id);
      if (!authUser) {
        return res.status(404).json({ message: "Account not found" });
      }

      await authUser.destroy();

      return res.json({ message: "Account deleted successfully" });
    } catch (error) {
      console.error("deleteUser error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };




  // =============== GET /api/auth/operation/staff =================
  // Manager/Supervisor (Operation) + Admin يستعملوه عشان يجيبوا Team
  exports.getOperationStaff = async (req, res) => {
    try {
      const { active, q } = req.query;
      const where = { role: 'operation' };

      if (typeof active !== 'undefined') {
        where.isActive = active === 'true';
      }
      if (q) {
        where[Op.or] = [
          { fullName: { [Op.like]: `%${q}%` } },
          { email: { [Op.like]: `%${q}%` } },
        ];
      }

      const users = await Auth.findAll({
        where,
        order: [['fullName', 'ASC']],
        attributes: [
          'id',
          'fullName',
          'email',
          'role',
          'position',
          'isActive',
          'hireDate',
          'terminationDate',
          'creationDate',
          'created_at',
          'updated_at',
        ],
      });

      return res.json(users);
    } catch (error) {
      console.error('getOperationStaff error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  };

