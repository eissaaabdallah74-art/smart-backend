// src/models/index.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config");

const db = {};
db.sequelize = sequelize;

// ===================== Models =====================

db.Auth = require("./auth.model")(sequelize, DataTypes);
db.Client = require("./client.model")(sequelize, DataTypes);
db.ClientContract = require("./client-contract.model")(sequelize, DataTypes);
db.Driver = require("./driver.model")(sequelize, DataTypes);
db.Tracking = require("./tracking.model")(sequelize, DataTypes);
db.Hub = require("./hub.model")(sequelize, DataTypes);
db.Zone = require("./zone.model")(sequelize, DataTypes);
db.Interview = require("./interview.model")(sequelize, DataTypes);

db.Vendor = require("./vendor.model")(sequelize, DataTypes);

db.DriverLoan = require("./driver-loan.model")(sequelize, DataTypes);

// ===================== Audit Logs =====================
db.AuditLog = require("./audit-log.model")(sequelize, DataTypes);

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

// ===================== Relations =====================

// Tracking ↔ Driver
db.Tracking.belongsTo(db.Driver, { foreignKey: "driver_id", as: "driver" });
db.Driver.hasMany(db.Tracking, { foreignKey: "driver_id", as: "trackingRows" });

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


module.exports = db;
