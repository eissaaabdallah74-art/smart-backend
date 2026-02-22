// app.js
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");

const authMiddleware = require("./src/middlewares/auth.middleware");
const auditContextMiddleware = require("./src/middlewares/audit-context.middleware");

const db = require("./src/models");

// Routes
const authRoutes = require("./src/routes/auth.routes");
const clientRoutes = require("./src/routes/client.routes");
const clientContractsRoutes = require("./src/routes/client-contracts.routes");
const driverRoutes = require("./src/routes/driver.routes");
const trackingRoutes = require("./src/routes/tracking.routes");
const interviewRoutes = require("./src/routes/interview.routes");
const hubRoutes = require("./src/routes/hub.routes");
const zoneRoutes = require("./src/routes/zone.routes");
const pendingRequestsRouter = require("./src/routes/pending-requests.routes");
const callsRoutes = require("./src/routes/calls.routes");
const tasksRouter = require("./src/routes/tasks.routes");
const reportRoutes = require("./src/routes/report.routes");
const employeeRoutes = require("./src/routes/employee.routes");
const attendanceRoutes = require("./src/routes/attendance.routes");
const attendanceRequestsRoutes = require("./src/routes/attendance-requests.routes");
const auditLogsRoutes = require("./src/routes/audit-log.routes");
const employeeLoansRoutes = require("./src/routes/employee-loans.routes");
const companyDocumentsRoutes = require("./src/routes/company-documents.routes");

const app = express();

console.log("✅ APP BOOT PID:", process.pid);
console.log("APP FILE:", __filename);
console.log("✅ NODE ENV:", process.env.NODE_ENV || "development");

// CORS
app.use(cors());

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logger (خفيف)
app.use((req, _res, next) => {
  if (req.originalUrl.startsWith("/api/employee-loans")) {
    console.log("LOANS HIT:", req.method, req.originalUrl, "| pid:", process.pid);
  }
  next();
});

// Health
app.get("/", (_req, res) => {
  res.json({ message: "Smart Backend API is running", pid: process.pid });
});

// ===== Public =====
app.use("/api/auth", authRoutes);

// ===== Protected =====
app.use("/api/clients", authMiddleware, auditContextMiddleware, clientRoutes);
app.use(
  "/api/client-contracts",
  authMiddleware,
  auditContextMiddleware,
  clientContractsRoutes
);
app.use("/api/drivers", authMiddleware, auditContextMiddleware, driverRoutes);
app.use("/api/tracking", authMiddleware, auditContextMiddleware, trackingRoutes);
app.use("/api/interviews", authMiddleware, auditContextMiddleware, interviewRoutes);
app.use("/api/hubs", authMiddleware, auditContextMiddleware, hubRoutes);
app.use("/api/zones", authMiddleware, auditContextMiddleware, zoneRoutes);

app.use(
  "/api/pending-requests",
  authMiddleware,
  auditContextMiddleware,
  pendingRequestsRouter
);
app.use("/api/calls", authMiddleware, auditContextMiddleware, callsRoutes);
app.use("/api/tasks", authMiddleware, auditContextMiddleware, tasksRouter);
app.use("/api/reports", authMiddleware, auditContextMiddleware, reportRoutes);
app.use("/api/employees", authMiddleware, auditContextMiddleware, employeeRoutes);

/**
 * ✅ IMPORTANT ORDER FIX
 * لازم requests تتسجل قبل attendance
 */
app.use(
  "/api/attendance/requests",
  authMiddleware,
  auditContextMiddleware,
  attendanceRequestsRoutes
);

app.use(
  "/api/attendance",
  authMiddleware,
  auditContextMiddleware,
  attendanceRoutes
);

app.use("/api/audit-logs", authMiddleware, auditContextMiddleware, auditLogsRoutes);

// ✅ Employee Loans (Protected)
app.use(
  "/api/employee-loans",
  authMiddleware,
  auditContextMiddleware,
  employeeLoansRoutes
);

// ✅ Company Documents (Protected)  <-- (لازم قبل 404 fallback)
app.use(
  "/api/company-documents",
  authMiddleware,
  auditContextMiddleware,
  companyDocumentsRoutes
);

// ===== 404 JSON fallback (لازم يكون آخر حاجة بعد كل routes) =====
app.use((req, res) => {
  console.log(`[${process.pid}] 404 FALLBACK:`, req.method, req.originalUrl);
  return res.status(404).json({
    ok: false,
    message: "Not Found",
    method: req.method,
    path: req.originalUrl,
    pid: process.pid,
  });
});

// ===== Error handler (بعد 404 عادي) =====
app.use((err, req, res, _next) => {
  console.error(`[${process.pid}] ERROR:`, err);
  return res.status(500).json({
    ok: false,
    message: "Internal Server Error",
    path: req.originalUrl,
    pid: process.pid,
  });
});

// ===== DB init & seeding =====
(async () => {
  try {
    await db.sequelize.authenticate();
    console.log("✅ Database connection has been established successfully.");

    await db.sequelize.sync();
    await require("./src/seed/company-documents.seed")();

    console.log("✅ Models synchronized with database.");

    const { Auth } = db;

    const adminEmail = "admin@smart.com";
    const adminPlainPassword = process.env.ADMIN_PASSWORD || "admin";
    const adminHashedPassword = await bcrypt.hash(adminPlainPassword, 10);

    let admin = await Auth.findOne({ where: { email: adminEmail } });

    if (!admin) {
      admin = await Auth.create({
        fullName: "System Admin",
        email: adminEmail,
        password: adminHashedPassword,
        role: "admin",
        isActive: true,
      });
      console.log("👑 Admin user CREATED (admin@smart.com / admin)");
    } else {
      let needSave = false;

      if (!admin.password || !admin.password.startsWith("$2")) {
        admin.password = adminHashedPassword;
        needSave = true;
        console.log("🔐 Admin password rehashed.");
      }
      if (admin.role !== "admin") {
        admin.role = "admin";
        needSave = true;
      }
      if (!admin.isActive) {
        admin.isActive = true;
        needSave = true;
      }
      if (!admin.fullName) {
        admin.fullName = "System Admin";
        needSave = true;
      }

      if (needSave) {
        await admin.save();
        console.log("👑 Admin user UPDATED/normalized successfully.");
      } else {
        console.log("👑 Admin user already exists & is valid.");
      }
    }
  } catch (error) {
    console.error("❌ Unable to connect to the database:", error);
  }
})();

module.exports = app;
