// src/models/index.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config");

const db = {};
db.sequelize = sequelize;

// ===================== Models =====================

db.Auth = require("./auth.model")(sequelize, DataTypes);
db.Client = require("./client.model")(sequelize, DataTypes);
db.ClientContract = require("./client-contract.model")(sequelize, DataTypes);
db.ClientPricing = require("./client-pricing.model")(sequelize, DataTypes);
db.VehicleType = require("./vehicle-type.model")(sequelize, DataTypes);
db.BusinessModule = require("./business-module.model")(sequelize, DataTypes);
db.ClientModule = require("./client-module.model")(sequelize, DataTypes);
db.SystemAlias = require("./system-alias.model")(sequelize, DataTypes);
db.LandingPageSetting = require("./landing-page-setting.model")(sequelize, DataTypes);
db.Driver = require("./driver.model")(sequelize, DataTypes);
db.Hub = require("./hub.model")(sequelize, DataTypes);
db.Zone = require("./zone.model")(sequelize, DataTypes);
db.Interview = require("./interview.model")(sequelize, DataTypes);
db.CourierRegistration = require("./courier-registration.model")(
  sequelize,
  DataTypes
);

db.Vendor = require("./vendor.model")(sequelize, DataTypes);

db.DriverLoan = require("./driver-loan.model")(sequelize, DataTypes);
db.DriverComplaint = require("./driver-complaint.model")(sequelize, DataTypes);
db.DriverFinancialRequest = require("./driver-financial-request.model")(sequelize, DataTypes);

// ===================== Notifications =====================
db.DriverNotificationBlast = require("./driver-notification-blast.model")(sequelize, DataTypes);
db.DriverNotification = require("./driver-notification.model")(sequelize, DataTypes);

db.DriverAttendance = require("./driver-attendance.model")(sequelize, DataTypes);

// ===================== Audit Logs =====================
db.AuditLog = require("./audit-log.model")(sequelize, DataTypes);
db.AIUsageLog = require("./ai-usage-log.model")(sequelize, DataTypes);

// ===================== Attendance Module =====================
db.EmployeeAttendanceProfile = require("./employee-attendance-profile.model")(
  sequelize,
  DataTypes
);
db.AttendanceImport = require("./attendance-import.model")(sequelize, DataTypes);
db.AttendanceDay = require("./attendance-day.model")(sequelize, DataTypes);
db.AttendanceExcuse = require("./attendance-excuse.model")(sequelize, DataTypes);
db.AttendanceMonthlySummary = require("./attendance-monthly-summary.model")(
  sequelize,
  DataTypes
);
db.AttendanceManualItem = require("./attendance-manual-item.model")(
  sequelize,
  DataTypes
);
db.AttendanceRequest = require("./attendance-request.model")(sequelize, DataTypes);
db.PublicHoliday = require("./public-holiday.model")(sequelize, DataTypes);
db.SystemSetting = require("./system-setting.model")(sequelize, DataTypes);

// ===================== ZKTeco Attendance Module =====================
db.AttendanceDevice = require("./attendance-device.model")(sequelize, DataTypes);
db.AttendanceDeviceUser = require("./attendance-device-user.model")(sequelize, DataTypes);
db.AttendanceRawLog = require("./attendance-raw-log.model")(sequelize, DataTypes);
db.EmployeeDeviceMapping = require("./employee-device-mapping.model")(sequelize, DataTypes);

// Optional (if exists in your codebase)
try {
  db.AttendanceUnmatchedRow = require("./attendance-unmatched-row.model")(
    sequelize,
    DataTypes
  );
} catch (_) {
  db.AttendanceUnmatchedRow = null;
}

// ===================== Pending Requests =====================
db.PendingRequest = require("./pending-request.model")(sequelize, DataTypes);
db.PendingRequestItem = require("./pending-request-item.model")(
  sequelize,
  DataTypes
);

// ===================== Calls =====================
db.Call = require("./call.model")(sequelize, DataTypes);

// ===================== Tasks =====================
db.Task = require("./task.model")(sequelize, DataTypes);
db.SystemNotification = require("./system-notification.model")(sequelize, DataTypes);
db.ChatMessage = require("./chat-message.model")(sequelize, DataTypes);

