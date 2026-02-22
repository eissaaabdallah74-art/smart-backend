// src/seed/company-documents.seed.js
const db = require("../models");

function normalizeDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s || s === "0") return null;
  return s; // YYYY-MM-DD
}

async function upsertByCode(Model, code, values) {
  const existing = await Model.findOne({ where: { code } });
  if (existing) {
    await existing.update(values);
    return existing;
  }
  return await Model.create(values);
}

async function upsertDocType({ code, nameAr, nameEn, defaultSoonDays = null }) {
  return upsertByCode(db.DocumentType, code, {
    code,
    nameAr,
    nameEn: nameEn ?? null,
    defaultSoonDays,
    isActive: true,
  });
}

async function upsertCompany({ code, name }) {
  return upsertByCode(db.Company, code, {
    code,
    name,
    isActive: true,
  });
}

async function upsertCompanyDocument({
  companyId,
  typeId,
  documentNumber,
  issueDate,
  expiryDate,
  validityYears,
  notes,
}) {
  const where = {
    companyId,
    typeId,
    documentNumber: documentNumber || null,
  };

  const existing = await db.CompanyDocument.findOne({ where });

  const payload = {
    companyId,
    typeId,
    documentNumber: documentNumber || null,
    issueDate: normalizeDate(issueDate),
    expiryDate: normalizeDate(expiryDate),
    validityYears: validityYears ?? null,

    currentLocation: null,
    custodianRole: null,
    custodianName: null,
    custodianPhone: null,
    custodianOrganization: null,
    remindAt: null,
    remindNote: null,
    notes: notes ?? null,
  };

  if (existing) {
    await existing.update(payload);
    return existing;
  }
  return await db.CompanyDocument.create(payload);
}

/**
 * ✅ DATA extracted from sheet:
 * - Sheet "SMV": 6 rows
 * - Sheet "SLS": 8 rows
 */
const SHEET_DATA = {
  SMV: [
    {
      typeNameAr: "السجل التجاري",
      documentNumber: "9884",
      issueDate: "2025-12-03",
      expiryDate: "2030-02-28",
      validityYears: null,
      status: "سارية",
      notes: "ملحوظة يجدد السجل بعد 3 شهور في 3-3-2026",
    },
    {
      typeNameAr: "البطاقة الضريبية",
      documentNumber: "579-565-009",
      issueDate: "2021-02-23",
      expiryDate: "2026-02-22",
      validityYears: null,
      status: "قربت تنتهي",
      notes: null,
    },
    {
      typeNameAr: "رخصة النقل البري",
      documentNumber: "2023/ 926",
      issueDate: "2021-06-24",
      expiryDate: "2024-06-23",
      validityYears: null,
      status: "منتهية",
      notes: null,
    },
    {
      typeNameAr: "شهادة القيمة المضافة",
      documentNumber: "579-565-009",
      issueDate: "2020-04-13",
      expiryDate: null,
      validityYears: null,
      status: "مستمرة",
      notes: null,
    },
    {
      typeNameAr: "عقد التأسيس",
      documentNumber: "06-1-05-15141-20",
      issueDate: "2020-02-27",
      expiryDate: null,
      validityYears: null,
      status: "مستمر",
      notes: null,
    },
    {
      typeNameAr: "وثيقة التأمين (أورينت) مسئولية أصحاب الاعمال",
      documentNumber: "25/100/30060/0024566",
      issueDate: "2025-05-17",
      expiryDate: "2026-05-16",
      validityYears: null,
      status: "سارية",
      notes: null,
    },
  ],

  SLS: [
    {
      typeNameAr: "السجل التجاري",
      documentNumber: "27917",
      issueDate: "2025-12-03",
      expiryDate: "2028-01-10",
      validityYears: null,
      status: "سارية",
      notes: "ملحوظة يجدد السجل بعد 3 شهور في 3-3-2026",
    },
    {
      typeNameAr: "البطاقة الضريبية",
      documentNumber: "709-326-777",
      issueDate: "2023-12-27",
      expiryDate: "2028-12-26",
      validityYears: null,
      status: "سارية",
      notes: "أ-صلاح",
    },
    {
      typeNameAr: "رخصة النقل البري",
      documentNumber: "2025/7985",
      issueDate: "2025-04-18",
      expiryDate: "2026-04-17",
      validityYears: null,
      status: "سارية",
      notes: "أ-صلاح",
    },
    {
      typeNameAr: "شهادة القيمة المضافة",
      documentNumber: "709-326-777",
      issueDate: "2023-01-24",
      expiryDate: "2028-01-23",
      validityYears: null,
      status: "سارية",
      notes: "أ-صلاح",
    },
    {
      typeNameAr: "عقد التأسيس",
      documentNumber: "06-1-05-252292-23",
      issueDate: "2023-01-10",
      expiryDate: null,
      validityYears: 25, // 25 سنة من تاريخ الاصدار
      status: "مستمر",
      notes: null,
    },
    {
      typeNameAr: "وثيقة التأمين (أورينت) مسئولية مدنية عامة",
      documentNumber: "25/100/30140/0024565",
      issueDate: "2025-05-15",
      expiryDate: "2026-05-14",
      validityYears: null,
      status: "سارية",
      notes: null,
    },
    {
      typeNameAr: "وثيقة التأمين (أورينت) نقل بري بضائع",
      documentNumber: "25/100/500700/0009763",
      issueDate: "2025-05-05",
      expiryDate: "2026-05-04",
      validityYears: null,
      status: "سارية",
      notes: null,
    },
    {
      typeNameAr: "وثيقة التأمين (أورينت) نقل بري بضائع",
      documentNumber: "25/100/500700/0009762",
      issueDate: "2025-05-05",
      expiryDate: "2026-05-04",
      validityYears: null,
      status: "سارية",
      notes: null,
    },
  ],
};

