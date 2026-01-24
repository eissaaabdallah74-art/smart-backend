// src/models/index.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const db = {};
db.sequelize = sequelize;

// Models
db.Auth = require('./auth.model')(sequelize, DataTypes);
db.Client = require('./client.model')(sequelize, DataTypes);
db.ClientContract = require('./client-contract.model')(sequelize, DataTypes);
db.Driver = require('./driver.model')(sequelize, DataTypes);
db.Tracking = require('./tracking.model')(sequelize, DataTypes);
db.Hub = require('./hub.model')(sequelize, DataTypes);
db.Zone = require('./zone.model')(sequelize, DataTypes);
db.Interview = require('./interview.model')(sequelize, DataTypes);
db.LoanRequest = require('./loan-request.model')(sequelize, DataTypes);


// ===================== NEW: Attendance Module =====================
db.EmployeeAttendanceProfile = require('./employee-attendance-profile.model')(sequelize, DataTypes);
db.AttendanceImport = require('./attendance-import.model')(sequelize, DataTypes);
db.AttendanceDay = require('./attendance-day.model')(sequelize, DataTypes);
db.AttendanceExcuse = require('./attendance-excuse.model')(sequelize, DataTypes);
db.AttendanceMonthlySummary = require('./attendance-monthly-summary.model')(sequelize, DataTypes);
db.AttendanceManualItem = require('./attendance-manual-item.model')(sequelize, DataTypes);






// Pending Requests
db.PendingRequest = require('./pending-request.model')(sequelize, DataTypes);
db.PendingRequestItem = require('./pending-request-item.model')(
  sequelize,
  DataTypes
);

// NEW: Calls
db.Call = require('./call.model')(sequelize, DataTypes);

// NEW: Tasks (Taskboard)
db.Task = require('./task.model')(sequelize, DataTypes);

// ===================== NEW: HR Employees Module =====================
db.Employee = require('./employee.model')(sequelize, DataTypes);
db.EmployeeEmployment = require('./employee-employment.model')(
  sequelize,
  DataTypes
);
db.EmployeePayrollInsurance = require('./employee-payroll-insurance.model')(
  sequelize,
  DataTypes
);
db.EmployeeDocument = require('./employee-document.model')(sequelize, DataTypes);
db.EmployeeEducation = require('./employee-education.model')(sequelize, DataTypes);
db.EmployeeEvaluation = require('./employee-evaluation.model')(sequelize, DataTypes);

// ===== Relations =====

// Tracking ↔ Driver
db.Tracking.belongsTo(db.Driver, { foreignKey: 'driver_id', as: 'driver' });
db.Driver.hasMany(db.Tracking, {
  foreignKey: 'driver_id',
  as: 'trackingRows',
});


// Client ↔ Contracts
db.Client.hasMany(db.ClientContract, {
  foreignKey: { name: 'clientId', field: 'client_id' },
  as: 'contracts',
  onDelete: 'CASCADE',
  hooks: true,
});

db.ClientContract.belongsTo(db.Client, {
  foreignKey: { name: 'clientId', field: 'client_id' },
  as: 'client',
});


// Client ↔ Hub
db.Client.hasMany(db.Hub, { foreignKey: 'client_id', as: 'hubs' });
db.Hub.belongsTo(db.Client, { foreignKey: 'client_id', as: 'client' });

// Hub ↔ Zone
db.Hub.hasMany(db.Zone, { foreignKey: 'hub_id', as: 'zones' });
db.Zone.belongsTo(db.Hub, { foreignKey: 'hub_id', as: 'hub' });

// Interviews → relations
db.Interview.belongsTo(db.Client, { foreignKey: 'client_id', as: 'client' });
db.Interview.belongsTo(db.Hub, { foreignKey: 'hub_id', as: 'hub' });
db.Interview.belongsTo(db.Zone, { foreignKey: 'zone_id', as: 'zone' });

db.Interview.belongsTo(db.Auth, {
  foreignKey: 'account_manager_id',
  as: 'accountManager',
});

// Interview ↔ Inventory references (for reporting)
db.Interview.belongsTo(db.PendingRequest, {
  foreignKey: 'inventoryPendingRequestId',
  as: 'inventoryPendingRequest',
});

db.Interview.belongsTo(db.PendingRequestItem, {
  foreignKey: 'inventoryPendingRequestItemId',
  as: 'inventoryPendingRequestItem',
});

