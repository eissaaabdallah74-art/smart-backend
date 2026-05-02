const jwt = require("jsonwebtoken");
const db = require("../models");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key";

module.exports = async function driverAuthMiddleware(req, res, next) {
  try {
    const header = String(req.headers.authorization || "");
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

    if (!token) return res.status(401).json({ message: "Unauthorized - No Token" });

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Unauthorized - Invalid Token" });
    }

    if (decoded.role !== 'driver') {
        return res.status(403).json({ message: "Forbidden - Not a driver account" });
    }

    const driver = await db.Driver.findByPk(decoded.id);
    if (!driver) return res.status(401).json({ message: "Unauthorized - Driver not found" });

    req.driver = driver;
    return next();
  } catch (e) {
    console.error("driverAuthMiddleware error:", e);
    return res.status(401).json({ message: "Unauthorized" });
  }
};
