// src/controllers/audit-log.controller.js
const { Op } = require("sequelize");
const { AuditLog, Auth } = require("../models");

const DEFAULT_IGNORE_DIFF_FIELDS = new Set(["updatedAt", "createdAt", "deletedAt"]);

function isPlainObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function deepEqualLoose(a, b) {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function diffSnapshots(before, after, ignoreSet = DEFAULT_IGNORE_DIFF_FIELDS) {
  const b = isPlainObject(before) ? before : {};
  const a = isPlainObject(after) ? after : {};

  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const changeList = [];

  for (const key of keys) {
    if (ignoreSet.has(key)) continue;

    const bv = b[key];
    const av = a[key];
    if (deepEqualLoose(bv, av)) continue;

    changeList.push({ field: key, before: bv, after: av });
  }

  return changeList;
}

function buildChangeList(action, changes) {
  if (!changes) return [];

  if (changes.diff && isPlainObject(changes.diff)) {
    return Object.entries(changes.diff).map(([field, val]) => ({
      field,
      before: val?.before,
      after: val?.after,
    }));
  }

  if (isPlainObject(changes.before) || isPlainObject(changes.after)) {
    return diffSnapshots(changes.before, changes.after);
  }

  if (
    String(action || "").toUpperCase() === "INVENTORY_DECREMENT" &&
    Object.prototype.hasOwnProperty.call(changes, "before") &&
    Object.prototype.hasOwnProperty.call(changes, "after")
  ) {
    return [
      { field: "vehicleCount", before: changes.before, after: changes.after },
      { field: "vehicleType", before: null, after: changes.vehicleType ?? null },
      { field: "pendingRequestId", before: null, after: changes.pendingRequestId ?? null },
      { field: "pendingRequestItemId", before: null, after: changes.pendingRequestItemId ?? null },
    ];
  }

  if (Object.prototype.hasOwnProperty.call(changes, "after")) {
    return [{ field: "__after__", before: null, after: changes.after }];
  }
  if (Object.prototype.hasOwnProperty.call(changes, "before")) {
    return [{ field: "__before__", before: changes.before, after: null }];
  }

  return [];
}

exports.listAuditLogs = async (req, res) => {
  try {
    const {
      entity,
      entityId,
      actorId,
      action,
      q,
      limit = "20",
      offset = "0",
    } = req.query;

    const where = {};
    if (entity) where.entity = String(entity);
    if (entityId) where.entityId = Number(entityId);
    if (actorId) where.actorId = Number(actorId);
    if (action) where.action = String(action);

    if (q) {
      const like = { [Op.like]: `%${q}%` };
      where[Op.or] = [{ summary: like }, { path: like }, { method: like }];
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const safeOffset = Math.max(Number(offset) || 0, 0);

    const result = await AuditLog.findAndCountAll({
      where,
      limit: safeLimit,
      offset: safeOffset,
      order: [["createdAt", "DESC"], ["id", "DESC"]],
      include: [{ model: Auth, as: "actor", attributes: ["id", "fullName"] }],
      distinct: true,
    });

    const items = result.rows.map((row) => {
      const plain = row.get({ plain: true });
      return {
        ...plain,
        actorName: plain.actor?.fullName || null,
        changeList: buildChangeList(plain.action, plain.changes),
      };
    });

    return res.json({
      total: result.count,
      items,
      limit: safeLimit,
      offset: safeOffset,
    });
  } catch (error) {
    console.error("listAuditLogs error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