// ===================== HR Employees =====================
db.Employee = require("./employee.model")(sequelize, DataTypes);
db.EmployeeEmployment = require("./employee-employment.model")(
  sequelize,
  DataTypes
);
db.EmployeePayrollInsurance = require("./employee-payroll-insurance.model")(
  sequelize,
  DataTypes
);
db.EmployeeDocument = require("./employee-document.model")(sequelize, DataTypes);
db.EmployeeEducation = require("./employee-education.model")(sequelize, DataTypes);
db.EmployeeEvaluation = require("./employee-evaluation.model")(
  sequelize,
  DataTypes
);

// ===================== Employee Loans =====================
db.EmployeeLoanPolicy = require("./employee-loan-policy.model.js")(
  sequelize,
  DataTypes
);
db.EmployeeLoan = require("./employee-loan.model")(sequelize, DataTypes);

// ✅ NEW: LoanRequest + LoanInstallment
db.LoanRequest = require("./loan-request.model")(sequelize, DataTypes);
db.LoanInstallment = require("./loan-installment.model")(sequelize, DataTypes);

// ===================== Company Documents =====================
db.Company = require("./company.model")(sequelize, DataTypes);
db.DocumentType = require("./document-type.model")(sequelize, DataTypes);
db.CompanyDocument = require("./company-document.model")(sequelize, DataTypes);

// ===================== Finance Module =====================
db.FinanceCategory = require("./finance-category.model")(sequelize, DataTypes);
db.FinanceTransaction = require("./finance-transaction.model")(
  sequelize,
  DataTypes
);
db.Payroll = require("./payroll.model")(sequelize, DataTypes);
db.Breakdown = require("./breakdown.model")(sequelize, DataTypes);
db.PayrollSetting = require("./payroll-setting.model")(sequelize, DataTypes);

// ===================== WhatsApp Module =====================
db.WhatsappTemplateGroup = require("./whatsapp-template-group.model")(sequelize, DataTypes);
db.WhatsappTemplate = require("./whatsapp-template.model")(sequelize, DataTypes);

// ===================== KPI Module =====================
db.KpiElement = require("./kpi-element.model")(sequelize, DataTypes);
db.UserKpiConfig = require("./user-kpi-config.model")(sequelize, DataTypes);
db.UserKpiEvaluation = require("./user-kpi-evaluation.model")(sequelize, DataTypes);

// ===================== Relations =====================

// Breakdown ↔ Client
db.Breakdown.belongsTo(db.Client, { foreignKey: "client_id", as: "client" });
db.Client.hasMany(db.Breakdown, { foreignKey: "client_id", as: "breakdowns" });

// Tracking relation removed as it is now merged into Driver

// Client ↔ Contracts
db.Client.hasMany(db.ClientContract, {
  foreignKey: { name: "clientId", field: "client_id" },
  as: "contracts",
  onDelete: "CASCADE",
  hooks: true,
});
db.ClientContract.belongsTo(db.Client, {
  foreignKey: { name: "clientId", field: "client_id" },
  as: "client",
});

// Client ↔ ClientModule
db.Client.hasMany(db.ClientModule, {
  foreignKey: { name: "clientId", field: "client_id" },
  as: "modules",
  onDelete: "CASCADE",
  hooks: true,
});
db.ClientModule.belongsTo(db.Client, {
  foreignKey: { name: "clientId", field: "client_id" },
  as: "client",
});

// Client ↔ Pricing
db.Client.hasMany(db.ClientPricing, {
  foreignKey: { name: "clientId", field: "client_id" },
  as: "pricingRules",
  onDelete: "CASCADE",
  hooks: true,
});
db.ClientPricing.belongsTo(db.Client, {
  foreignKey: { name: "clientId", field: "client_id" },
  as: "client",
});

db.Hub.hasMany(db.ClientPricing, {
  foreignKey: { name: "hubId", field: "hub_id" },
  as: "pricingRules",
});
db.ClientPricing.belongsTo(db.Hub, {
  foreignKey: { name: "hubId", field: "hub_id" },
  as: "hub",
});

db.Zone.hasMany(db.ClientPricing, {
  foreignKey: { name: "zoneId", field: "zone_id" },
  as: "pricingRules",
});
db.ClientPricing.belongsTo(db.Zone, {
  foreignKey: { name: "zoneId", field: "zone_id" },
  as: "zone",
});


