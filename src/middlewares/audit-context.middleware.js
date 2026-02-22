// src/middlewares/audit-context.middleware.js
const { randomUUID } = require("crypto");

function auditContextMiddleware(req, res, next) {
  const requestId = req.headers["x-request-id"] || randomUUID();

  // base context (no actorId here)
  req.auditBase = {
    requestId,
    ip: req.ip,
    userAgent: req.get("user-agent") || null,
    method: req.method,
    path: req.originalUrl,
  };

  // helper to build full audit (actorId + summary/meta etc)
  req.makeAudit = (extra = {}) => ({
    ...req.auditBase,
    actorId: req.user?.id || null, // ✅ resolved here when called
    ...extra,
  });

  res.setHeader("X-Request-Id", requestId);
  next();
}

module.exports = auditContextMiddleware;
