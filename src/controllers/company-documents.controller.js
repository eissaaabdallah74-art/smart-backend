// src/controllers/company-documents.controller.js
const { Op } = require("sequelize");
const db = require("../models");

const MS_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_SOON_DAYS = 30;

// =======================================================
// Helpers
// =======================================================
function utcMidnightFromDateOnly(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function utcMidnightToday() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

function addYearsDateOnly(issueDateStr, years) {
  if (!issueDateStr || !years) return null;
  const dt = utcMidnightFromDateOnly(issueDateStr);
  if (!dt) return null;
  const y = dt.getUTCFullYear() + Number(years);
  const m = dt.getUTCMonth();
  const d = dt.getUTCDate();
  const out = new Date(Date.UTC(y, m, d));
  const mm = String(out.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(out.getUTCDate()).padStart(2, "0");
  return `${out.getUTCFullYear()}-${mm}-${dd}`;
}

function computeDocumentView(row, soonDays = DEFAULT_SOON_DAYS) {
  const today = utcMidnightToday();

  const issueDate = row.issueDate || null;
  const expiryDateRaw = row.expiryDate || null;

  const computedExpiryDate =
    expiryDateRaw || addYearsDateOnly(issueDate, row.validityYears);

  const expiryUtc = utcMidnightFromDateOnly(computedExpiryDate);
  let remainingDays = null;

  if (expiryUtc) remainingDays = Math.floor((expiryUtc - today) / MS_DAY);

  let status = "ONGOING";
  let statusLabelAr = "مستمر";

  if (expiryUtc) {
    if (remainingDays < 0) {
      status = "EXPIRED";
      statusLabelAr = "منتهية";
    } else if (remainingDays <= soonDays) {
      status = "EXPIRING_SOON";
      statusLabelAr = "قارب الانتهاء";
    } else {
      status = "ACTIVE";
      statusLabelAr = "سارية";
    }
  }

  return {
    ...row.toJSON(),
    computed: {
      computedExpiryDate,
      remainingDays,
      status,
      statusLabelAr,
      soonDays,
    },
  };
}

function validatePayload(body) {
  const errors = [];

  if (!body.companyId) errors.push("companyId is required");
  if (!body.typeId) errors.push("typeId is required");

  if (body.issueDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.issueDate))
    errors.push("issueDate must be YYYY-MM-DD");
  if (body.expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.expiryDate))
    errors.push("expiryDate must be YYYY-MM-DD");
  if (body.remindAt && !/^\d{4}-\d{2}-\d{2}$/.test(body.remindAt))
    errors.push("remindAt must be YYYY-MM-DD");

  if (body.validityYears != null) {
    const vy = Number(body.validityYears);
    if (!Number.isFinite(vy) || vy <= 0 || vy > 100)
      errors.push("validityYears must be 1..100");
  }

  return errors;
}

// =======================================================
// NEW: Dropdowns (Companies + Document Types)
// =======================================================

// GET /api/company-documents/companies
exports.listCompanies = async (_req, res) => {
  try {
    if (!db.Company) {
      return res.status(500).json({
        ok: false,
        message: "Company model is not registered in db",
      });
    }

    const rows = await db.Company.findAll({
      order: [["name", "ASC"]],
      attributes: ["id", "code", "name", "isActive"],
    });

    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("company-documents.listCompanies error:", err);
    return res.status(500).json({ ok: false, message: "Internal Server Error" });
  }
};

// GET /api/company-documents/document-types
exports.listDocumentTypes = async (_req, res) => {
  try {
    if (!db.DocumentType) {
      return res.status(500).json({
        ok: false,
        message: "DocumentType model is not registered in db",
      });
    }

    const rows = await db.DocumentType.findAll({
      order: [["nameAr", "ASC"]],
      attributes: ["id", "code", "nameAr", "nameEn", "defaultSoonDays", "isActive"],
    });

    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("company-documents.listDocumentTypes error:", err);
    return res.status(500).json({ ok: false, message: "Internal Server Error" });
  }
};

