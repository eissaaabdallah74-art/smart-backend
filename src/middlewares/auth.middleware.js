// src/middlewares/auth.middleware.js
const jwt = require("jsonwebtoken");
const db = require("../models");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key";

module.exports = async function authMiddleware(req, res, next) {
  try {
    const header = String(req.headers.authorization || "");
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Load auth user from DB (source of truth)
    const authUser = await db.Auth.findByPk(decoded.id);
    if (!authUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!authUser.isActive) {
      return res
        .status(403)
        .json({ message: "This account is inactive. Please contact admin." });
    }

    // Resolve linked employee
    let employee = null;

    // admin غالباً مش محتاج employeeId (وانت مانع admin من إنشاء requests)
    if (String(authUser.role).toLowerCase() !== "admin") {
      employee = await db.Employee.findOne({
        where: { authUserId: authUser.id },
        attributes: ["id", "fullName", "authUserId"],
      });
    }

    // ✅ Parse permissions if stored as string
    let perms = authUser.permissions;
    if (typeof perms === "string") {
      try {
        perms = JSON.parse(perms);
      } catch (e) {
        perms = {};
      }
    }

    // attach normalized user shape
    req.user = {
      id: authUser.id,
      email: authUser.email,
      fullName: authUser.fullName,
      role: authUser.role,
      position: authUser.position || null,
      isActive: !!authUser.isActive,
      permissions: perms, // ✅ added permissions

      // ✅ the important part
      employeeId: employee ? employee.id : null,
    };

    // optional: attach employee object for other controllers
    req.employee = employee;

    return next();
  } catch (e) {
    console.error("auth.middleware error:", e);
    return res.status(401).json({ message: "Unauthorized" });
  }
};