// ✅ Client ↔ AccountManager(Auth)
db.Client.belongsTo(db.Auth, {
  foreignKey: { name: 'accountManagerId', field: 'account_manager_id' },
  as: 'accountManagerUser',
});
db.Auth.hasMany(db.Client, {
  foreignKey: { name: 'accountManagerId', field: 'account_manager_id' },
  as: 'managedClients',
});


// Client ↔ Hub
db.Client.hasMany(db.Hub, { foreignKey: "client_id", as: "hubs" });
db.Hub.belongsTo(db.Client, { foreignKey: "client_id", as: "client" });

// Hub ↔ Zone
db.Hub.hasMany(db.Zone, { foreignKey: "hub_id", as: "zones" });
db.Zone.belongsTo(db.Hub, { foreignKey: "hub_id", as: "hub" });

// Interviews → relations
db.Interview.belongsTo(db.Client, { foreignKey: "client_id", as: "client" });
db.Interview.belongsTo(db.Hub, { foreignKey: "hub_id", as: "hub" });
db.Interview.belongsTo(db.Zone, { foreignKey: "zone_id", as: "zone" });

db.Interview.belongsTo(db.Auth, {
  foreignKey: "account_manager_id",
  as: "accountManager",
});
db.Auth.hasMany(db.Interview, {
  foreignKey: "account_manager_id",
  as: "managedInterviews",
});
db.Auth.hasMany(db.Interview, {
  foreignKey: "account_manager_id",
  as: "day1Interviews",
});
db.Interview.belongsTo(db.Auth, {
  foreignKey: "interviewer_id",
  as: "interviewer",
});

// Interview ↔ Inventory references (for reporting)
db.Interview.belongsTo(db.PendingRequest, {
  foreignKey: "inventoryPendingRequestId",
  as: "inventoryPendingRequest",
});
db.Interview.belongsTo(db.PendingRequestItem, {
  foreignKey: "inventoryPendingRequestItemId",
  as: "inventoryPendingRequestItem",
});

// PendingRequest ↔ Client / Hub / Zone
db.Client.hasMany(db.PendingRequest, {
  foreignKey: "client_id",
  as: "pendingRequests",
});
db.PendingRequest.belongsTo(db.Client, {
  foreignKey: "client_id",
  as: "client",
});

db.Hub.hasMany(db.PendingRequest, {
  foreignKey: "hub_id",
  as: "pendingRequests",
});
db.PendingRequest.belongsTo(db.Hub, { foreignKey: "hub_id", as: "hub" });

db.Zone.hasMany(db.PendingRequest, {
  foreignKey: "zone_id",
  as: "pendingRequests",
});
db.PendingRequest.belongsTo(db.Zone, { foreignKey: "zone_id", as: "zone" });

db.PendingRequest.hasMany(db.PendingRequestItem, {
  foreignKey: "pending_request_id",
  as: "items",
  onDelete: "CASCADE",
  hooks: true,
});
db.PendingRequestItem.belongsTo(db.PendingRequest, {
  foreignKey: "pending_request_id",
  as: "pendingRequest",
});

// Calls Relations
db.Client.hasMany(db.Call, { foreignKey: "client_id", as: "calls" });
db.Call.belongsTo(db.Client, { foreignKey: "client_id", as: "client" });

db.Auth.hasMany(db.Call, { foreignKey: "assignee_id", as: "assignedCalls" });
db.Call.belongsTo(db.Auth, { foreignKey: "assignee_id", as: "assignee" });

db.Auth.hasMany(db.Call, { foreignKey: "created_by_id", as: "createdCalls" });
db.Call.belongsTo(db.Auth, { foreignKey: "created_by_id", as: "createdBy" });

// Tasks Relations
db.Auth.hasMany(db.Task, { foreignKey: "assignee_id", as: "assignedTasks" });
db.Task.belongsTo(db.Auth, { foreignKey: "assignee_id", as: "assignee" });

db.Auth.hasMany(db.Task, { foreignKey: "created_by_id", as: "createdTasks" });
db.Task.belongsTo(db.Auth, { foreignKey: "created_by_id", as: "createdBy" });

// System Notifications Relations
db.Auth.hasMany(db.SystemNotification, { foreignKey: "user_id", as: "systemNotifications" });
db.SystemNotification.belongsTo(db.Auth, { foreignKey: "user_id", as: "user" });

db.Task.hasMany(db.SystemNotification, { foreignKey: "related_task_id", as: "notifications" });
db.SystemNotification.belongsTo(db.Task, { foreignKey: "related_task_id", as: "task" });

