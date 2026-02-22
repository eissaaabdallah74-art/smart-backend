// src/services/audit-hooks.service.js
function attachAuditHooks({
  model,
  entityType,
  entity,
  AuditLogModel,
  ignoreFields = ["updatedAt", "createdAt", "deletedAt"],
  maskFields = [], // مثال: ["password"]
}) {
  if (!model || !AuditLogModel) return;

  const ENTITY = String(entityType || entity || model?.name || "").trim();
  if (!ENTITY) throw new Error("attachAuditHooks: missing entityType/entity");

  const ignored = new Set(ignoreFields.map(String));
  const masked = new Set(maskFields.map(String));

  const safeValue = (key, value) => {
    if (masked.has(key)) return "***";
    return value;
  };

  const deepEqualLoose = (a, b) => {
    if (a === b) return true;
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  };

  const toPlain = (inst) => {
    try {
      if (!inst) return null;
      if (typeof inst.toJSON === "function") return inst.toJSON();
      if (typeof inst.get === "function") return inst.get({ plain: true });
      return inst;
    } catch {
      return null;
    }
  };

  async function write(action, instance, options) {
    try {
      const audit = options?.audit || {};
      if (audit?.silent === true) return;

      const entityId = instance?.id ?? instance?.get?.("id");
      if (!entityId) return;

      const tx = options?.transaction ? { transaction: options.transaction } : undefined;

      let changes = null;

      if (action === "UPDATE") {
        const fieldsFromOptions = Array.isArray(options?.fields) ? options.fields : null;

        const candidates = (fieldsFromOptions || instance?.changed?.() || [])
          .map(String)
          .filter((k) => !ignored.has(k));

        if (candidates.length) {
          const diff = {};
          const actualChanged = [];

          for (const key of candidates) {
            const before =
              typeof instance.previous === "function" ? instance.previous(key) : undefined;

            const after =
              typeof instance.get === "function" ? instance.get(key) : instance?.[key];

            const b = safeValue(key, before);
            const a = safeValue(key, after);

            if (deepEqualLoose(b, a)) continue; // ✅ مهم: لا تسجل لو مفيش فرق فعلي

            diff[key] = { before: b, after: a };
            actualChanged.push(key);
          }

          if (!actualChanged.length) return; // ✅ ما تعملش log لو مفيش فرق فعلي

          changes = { fields: actualChanged, diff };
        } else {
          return; // ✅ مفيش fields → مفيش log
        }
      } else if (action === "CREATE") {
        const after = toPlain(instance);
        if (after && typeof after === "object") {
          for (const k of Object.keys(after)) after[k] = safeValue(k, after[k]);
        }
        changes = { after };
      } else if (action === "DELETE") {
        const before = toPlain(instance);
        if (before && typeof before === "object") {
          for (const k of Object.keys(before)) before[k] = safeValue(k, before[k]);
        }
        changes = { before };
      }

      await AuditLogModel.create(
        {
          entity: ENTITY,
          entityId: Number(entityId),
          action: String(action),
          summary: audit.summary || null,
          changes,
          meta: audit.meta || null,

          requestId: audit.requestId || null,
          actorId: audit.actorId || null,
          ip: audit.ip || null,
          userAgent: audit.userAgent || null,
          method: audit.method || null,
          path: audit.path || null,
        },
        tx
      );
    } catch (err) {
      console.error(`Audit hook failed for ${ENTITY}.${action}:`, err);
    }
  }

  model.addHook("afterCreate", `audit_afterCreate_${ENTITY}`, (inst, opt) =>
    write("CREATE", inst, opt)
  );
  model.addHook("afterUpdate", `audit_afterUpdate_${ENTITY}`, (inst, opt) =>
    write("UPDATE", inst, opt)
  );
  model.addHook("afterDestroy", `audit_afterDestroy_${ENTITY}`, (inst, opt) =>
    write("DELETE", inst, opt)
  );
}

module.exports = { attachAuditHooks };