async function seedCompanyDocuments() {
  const sls = await upsertCompany({ code: "SLS", name: "SLS" });
  const smv = await upsertCompany({ code: "SMV", name: "SMV" });

  const types = {
    COMMERCIAL_REGISTRY: await upsertDocType({
      code: "COMMERCIAL_REGISTRY",
      nameAr: "السجل التجاري",
      nameEn: "Commercial Registry",
      defaultSoonDays: 90,
    }),
    TAX_CARD: await upsertDocType({
      code: "TAX_CARD",
      nameAr: "البطاقة الضريبية",
      nameEn: "Tax Card",
      defaultSoonDays: 30,
    }),
    LAND_TRANSPORT_LICENSE: await upsertDocType({
      code: "LAND_TRANSPORT_LICENSE",
      nameAr: "رخصة النقل البري",
      nameEn: "Land Transport License",
      defaultSoonDays: 30,
    }),
    VAT_CERTIFICATE: await upsertDocType({
      code: "VAT_CERTIFICATE",
      nameAr: "شهادة القيمة المضافة",
      nameEn: "VAT Certificate",
      defaultSoonDays: 30,
    }),
    ARTICLES_OF_ASSOCIATION: await upsertDocType({
      code: "ARTICLES_OF_ASSOCIATION",
      nameAr: "عقد التأسيس",
      nameEn: "Articles of Association",
      defaultSoonDays: null,
    }),
    INSURANCE_GENERAL_LIABILITY: await upsertDocType({
      code: "INSURANCE_GENERAL_LIABILITY",
      nameAr: "وثيقة التأمين (أورينت) مسئولية مدنية عامة",
      nameEn: "Insurance (Orient) - General Liability",
      defaultSoonDays: 30,
    }),
    INSURANCE_GOODS_TRANSPORT: await upsertDocType({
      code: "INSURANCE_GOODS_TRANSPORT",
      nameAr: "وثيقة التأمين (أورينت) نقل بري بضائع",
      nameEn: "Insurance (Orient) - Goods Transport",
      defaultSoonDays: 30,
    }),
    INSURANCE_EMPLOYERS_LIABILITY: await upsertDocType({
      code: "INSURANCE_EMPLOYERS_LIABILITY",
      nameAr: "وثيقة التأمين (أورينت) مسئولية أصحاب الاعمال",
      nameEn: "Insurance (Orient) - Employers Liability",
      defaultSoonDays: 30,
    }),
  };

  // nameAr -> typeId
  const typeIdByNameAr = new Map(
    Object.values(types).map((t) => [String(t.nameAr).trim(), t.id])
  );

  const companyByCode = { SMV: smv, SLS: sls };

  let upserted = 0;

  for (const [companyCode, docs] of Object.entries(SHEET_DATA)) {
    const company = companyByCode[companyCode];
    if (!company) continue;

    for (const d of docs) {
      const typeId = typeIdByNameAr.get(String(d.typeNameAr).trim());
      if (!typeId) {
        console.warn(
          `⚠️ Unknown DocumentType for company ${companyCode}: "${d.typeNameAr}" (skipped)`
        );
        continue;
      }

      const mergedNotes = [
        d.status ? `الحالة: ${d.status}` : null,
        d.notes ? d.notes : null,
      ]
        .filter(Boolean)
        .join(" | ") || null;

      await upsertCompanyDocument({
        companyId: company.id,
        typeId,
        documentNumber: d.documentNumber,
        issueDate: d.issueDate,
        expiryDate: d.expiryDate,
        validityYears: d.validityYears,
        notes: mergedNotes,
      });

      upserted++;
    }
  }

  console.log(`✅ Seed company documents done. Upserted: ${upserted}`);
}

if (require.main === module) {
  (async () => {
    try {
      await db.sequelize.authenticate();
      await seedCompanyDocuments();
      process.exit(0);
    } catch (err) {
      console.error("❌ Seed failed:", err);
      process.exit(1);
    }
  })();
}

module.exports = seedCompanyDocuments;