// POST /api/company-documents/document-types  (اختياري)
exports.createDocumentType = async (req, res) => {
  try {
    const { code, nameAr, nameEn, defaultSoonDays } = req.body || {};

    if (!code || !nameAr) {
      return res.status(400).json({
        ok: false,
        message: "code and nameAr are required",
      });
    }

    const row = await db.DocumentType.create({
      code,
      nameAr,
      nameEn: nameEn || null,
      defaultSoonDays: defaultSoonDays ?? null,
      isActive: true,
    });

    return res.status(201).json({ ok: true, data: row });
  } catch (err) {
    console.error("company-documents.createDocumentType error:", err);

    // لو unique على code
    if (String(err?.name || "").includes("SequelizeUniqueConstraintError")) {
      return res.status(409).json({ ok: false, message: "code already exists" });
    }

    return res.status(500).json({ ok: false, message: "Internal Server Error" });
  }
};

// =======================================================
// Company Documents (Sheet CRUD)
// =======================================================

// GET /api/company-documents
exports.list = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "20", 10), 1),
      200
    );
    const offset = (page - 1) * limit;

    const {
      companyId,
      typeId,
      q,
      expFrom,
      expTo,
      sort = "createdDesc", // createdDesc | expiryAsc | expiryDesc
      status, // ACTIVE | EXPIRED | EXPIRING_SOON | ONGOING
      soonDays,
    } = req.query;

    const soon = soonDays
      ? Math.max(parseInt(soonDays, 10), 1)
      : DEFAULT_SOON_DAYS;

    const where = {};
    if (companyId) where.companyId = Number(companyId);
    if (typeId) where.typeId = Number(typeId);

    if (q) {
      where[Op.or] = [
        { documentNumber: { [Op.like]: `%${q}%` } },
        { currentLocation: { [Op.like]: `%${q}%` } },
        { custodianName: { [Op.like]: `%${q}%` } },
        { custodianPhone: { [Op.like]: `%${q}%` } },
        { custodianOrganization: { [Op.like]: `%${q}%` } },
        { notes: { [Op.like]: `%${q}%` } },
      ];
    }

    if (expFrom || expTo) {
      where.expiryDate = {};
      if (expFrom) where.expiryDate[Op.gte] = expFrom;
      if (expTo) where.expiryDate[Op.lte] = expTo;
    }

    let order = [["createdAt", "DESC"]];
    if (sort === "expiryAsc")
      order = [["expiryDate", "ASC"], ["createdAt", "DESC"]];
    if (sort === "expiryDesc")
      order = [["expiryDate", "DESC"], ["createdAt", "DESC"]];

    const useInMemoryStatusFilter = Boolean(status);
    const queryLimit = useInMemoryStatusFilter ? 1000 : limit;
    const queryOffset = useInMemoryStatusFilter ? 0 : offset;

    const result = await db.CompanyDocument.findAndCountAll({
      where,
      include: [
        { model: db.Company, as: "company", attributes: ["id", "code", "name"] },
        {
          model: db.DocumentType,
          as: "type",
          attributes: ["id", "code", "nameAr", "nameEn", "defaultSoonDays"],
        },
      ],
      order,
      limit: queryLimit,
      offset: queryOffset,
      distinct: true,
    });

    let rows = result.rows.map((r) => {
      const typeSoon = r.type?.defaultSoonDays || soon;
      return computeDocumentView(r, typeSoon);
    });

    if (useInMemoryStatusFilter) {
      rows = rows.filter((x) => x.computed.status === status);
    }

    const total = useInMemoryStatusFilter ? rows.length : result.count;
    const totalPages = Math.max(Math.ceil(total / limit), 1);

    if (useInMemoryStatusFilter) {
      rows = rows.slice(offset, offset + limit);
    }

    return res.json({
      ok: true,
      data: rows,
      meta: { page, limit, total, totalPages },
    });
  } catch (err) {
    console.error("company-documents.list error:", err);
    return res.status(500).json({ ok: false, message: "Internal Server Error" });
  }
};

// GET /api/company-documents/:id
exports.getOne = async (req, res) => {
  try {
    const row = await db.CompanyDocument.findByPk(req.params.id, {
      include: [
        { model: db.Company, as: "company", attributes: ["id", "code", "name"] },
        {
          model: db.DocumentType,
          as: "type",
          attributes: ["id", "code", "nameAr", "nameEn", "defaultSoonDays"],
        },
      ],
    });
    if (!row) return res.status(404).json({ ok: false, message: "Not Found" });

    const soon = row.type?.defaultSoonDays || DEFAULT_SOON_DAYS;
    return res.json({ ok: true, data: computeDocumentView(row, soon) });
  } catch (err) {
    console.error("company-documents.getOne error:", err);
    return res.status(500).json({ ok: false, message: "Internal Server Error" });
  }
};

