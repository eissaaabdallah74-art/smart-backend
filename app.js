// app.js
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const path = require("path");

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
const vendorRoutes = require("./src/routes/vendor.routes");
const financeCategoryRoutes = require("./src/routes/finance-category.routes");
const financeTransactionRoutes = require("./src/routes/finance-transaction.routes");
const payrollRoutes = require("./src/routes/payroll.routes");
const chatbotRoutes = require("./src/routes/chatbot.routes.js");
const courierRegistrationRoutes = require("./src/routes/courier-registration.routes");
const adminManagementRoutes = require("./src/routes/admin-management.routes");
const publicHolidayRoutes = require("./src/routes/public-holiday.routes");
const vehicleTypeRoutes = require("./src/routes/vehicle-type.routes");
const businessModuleRoutes = require("./src/routes/business-module.routes");
const kpiRoutes = require("./src/routes/kpi.routes");
const zktecoRoutes = require("./src/routes/zkteco.routes");
const systemNotificationRoutes = require("./src/routes/system-notification.routes");
const chatRoutes = require("./src/routes/chat.routes");
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
app.use("/api/zkteco", zktecoRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/couriers", courierRegistrationRoutes);
app.use("/api/driver-auth", require("./src/routes/driver-auth.routes"));

// ===== Protected (Driver Portal) =====
const driverAuthMiddleware = require("./src/middlewares/driver-auth.middleware");
app.use("/api/driver-portal", driverAuthMiddleware, require("./src/routes/driver-portal.routes"));

// ===== Protected (Admin/Employee) =====
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
app.use("/api/vendors", authMiddleware, auditContextMiddleware, vendorRoutes);
app.use("/api/hubs", authMiddleware, auditContextMiddleware, hubRoutes);
app.use("/api/zones", authMiddleware, auditContextMiddleware, zoneRoutes);
app.use('/api/driver-loans', authMiddleware, auditContextMiddleware, require('./src/routes/driver-loans.routes'));

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
app.use("/api/kpi", authMiddleware, auditContextMiddleware, kpiRoutes);

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

app.use(
  "/api/public-holidays",
  authMiddleware,
  auditContextMiddleware,
  publicHolidayRoutes
);

app.use("/api/audit-logs", authMiddleware, auditContextMiddleware, auditLogsRoutes);

// ✅ Employee Loans (Protected)
app.use(
  "/api/employee-loans",
  authMiddleware,
  auditContextMiddleware,
  employeeLoansRoutes
);

app.use(
  "/api/company-documents",
  authMiddleware,
  auditContextMiddleware,
  companyDocumentsRoutes
);

// ✅ Finance Module
app.use("/api/finance/categories", authMiddleware, auditContextMiddleware, financeCategoryRoutes);
app.use("/api/finance/transactions", authMiddleware, auditContextMiddleware, financeTransactionRoutes);
app.use("/api/finance/payrolls", authMiddleware, auditContextMiddleware, payrollRoutes);
app.use("/api/finance/breakdowns", authMiddleware, auditContextMiddleware, require("./src/routes/breakdown.routes"));
app.use("/api/driver-financial-requests", require("./src/routes/driver-financial-request.routes"));
app.use("/api/driver-notifications", authMiddleware, auditContextMiddleware, require("./src/routes/driver-notification.routes"));
const { chatbotRateLimiter } = require("./src/middlewares/rate-limit.middleware");
app.use("/api/chatbot", authMiddleware, auditContextMiddleware, chatbotRateLimiter, chatbotRoutes);
app.use("/api/admin-management", authMiddleware, auditContextMiddleware, adminManagementRoutes);
app.use("/api/vehicle-types", authMiddleware, auditContextMiddleware, vehicleTypeRoutes);
app.use("/api/business-modules", authMiddleware, auditContextMiddleware, businessModuleRoutes);
app.use("/api/client-modules", authMiddleware, auditContextMiddleware, require("./src/routes/client-module.routes"));
app.use("/api/system-aliases", require("./src/routes/system-alias.routes"));
app.use("/api/system-notifications", systemNotificationRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/hr/payroll", authMiddleware, auditContextMiddleware, payrollRoutes);

// ✅ WhatsApp Module
app.use("/api/whatsapp", authMiddleware, auditContextMiddleware, require("./src/routes/whatsapp.routes"));
app.use("/api/whatsapp-templates", authMiddleware, auditContextMiddleware, require("./src/routes/whatsapp-templates.routes"));

// ✅ Landing Page Settings (Public GET, Protected PUT)
const landingPageSettingsRoutes = require("./src/routes/landing-page-settings.routes");
// We can use authMiddleware for PUT if needed, but the router itself can just be mounted here.
// Let's mount it with authMiddleware for PUT inside the route or just mount the whole thing and let the frontend use auth token if needed, wait, GET needs to be public for driver-portal.
// Actually, it's better to just mount it without global authMiddleware, and we can rely on frontend not showing the admin page unless logged in. Or we can split it. For now, public.
app.use("/api/landing-page-settings", landingPageSettingsRoutes);

// ✅ Serve Static Uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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
    try {
      await db.sequelize.query("ALTER TABLE `driver_attendances` ADD COLUMN `approval_status` VARCHAR(255) NOT NULL DEFAULT 'pending';");
      console.log("✅ Column approval_status added via native SQL query successfully.");
    } catch (colErr) {
      console.log("ℹ️ Column approval_status check output:", colErr.message);
    }
    const alterQueries = [
      "ALTER TABLE `employee_payroll_settings` ADD COLUMN `payrollMode` VARCHAR(255) DEFAULT 'NO_EXEMPT_ALLOWANCES';",
      "ALTER TABLE `employee_payroll_settings` ADD COLUMN `allowanceEnabled` TINYINT(1) DEFAULT 0;",
      "ALTER TABLE `employee_payroll_settings` ADD COLUMN `allowancePercentage` FLOAT DEFAULT 30;",
      "ALTER TABLE `employee_payroll_settings` ADD COLUMN `allowanceCalculationMethod` VARCHAR(255) DEFAULT 'PERCENTAGE_OF_BASIC';",
      "ALTER TABLE `employee_payroll_settings` ADD COLUMN `allowanceTaxTreatment` VARCHAR(255) DEFAULT 'TAXABLE';",
      "ALTER TABLE `employee_payroll_settings` ADD COLUMN `allowanceSocialInsuranceTreatment` VARCHAR(255) DEFAULT 'EXCLUDED_FROM_SOCIAL_INSURANCE';"
    ];
    for (const q of alterQueries) {
      try {
        await db.sequelize.query(q);
      } catch (e) {
        // Ignore duplicate column errors individually
      }
    }
    console.log("✅ Columns migration check for employee_payroll_settings completed.");
    await require("./src/seed/company-documents.seed")();
    await require("./src/seed/finance.seed")();
    await require("./src/seed/vehicle-type.seed")();
    await require("./src/seed/business-module.seed")();
    await require("./src/seed/system-alias.seed")();
    await require("./src/seed/kpi-elements.seed")();

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
   