// Hierarchy (Organization structure)
db.Auth.belongsTo(db.Auth, { foreignKey: "manager_id", as: "manager" });
db.Auth.hasMany(db.Auth, { foreignKey: "manager_id", as: "subordinates" });

// HR Employees Relations
db.Employee.belongsTo(db.Auth, {
  foreignKey: { name: "authUserId", field: "auth_user_id" },
  as: "account",
});
db.Auth.hasOne(db.Employee, {
  foreignKey: { name: "authUserId", field: "auth_user_id" },
  as: "employeeProfile",
});

db.Employee.hasOne(db.EmployeeEmployment, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "employment",
  onDelete: "CASCADE",
  hooks: true,
});
db.EmployeeEmployment.belongsTo(db.Employee, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "employee",
});

db.Employee.hasOne(db.EmployeePayrollInsurance, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "payrollInsurance",
  onDelete: "CASCADE",
  hooks: true,
});
db.EmployeePayrollInsurance.belongsTo(db.Employee, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "employee",
});

db.Employee.hasMany(db.EmployeeDocument, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "documents",
  onDelete: "CASCADE",
  hooks: true,
});
db.EmployeeDocument.belongsTo(db.Employee, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "employee",
});

db.Employee.hasMany(db.EmployeeEducation, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "educations",
  onDelete: "CASCADE",
  hooks: true,
});
db.EmployeeEducation.belongsTo(db.Employee, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "employee",
});

db.Employee.hasMany(db.EmployeeEvaluation, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "evaluations",
  onDelete: "CASCADE",
  hooks: true,
});
db.EmployeeEvaluation.belongsTo(db.Employee, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "employee",
});

// Attendance Relations
db.Employee.hasOne(db.EmployeeAttendanceProfile, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "attendanceProfile",
  onDelete: "CASCADE",
  hooks: true,
});
db.EmployeeAttendanceProfile.belongsTo(db.Employee, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "employee",
});

db.AttendanceImport.hasMany(db.AttendanceDay, {
  foreignKey: { name: "importId", field: "import_id" },
  as: "days",
  onDelete: "CASCADE",
  hooks: true,
});
db.AttendanceDay.belongsTo(db.AttendanceImport, {
  foreignKey: { name: "importId", field: "import_id" },
  as: "import",
});

db.Employee.hasMany(db.AttendanceDay, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "attendanceDays",
  onDelete: "CASCADE",
  hooks: true,
});
db.AttendanceDay.belongsTo(db.Employee, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "employee",
});

db.Employee.hasMany(db.AttendanceExcuse, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "attendanceExcuses",
  onDelete: "CASCADE",
  hooks: true,
});
db.AttendanceExcuse.belongsTo(db.Employee, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "employee",
});

db.Employee.hasMany(db.AttendanceMonthlySummary, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "attendanceMonthlySummaries",
  onDelete: "CASCADE",
  hooks: true,
});
db.AttendanceMonthlySummary.belongsTo(db.Employee, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "employee",
});

db.Employee.hasMany(db.AttendanceManualItem, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "attendanceManualItems",
  onDelete: "CASCADE",
  hooks: true,
});
db.AttendanceManualItem.belongsTo(db.Employee, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "employee",
});

// Employee ↔ AttendanceRequest
db.Employee.hasMany(db.AttendanceRequest, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "attendanceRequests",
  onDelete: "CASCADE",
  hooks: true,
});
db.AttendanceRequest.belongsTo(db.Employee, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "employee",
});


// Driver ↔ DriverLoan
db.Driver.hasMany(db.DriverLoan, {
  foreignKey: { name: "driverId", field: "driver_id" },
  as: "loans",
  onDelete: "CASCADE",
  hooks: true,
});

db.DriverLoan.belongsTo(db.Driver, {
  foreignKey: { name: "driverId", field: "driver_id" },
  as: "driver",
});

// Driver ↔ DriverComplaint
db.Driver.hasMany(db.DriverComplaint, {
  foreignKey: { name: "driverId", field: "driver_id" },
  as: "complaints",
  onDelete: "CASCADE",
  hooks: true,
});

db.DriverComplaint.belongsTo(db.Driver, {
  foreignKey: { name: "driverId", field: "driver_id" },
  as: "driver",
});