db.Interview.belongsTo(db.Auth, {
  foreignKey: 'interviewer_id',
  as: 'interviewer',
});

// PendingRequest ↔ Client / Hub / Zone
db.Client.hasMany(db.PendingRequest, {
  foreignKey: 'client_id',
  as: 'pendingRequests',
});
db.PendingRequest.belongsTo(db.Client, {
  foreignKey: 'client_id',
  as: 'client',
});

db.Hub.hasMany(db.PendingRequest, {
  foreignKey: 'hub_id',
  as: 'pendingRequests',
});
db.PendingRequest.belongsTo(db.Hub, {
  foreignKey: 'hub_id',
  as: 'hub',
});

db.Zone.hasMany(db.PendingRequest, {
  foreignKey: 'zone_id',
  as: 'pendingRequests',
});
db.PendingRequest.belongsTo(db.Zone, {
  foreignKey: 'zone_id',
  as: 'zone',
});

db.PendingRequest.hasMany(db.PendingRequestItem, {
  foreignKey: 'pending_request_id',
  as: 'items',
  onDelete: 'CASCADE',
  hooks: true,
});
db.PendingRequestItem.belongsTo(db.PendingRequest, {
  foreignKey: 'pending_request_id',
  as: 'pendingRequest',
});


// ===================== Loans Relations =====================

// LoanRequest ↔ Requester (Auth)
db.Auth.hasMany(db.LoanRequest, {
  foreignKey: 'requester_id',
  as: 'loanRequests',
});
db.LoanRequest.belongsTo(db.Auth, {
  foreignKey: 'requester_id',
  as: 'requester',
});

// LoanRequest ↔ DecidedBy (Auth)
db.Auth.hasMany(db.LoanRequest, {
  foreignKey: 'decided_by_id',
  as: 'decidedLoanRequests',
});
db.LoanRequest.belongsTo(db.Auth, {
  foreignKey: 'decided_by_id',
  as: 'decidedBy',
});




// ===== Calls Relations =====

// Call ↔ Client
db.Client.hasMany(db.Call, { foreignKey: 'client_id', as: 'calls' });
db.Call.belongsTo(db.Client, { foreignKey: 'client_id', as: 'client' });

// Call ↔ Assignee (Auth: senior/junior)
db.Auth.hasMany(db.Call, {
  foreignKey: 'assignee_id',
  as: 'assignedCalls',
});
db.Call.belongsTo(db.Auth, {
  foreignKey: 'assignee_id',
  as: 'assignee',
});

// Call ↔ CreatedBy (Auth: manager/supervisor)
db.Auth.hasMany(db.Call, {
  foreignKey: 'created_by_id',
  as: 'createdCalls',
});
db.Call.belongsTo(db.Auth, {
  foreignKey: 'created_by_id',
  as: 'createdBy',
});

// ===== Tasks Relations (Taskboard) =====

// Task ↔ Assignee (Auth: senior/junior operation)
db.Auth.hasMany(db.Task, {
  foreignKey: 'assignee_id',
  as: 'assignedTasks',
});
db.Task.belongsTo(db.Auth, {
  foreignKey: 'assignee_id',
  as: 'assignee',
});

// Task ↔ CreatedBy (Auth: manager/supervisor/admin)
db.Auth.hasMany(db.Task, {
  foreignKey: 'created_by_id',
  as: 'createdTasks',
});
db.Task.belongsTo(db.Auth, {
  foreignKey: 'created_by_id',
  as: 'createdBy',
});

// ===================== HR Employees Relations =====================

// Employee ↔ Auth (optional 1-1)
// IMPORTANT: to avoid creating a new unexpected attribute, we bind name+field
db.Employee.belongsTo(db.Auth, {
  foreignKey: { name: 'authUserId', field: 'auth_user_id' },
  as: 'account',
});
db.Auth.hasOne(db.Employee, {
  foreignKey: { name: 'authUserId', field: 'auth_user_id' },
  as: 'employeeProfile',
});

// Employee ↔ Employment (1-1)
db.Employee.hasOne(db.EmployeeEmployment, {
  foreignKey: { name: 'employeeId', field: 'employee_id' },
  as: 'employment',
  onDelete: 'CASCADE',
  hooks: true,
});
db.EmployeeEmployment.belongsTo(db.Employee, {
  foreignKey: { name: 'employeeId', field: 'employee_id' },
  as: 'employee',
});

