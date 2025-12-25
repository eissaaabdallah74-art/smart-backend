// src/models/index.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const db = {};
db.sequelize = sequelize;

// Models
db.Auth = require('./auth.model')(sequelize, DataTypes);
db.Client = require('./client.model')(sequelize, DataTypes);
db.Driver = require('./driver.model')(sequelize, DataTypes);
db.Tracking = require('./tracking.model')(sequelize, DataTypes);
db.Hub = require('./hub.model')(sequelize, DataTypes);
db.Zone = require('./zone.model')(sequelize, DataTypes);
db.Interview = require('./interview.model')(sequelize, DataTypes);

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

// ===== Relations =====

// Tracking ↔ Driver
db.Tracking.belongsTo(db.Driver, { foreignKey: 'driver_id', as: 'driver' });
db.Driver.hasMany(db.Tracking, {
  foreignKey: 'driver_id',
  as: 'trackingRows',
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

module.exports = db;