// DriverLoan ↔ Auth (audit / decision)
db.DriverLoan.belongsTo(db.Auth, {
  foreignKey: "created_by_id",
  as: "createdBy",
});
db.DriverLoan.belongsTo(db.Auth, {
  foreignKey: "updated_by_id",
  as: "updatedBy",
});
db.DriverLoan.belongsTo(db.Auth, {
  foreignKey: "deleted_by_id",
  as: "deletedBy",
});
db.DriverLoan.belongsTo(db.Auth, {
  foreignKey: "decided_by_id",
  as: "decidedBy",
});

// ===================== Employee Loans Relations =====================

// Employee ↔ LoanPolicy (one per employee)
db.Employee.hasOne(db.EmployeeLoanPolicy, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "loanPolicy",
  onDelete: "CASCADE",
  hooks: true,
});
db.EmployeeLoanPolicy.belongsTo(db.Employee, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "employee",
});

// Employee ↔ Loans (many)
db.Employee.hasMany(db.EmployeeLoan, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "loans",
  onDelete: "CASCADE",
  hooks: true,
});
db.EmployeeLoan.belongsTo(db.Employee, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "employee",
});

// ✅ EmployeeLoan ↔ LoanInstallment
db.EmployeeLoan.hasMany(db.LoanInstallment, {
  foreignKey: { name: "loanId", field: "loan_id" },
  as: "installments",
  onDelete: "CASCADE",
  hooks: true,
});
db.LoanInstallment.belongsTo(db.EmployeeLoan, {
  foreignKey: { name: "loanId", field: "loan_id" },
  as: "loan",
});

// ✅ Employee ↔ LoanInstallment (optional but useful)
db.Employee.hasMany(db.LoanInstallment, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "loanInstallments",
  onDelete: "CASCADE",
  hooks: true,
});
db.LoanInstallment.belongsTo(db.Employee, {
  foreignKey: { name: "employeeId", field: "employee_id" },
  as: "employee",
});

// ✅ LoanRequest relations (basic)
db.LoanRequest.belongsTo(db.Employee, {
  foreignKey: { name: "requesterId", field: "requester_id" },
  as: "requester",
});
db.Employee.hasMany(db.LoanRequest, {
  foreignKey: { name: "requesterId", field: "requester_id" },
  as: "loanRequests",
});

// decidedById غالباً Auth
db.LoanRequest.belongsTo(db.Auth, {
  foreignKey: { name: "decidedById", field: "decided_by_id" },
  as: "decidedBy",
});
db.Auth.hasMany(db.LoanRequest, {
  foreignKey: { name: "decidedById", field: "decided_by_id" },
  as: "decidedLoanRequests",
});

// ===================== Audit Relations =====================

// AuditLog ↔ Auth
db.AuditLog.belongsTo(db.Auth, { foreignKey: "actorId", as: "actor" });
db.Auth.hasMany(db.AuditLog, { foreignKey: "actorId", as: "auditLogs" });

// AIUsageLog ↔ Auth & Employee
db.AIUsageLog.belongsTo(db.Auth, { foreignKey: "authUserId", as: "user" });
db.Auth.hasMany(db.AIUsageLog, { foreignKey: "authUserId", as: "aiUsageLogs" });
db.AIUsageLog.belongsTo(db.Employee, { foreignKey: "employeeId", as: "employee" });
db.Employee.hasMany(db.AIUsageLog, { foreignKey: "employeeId", as: "aiUsageLogs" });

// Driver created/updated/deleted by
db.Driver.belongsTo(db.Auth, { foreignKey: "created_by_id", as: "createdBy" });
db.Driver.belongsTo(db.Auth, { foreignKey: "updated_by_id", as: "updatedBy" });
db.Driver.belongsTo(db.Auth, { foreignKey: "deleted_by_id", as: "deletedBy" });

// Interview created/updated/deleted by
db.Interview.belongsTo(db.Auth, {
  foreignKey: "created_by_id",
  as: "createdBy",
});
db.Interview.belongsTo(db.Auth, {
  foreignKey: "updated_by_id",
  as: "updatedBy",
});
db.Interview.belongsTo(db.Auth, {
  foreignKey: "deleted_by_id",
  as: "deletedBy",
});

// Company ↔ CompanyDocument
db.Company.hasMany(db.CompanyDocument, {
  foreignKey: { name: "companyId", field: "company_id" },
  as: "documents",
  onDelete: "CASCADE",
  hooks: true,
});
db.CompanyDocument.belongsTo(db.Company, {
  foreignKey: { name: "companyId", field: "company_id" },
  as: "company",
});