// Employee ↔ PayrollInsurance (1-1)
db.Employee.hasOne(db.EmployeePayrollInsurance, {
  foreignKey: { name: 'employeeId', field: 'employee_id' },
  as: 'payrollInsurance',
  onDelete: 'CASCADE',
  hooks: true,
});
db.EmployeePayrollInsurance.belongsTo(db.Employee, {
  foreignKey: { name: 'employeeId', field: 'employee_id' },
  as: 'employee',
});

// Employee ↔ Documents (1-many)
db.Employee.hasMany(db.EmployeeDocument, {
  foreignKey: { name: 'employeeId', field: 'employee_id' },
  as: 'documents',
  onDelete: 'CASCADE',
  hooks: true,
});
db.EmployeeDocument.belongsTo(db.Employee, {
  foreignKey: { name: 'employeeId', field: 'employee_id' },
  as: 'employee',
});

// Employee ↔ Education (1-many)
db.Employee.hasMany(db.EmployeeEducation, {
  foreignKey: { name: 'employeeId', field: 'employee_id' },
  as: 'educations',
  onDelete: 'CASCADE',
  hooks: true,
});
db.EmployeeEducation.belongsTo(db.Employee, {
  foreignKey: { name: 'employeeId', field: 'employee_id' },
  as: 'employee',
});

// Employee ↔ Evaluations (1-many)
db.Employee.hasMany(db.EmployeeEvaluation, {
  foreignKey: { name: 'employeeId', field: 'employee_id' },
  as: 'evaluations',
  onDelete: 'CASCADE',
  hooks: true,
});
db.EmployeeEvaluation.belongsTo(db.Employee, {
  foreignKey: { name: 'employeeId', field: 'employee_id' },
  as: 'employee',
});


// ===================== Attendance Relations =====================

// Employee ↔ AttendanceProfile (1-1)
db.Employee.hasOne(db.EmployeeAttendanceProfile, {
  foreignKey: { name: 'employeeId', field: 'employee_id' },
  as: 'attendanceProfile',
  onDelete: 'CASCADE',
  hooks: true,
});
db.EmployeeAttendanceProfile.belongsTo(db.Employee, {
  foreignKey: { name: 'employeeId', field: 'employee_id' },
  as: 'employee',
});

// AttendanceImport ↔ AttendanceDay
db.AttendanceImport.hasMany(db.AttendanceDay, {
  foreignKey: { name: 'importId', field: 'import_id' },
  as: 'days',
  onDelete: 'CASCADE',
  hooks: true,
});
db.AttendanceDay.belongsTo(db.AttendanceImport, {
  foreignKey: { name: 'importId', field: 'import_id' },
  as: 'import',
});

// Employee ↔ AttendanceDay
db.Employee.hasMany(db.AttendanceDay, {
  foreignKey: { name: 'employeeId', field: 'employee_id' },
  as: 'attendanceDays',
  onDelete: 'CASCADE',
  hooks: true,
});
db.AttendanceDay.belongsTo(db.Employee, {
  foreignKey: { name: 'employeeId', field: 'employee_id' },
  as: 'employee',
});

// Employee ↔ Excuses
db.Employee.hasMany(db.AttendanceExcuse, {
  foreignKey: { name: 'employeeId', field: 'employee_id' },
  as: 'attendanceExcuses',
  onDelete: 'CASCADE',
  hooks: true,
});
db.AttendanceExcuse.belongsTo(db.Employee, {
  foreignKey: { name: 'employeeId', field: 'employee_id' },
  as: 'employee',
});

// Employee ↔ MonthlySummary
db.Employee.hasMany(db.AttendanceMonthlySummary, {
  foreignKey: { name: 'employeeId', field: 'employee_id' },
  as: 'attendanceMonthlySummaries',
  onDelete: 'CASCADE',
  hooks: true,
});
db.AttendanceMonthlySummary.belongsTo(db.Employee, {
  foreignKey: { name: 'employeeId', field: 'employee_id' },
  as: 'employee',
});


// Employee ↔ ManualItems (1-many)
db.Employee.hasMany(db.AttendanceManualItem, {
  foreignKey: { name: 'employeeId', field: 'employee_id' },
  as: 'attendanceManualItems',
  onDelete: 'CASCADE',
  hooks: true,
});

db.AttendanceManualItem.belongsTo(db.Employee, {
  foreignKey: { name: 'employeeId', field: 'employee_id' },
  as: 'employee',
});




module.exports = db;