// POST /api/company-documents
exports.create = async (req, res) => {
  try {
    const errors = validatePayload(req.body);
    if (errors.length) return res.status(400).json({ ok: false, errors });

    const company = await db.Company.findByPk(req.body.companyId);
    if (!company)
      return res.status(400).json({ ok: false, message: "Invalid companyId" });

    const type = await db.DocumentType.findByPk(req.body.typeId);
    if (!type)
      return res.status(400).json({ ok: false, message: "Invalid typeId" });

    const row = await db.CompanyDocument.create({
      companyId: req.body.companyId,
      typeId: req.body.typeId,
      documentNumber: req.body.documentNumber || null,
      issueDate: req.body.issueDate || null,
      expiryDate: req.body.expiryDate || null,
      validityYears: req.body.validityYears ?? null,
      currentLocation: req.body.currentLocation || null,
      custodianRole: req.body.custodianRole || null,
      custodianName: req.body.custodianName || null,
      custodianPhone: req.body.custodianPhone || null,
      custodianOrganization: req.body.custodianOrganization || null,
      remindAt: req.body.remindAt || null,
      remindNote: req.body.remindNote || null,
      notes: req.body.notes || null,
    });

    const full = await db.CompanyDocument.findByPk(row.id, {
      include: [
        { model: db.Company, as: "company", attributes: ["id", "code", "name"] },
        {
          model: db.DocumentType,
          as: "type",
          attributes: ["id", "code", "nameAr", "nameEn", "defaultSoonDays"],
        },
      ],
    });

    const soon = full.type?.defaultSoonDays || DEFAULT_SOON_DAYS;
    return res.status(201).json({ ok: true, data: computeDocumentView(full, soon) });
  } catch (err) {
    console.error("company-documents.create error:", err);
    return res.status(500).json({ ok: false, message: "Internal Server Error" });
  }
};

// PUT /api/company-documents/:id
exports.update = async (req, res) => {
  try {
    const row = await db.CompanyDocument.findByPk(req.params.id);
    if (!row) return res.status(404).json({ ok: false, message: "Not Found" });

    const errors = validatePayload({
      companyId: row.companyId,
      typeId: row.typeId,
      ...req.body,
    });
    if (errors.length) return res.status(400).json({ ok: false, errors });

    if (req.body.companyId) {
      const company = await db.Company.findByPk(req.body.companyId);
      if (!company)
        return res.status(400).json({ ok: false, message: "Invalid companyId" });
      row.companyId = req.body.companyId;
    }

    if (req.body.typeId) {
      const type = await db.DocumentType.findByPk(req.body.typeId);
      if (!type)
        return res.status(400).json({ ok: false, message: "Invalid typeId" });
      row.typeId = req.body.typeId;
    }

    const fields = [
      "documentNumber",
      "issueDate",
      "expiryDate",
      "validityYears",
      "currentLocation",
      "custodianRole",
      "custodianName",
      "custodianPhone",
      "custodianOrganization",
      "remindAt",
      "remindNote",
      "notes",
    ];

    for (const f of fields) {
      if (Object.prototype.hasOwnProperty.call(req.body, f)) {
        row[f] = req.body[f] ?? null;
      }
    }

    await row.save();

    const full = await db.CompanyDocument.findByPk(row.id, {
      include: [
        { model: db.Company, as: "company", attributes: ["id", "code", "name"] },
        {
          model: db.DocumentType,
          as: "type",
          attributes: ["id", "code", "nameAr", "nameEn", "defaultSoonDays"],
        },
      ],
    });

    const soon = full.type?.defaultSoonDays || DEFAULT_SOON_DAYS;
    return res.json({ ok: true, data: computeDocumentView(full, soon) });
  } catch (err) {
    console.error("company-documents.update error:", err);
    return res.status(500).json({ ok: false, message: "Internal Server Error" });
  }
};

// DELETE /api/company-documents/:id
exports.remove = async (req, res) => {
  try {
    const row = await db.CompanyDocument.findByPk(req.params.id);
    if (!row) return res.status(404).json({ ok: false, message: "Not Found" });

    await row.destroy();
    return res.json({ ok: true });
  } catch (err) {
    console.error("company-documents.remove error:", err);
    return res.status(500).json({ ok: false, message: "Internal Server Error" });
  }
};