// DocumentType ↔ CompanyDocument
db.DocumentType.hasMany(db.CompanyDocument, {
  foreignKey: { name: "typeId", field: "type_id" },
  as: "documents",
  onDelete: "RESTRICT",
});
db.CompanyDocument.belongsTo(db.DocumentType, {
  foreignKey: { name: "typeId", field: "type_id" },
  as: "type",
});


// Vendor ↔ Driver (mandatory)
db.Vendor.hasMany(db.Driver, { foreignKey: "vendor_id", as: "drivers" });
db.Driver.belongsTo(db.Vendor, { foreignKey: "vendor_id", as: "vendor" });

// Vendor ↔ Interview (so you can pick vendor on create interview)
db.Vendor.hasMany(db.Interview, { foreignKey: "vendor_id", as: "interviews" });
db.Interview.belongsTo(db.Vendor, { foreignKey: "vendor_id", as: "vendor" });

// ===================== Finance Relations =====================

// FinanceTransaction ↔ FinanceCategory
db.FinanceCategory.hasMany(db.FinanceTransaction, {
  foreignKey: "category_id",
  as: "transactions",
});
db.FinanceTransaction.belongsTo(db.FinanceCategory, {
  foreignKey: "category_id",
  as: "category",
});

// Payroll ↔ Employee
db.Employee.hasMany(db.Payroll, {
  foreignKey: "employee_id",
  as: "payrolls",
});
db.Payroll.belongsTo(db.Employee, {
  foreignKey: "employee_id",
  as: "employee",
});

// Payroll ↔ Driver
db.Driver.hasMany(db.Payroll, {
  foreignKey: "driver_id",
  as: "payrolls",
});
db.Payroll.belongsTo(db.Driver, {
  foreignKey: "driver_id",
  as: "driver",
});

// FinanceTransaction ↔ Auth (CreatedBy)
db.FinanceTransaction.belongsTo(db.Auth, {
  foreignKey: "created_by_id",
  as: "createdBy",
});

// Payroll ↔ FinanceTransaction (Reference)
// Note: This is a loose relation via referenceId/referenceType, 
// but we can also add a direct relation if we want. 
// For now, let's keep it flexible.

// ===================== Attach Audit Hooks =====================
const { attachAuditHooks } = require("../services/audit-hooks.service");

attachAuditHooks({
  model: db.Driver,
  entityType: "Driver",
  AuditLogModel: db.AuditLog,
});
attachAuditHooks({
  model: db.Interview,
  entityType: "Interview",
  AuditLogModel: db.AuditLog,
});
attachAuditHooks({
  model: db.CompanyDocument,
  entityType: "CompanyDocument",
  AuditLogModel: db.AuditLog,
});

attachAuditHooks({
  model: db.DriverLoan,
  entityType: "DriverLoan",
  AuditLogModel: db.AuditLog,
});

// Setup Whatsapp Relations
if (db.WhatsappTemplateGroup && db.WhatsappTemplate) {
  db.WhatsappTemplateGroup.hasMany(db.WhatsappTemplate, {
    foreignKey: "groupId",
    as: "templates",
    onDelete: "CASCADE",
  });
  db.WhatsappTemplate.belongsTo(db.WhatsappTemplateGroup, {
    foreignKey: "groupId",
    as: "group",
  });
}

// Driver Financial Requests Relations
db.Driver.hasMany(db.DriverFinancialRequest, {
  foreignKey: { name: "driverId", field: "driver_id" },
  as: "financialRequests",
});
db.DriverFinancialRequest.belongsTo(db.Driver, {
  foreignKey: { name: "driverId", field: "driver_id" },
  as: "driver",
});
db.DriverFinancialRequest.belongsTo(db.Auth, {
  foreignKey: { name: "accountManagerId", field: "account_manager_id" },
  as: "accountManager",
});

// Notifications Relations
db.DriverNotificationBlast.belongsTo(db.Auth, {
  foreignKey: { name: "senderId", field: "sender_id" },
  as: "sender",
});
db.DriverNotification.belongsTo(db.DriverNotificationBlast, {
  foreignKey: { name: "blastId", field: "blast_id" },
  as: "blast",
  onDelete: "CASCADE",
});
db.DriverNotification.belongsTo(db.Driver, {
  foreignKey: { name: "driverId", field: "driver_id" },
  as: "driver",
  onDelete: "CASCADE",
});
db.Driver.hasMany(db.DriverNotification, {
  foreignKey: { name: "driverId", field: "driver_id" },
  as: "notifications",
});

// Driver Attendance Relations
db.Driver.hasMany(db.DriverAttendance, {
  foreignKey: { name: "driverId", field: "driver_id" },
  as: "attendances",
  onDelete: "CASCADE",
});
db.DriverAttendance.belongsTo(db.Driver, {
  foreignKey: { name: "driverId", field: "driver_id" },
  as: "driver",
});

// ===================== KPI Relations =====================
db.KpiElement.hasMany(db.UserKpiConfig, {
  foreignKey: { name: 'kpiElementId', field: 'kpi_element_id' },
  as: 'userConfigs'
});
db.UserKpiConfig.belongsTo(db.KpiElement, {
  foreignKey: { name: 'kpiElementId', field: 'kpi_element_id' },
  as: 'kpiElement'
});

db.Auth.hasMany(db.UserKpiConfig, {
  foreignKey: { name: 'authUserId', field: 'auth_user_id' },
  as: 'kpiConfigs'
});
db.UserKpiConfig.belongsTo(db.Auth, {
  foreignKey: { name: 'authUserId', field: 'auth_user_id' },
  as: 'user'
});

db.UserKpiConfig.hasMany(db.UserKpiEvaluation, {
  foreignKey: { name: 'userKpiConfigId', field: 'user_kpi_config_id' },
  as: 'evaluations'
});
db.UserKpiEvaluation.belongsTo(db.UserKpiConfig, {
  foreignKey: { name: 'userKpiConfigId', field: 'user_kpi_config_id' },
  as: 'config'
});

db.Auth.hasMany(db.UserKpiEvaluation, {
  foreignKey: { name: 'evaluatedById', field: 'evaluated_by_id' },
  as: 'givenEvaluations'
});
db.UserKpiEvaluation.belongsTo(db.Auth, {
  foreignKey: { name: 'evaluatedById', field: 'evaluated_by_id' },
  as: 'evaluator'
});

// ===================== ZKTeco Relations =====================
db.AttendanceDevice.hasMany(db.AttendanceDeviceUser, {
  foreignKey: { name: 'attendanceDeviceId', field: 'attendance_device_id' },
  as: 'users',
  onDelete: 'CASCADE'
});
db.AttendanceDeviceUser.belongsTo(db.AttendanceDevice, {
  foreignKey: { name: 'attendanceDeviceId', field: 'attendance_device_id' },
  as: 'device'
});

db.AttendanceDevice.hasMany(db.AttendanceRawLog, {
  foreignKey: { name: 'attendanceDeviceId', field: 'attendance_device_id' },
  as: 'rawLogs',
  onDelete: 'CASCADE'
});
db.AttendanceRawLog.belongsTo(db.AttendanceDevice, {
  foreignKey: { name: 'attendanceDeviceId', field: 'attendance_device_id' },
  as: 'device'
});

db.Employee.hasMany(db.EmployeeDeviceMapping, {
  foreignKey: { name: 'employeeId', field: 'employee_id' },
  as: 'deviceMappings',
  onDelete: 'CASCADE'
});
db.EmployeeDeviceMapping.belongsTo(db.Employee, {
  foreignKey: { name: 'employeeId', field: 'employee_id' },
  as: 'employee'
});

db.AttendanceDevice.hasMany(db.EmployeeDeviceMapping, {
  foreignKey: { name: 'attendanceDeviceId', field: 'attendance_device_id' },
  as: 'employeeMappings',
  onDelete: 'CASCADE'
});
db.EmployeeDeviceMapping.belongsTo(db.AttendanceDevice, {
  foreignKey: { name: 'attendanceDeviceId', field: 'attendance_device_id' },
  as: 'device'
});

// ===================== Chat Relations =====================
db.ChatMessage.belongsTo(db.Auth, { as: "sender", foreignKey: "sender_id" });
db.ChatMessage.belongsTo(db.Auth, { as: "receiver", foreignKey: "receiver_id" });
db.Auth.hasMany(db.ChatMessage, { as: "sentMessages", foreignKey: "sender_id" });
db.Auth.hasMany(db.ChatMessage, { as: "receivedMessages", foreignKey: "receiver_id" });

module.exports = db;

