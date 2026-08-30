// src/controllers/interview.controller.js
const { Op } = require("sequelize");
const {
  sequelize,
  Interview,
  Client,
  Hub,
  Zone,
  Auth,
  PendingRequest,
  PendingRequestItem,
  AuditLog,
  Vendor,
  Driver,
} = require("../models");

const { formatLocalEgyptianPhone } = require("../utils/phone-normalizer");

const {
  upsertDriverFromInterviewId,
} = require("../services/driver-sync.service");

const INTERVIEW_INCLUDES = [
  { model: Client, as: "client", attributes: ["id", "name", "contactEmail", "contact_email", "pointOfContact", "point_of_contact"] },
  { model: Hub, as: "hub", attributes: ["id", "name"] },
  { model: Zone, as: "zone", attributes: ["id", "name"] },
  { model: Vendor, as: "vendor", attributes: ["id", "name", "code"] }, // ✅ NEW
  { model: Auth, as: "accountManager", attributes: ["id", "fullName"] },
  { model: Auth, as: "interviewer", attributes: ["id", "fullName"] },
  { model: Driver, as: "contractLocationCourier", attributes: ["id", "name"] },
];

/* =========================
   Vehicle + Inventory helpers
   ========================= */

// Dynamic vehicle types handled from DB

const PRIORITY_ORDER_SQL =
  "CASE " +
  "WHEN priority='urgent' THEN 0 " +
  "WHEN priority='high' THEN 1 " +
  "WHEN priority='medium' THEN 2 " +
  "WHEN priority='low' THEN 3 " +
  "ELSE 9 END";

async function generateUniqueTicketNo(clientId) {
  const client = await Client.findByPk(clientId);
  const rawName = client?.name || "ACC";

  const clean = rawName.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const prefix = (clean.slice(0, 3) || "ACC").padEnd(3, "X");

  for (let i = 0; i < 10; i++) {
    const random = Math.floor(1000 + Math.random() * 9000);
    const candidate = `${prefix}-${random}`;

    const exists = await Interview.count({ where: { ticketNo: candidate } });
    if (!exists) return candidate;
  }

  return `${prefix}-${Date.now().toString().slice(-4)}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isCourierActive(v) {
  return (v || "").toString().trim().toLowerCase() === "active";
}

function normalizeVehicleType(v) {
  if (v === null || v === undefined || v === "") return null;
  return String(v).trim().toUpperCase();
}

/* =========================
   Vendor helper
   ========================= */

async function assertVendorExists(vendorId, { transaction } = {}) {
  const id = Number(vendorId);
  if (!id || Number.isNaN(id)) {
    const err = new Error("vendorId is required and must be a valid number");
    err.statusCode = 400;
    throw err;
  }

  const vendor = await Vendor.findByPk(id, { transaction });
  if (!vendor) {
    const err = new Error("Vendor not found");
    err.statusCode = 404;
    throw err;
  }

  return vendor;
}

/* =========================
   Manual audit (ONLY for special actions)
   ========================= */

async function writeAudit({
  audit,
  transaction,
  entity,
  entityId,
  action,
  summary,
  changes,
  meta,
}) {
  if (!audit || !AuditLog) return;

  await AuditLog.create(
    {
      entity: String(entity),
      entityId: Number(entityId),
      action: String(action),
      summary: summary || null,
      changes: changes || null,
      meta: meta || null,

      requestId: audit.requestId || null,
      actorId: audit.actorId || null,
      ip: audit.ip || null,
      userAgent: audit.userAgent || null,
      method: audit.method || null,
      path: audit.path || null,
    },
    { transaction }
  );
}

/**
 * ✅ Idempotent inventory allocation (decrement) for an Interview
 * + يسجل Audit Log واحد فقط (INVENTORY_DECREMENT)
 * + ويمنع Hook UPDATE أثناء interview.save عبر audit.silent=true
 */
async function applyPendingRequestDecrementForInterview(interview, t, audit) {
  if (interview.inventoryAppliedAt) {
    return {
      applied: false,
      alreadyApplied: true,
      inventoryAppliedAt: interview.inventoryAppliedAt,
      pendingRequestId: interview.inventoryPendingRequestId || null,
      pendingRequestItemId: interview.inventoryPendingRequestItemId || null,
    };
  }

  const vt = normalizeVehicleType(interview.vehicleType);
  if (!vt) {
    const err = new Error("vehicleType is required to apply pending request action");
    err.statusCode = 400;
    throw err;
  }

  if (!interview.clientId) {
    const err = new Error("clientId is required to apply pending request action");
    err.statusCode = 400;
    throw err;
  }
  if (!interview.hubId) {
    const err = new Error("hubId is required to apply pending request action");
    err.statusCode = 400;
    throw err;
  }
  if (!interview.zoneId) {
    const err = new Error("zoneId is required to apply pending request action");
    err.statusCode = 400;
    throw err;
  }

  const headerWhere = {
    clientId: interview.clientId,
    hubId: interview.hubId,
    zoneId: interview.zoneId,
    status: { [Op.in]: ["APPROVED", "PENDING"] },
  };

  const header = await PendingRequest.findOne({
    where: headerWhere,
    transaction: t,
    lock: t.LOCK.UPDATE,
    order: [
      [
        sequelize.literal(
          "CASE WHEN status='APPROVED' THEN 0 WHEN status='PENDING' THEN 1 ELSE 2 END"
        ),
        "ASC",
      ],
      [sequelize.literal(PRIORITY_ORDER_SQL), "ASC"],
      ["requestDate", "ASC"],
      ["id", "ASC"],
    ],
  });

  if (!header) {
    const err = new Error(
      "No PendingRequest found for this client/hub/zone with status APPROVED/PENDING"
    );
    err.statusCode = 404;
    throw err;
  }

  const item = await PendingRequestItem.findOne({
    where: { pendingRequestId: header.id, vehicleType: vt },
    transaction: t,
    lock: t.LOCK.UPDATE,
  });

  if (!item) {
    const err = new Error(
      `No PendingRequestItem found for vehicleType=${vt} under pendingRequestId=${header.id}`
    );
    err.statusCode = 404;
    throw err;
  }

  const current = Number(item.vehicleCount || 0);
  if (current <= 0) {
    const err = new Error(
      `No remaining capacity for vehicleType=${vt} under pendingRequestId=${header.id}`
    );
    err.statusCode = 409;
    throw err;
  }

  const next = current - 1;
  item.vehicleCount = next;
  await item.save({ transaction: t });

  const totalSum = await PendingRequestItem.sum("vehicleCount", {
    where: { pendingRequestId: header.id },
    transaction: t,
  });
  
  if ((totalSum || 0) <= 0) {
    header.status = "COMPLETED";
    await header.save({ transaction: t });
  }

  interview.inventoryAppliedAt = new Date();
  interview.inventoryPendingRequestId = header.id;
  interview.inventoryPendingRequestItemId = item.id;

  // ✅ prevent hook UPDATE log here
  await interview.save({ transaction: t, audit: { ...audit, silent: true } });

  // ✅ one explicit audit entry for inventory decrement
  await writeAudit({
    audit,
    transaction: t,
    entity: "Interview",
    entityId: interview.id,
    action: "INVENTORY_DECREMENT",
    summary: `Inventory decremented for vehicleType=${vt}`,
    changes: {
      pendingRequestId: header.id,
      pendingRequestItemId: item.id,
      vehicleType: vt,
      before: current,
      after: next,
    },
    meta: { source: "applyPendingRequestDecrementForInterview" },
  });

  return {
    applied: true,
    pendingRequestId: header.id,
    pendingRequestItemId: item.id,
    vehicleType: vt,
    before: current,
    after: next,
    inventoryAppliedAt: interview.inventoryAppliedAt,
  };
}

/* =========================
   GET /api/interviews
   ========================= */

exports.getAllInterviews = async (req, res) => {
  try {
    const { q, clientId, hubId, zoneId, status, vendorId, interviewerId, accountManagerId, hrFeedback } = req.query;
    const where = {};

    if (q) {
      const like = { [Op.like]: `%${q}%` };
      where[Op.or] = [
        { courierName: like },
        { phoneNumber: like },
        { nationalId: like },
        { residence: like },
        { ticketNo: like },
      ];
    }
    if (clientId) where.clientId = Number(clientId);
    if (hubId) where.hubId = Number(hubId);
    if (zoneId) where.zoneId = Number(zoneId);
    if (vendorId) where.vendorId = Number(vendorId);
    if (interviewerId) where.interviewerId = Number(interviewerId);
    if (accountManagerId) where.accountManagerId = Number(accountManagerId);
    if (status) where.courierStatus = status;
    if (req.query.signedWithHr) where.signedWithHr = req.query.signedWithHr;
    if (hrFeedback) where.hrFeedback = hrFeedback;

    if (req.query.page && req.query.limit) {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      const { count, rows } = await Interview.findAndCountAll({
        where,
        order: [["id", "DESC"]],
        include: INTERVIEW_INCLUDES,
        limit,
        offset,
        distinct: true
      });

      return res.json({
        data: rows,
        meta: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit)
        }
      });
    } else {
      const interviews = await Interview.findAll({
        where,
        order: [["id", "DESC"]],
        include: INTERVIEW_INCLUDES,
      });

      return res.json(interviews);
    }
  } catch (error) {
    console.error("getAllInterviews error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* =========================
   GET /api/interviews/:id
   ========================= */

exports.getInterviewById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id))
      return res.status(400).json({ message: "Invalid id parameter" });

    const interview = await Interview.findByPk(id, {
      include: INTERVIEW_INCLUDES,
    });
    if (!interview)
      return res.status(404).json({ message: "Interview not found" });

    return res.json(interview);
  } catch (error) {
    console.error("getInterviewById error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* =========================
   POST /api/interviews
   ========================= */

exports.createInterview = async (req, res) => {
  const t = await sequelize.transaction();
  let newInterviewId = null;
  let inventoryAction = null;

  try {
    const audit = req.makeAudit?.({
      summary: "Interview created",
      meta: { controller: "Interview", op: "CREATE" },
    });

    let {
      date,
      ticketNo,
      ticketExpiresAt,

      courierName,
      phoneNumber,
      nationalId,
      residence,
      relativeName,
      relativePhoneNumber,
      contractLocationType,
      contractLocationCourierId,
      clientId,
      hubId,
      zoneId,
      vendorId, // ✅ NEW
      position,
      module,
      vehicleType,
      vehiclePlateNumber,

      vLicenseExpiryDate,
      dLicenseExpiryDate,
      idExpiryDate,

      accountManagerId,
      interviewerId,
      signedWithHr,
      feedback,
      hrFeedback,
      crmFeedback,
      followUp1,
      followUp2,
      followUp3,
      courierStatus,
      securityResult,
      notes,
      trustReceiptsCount,
      trustReceiptsAmount,
      paymentMethod,
      bankName,
      bankAccountNumber,
      walletName,
      walletNumber,
    } = req.body;
    
    phoneNumber = phoneNumber ? formatLocalEgyptianPhone(phoneNumber) : null;

    if (!courierName || !phoneNumber || !clientId) {
      throw Object.assign(
        new Error("courierName, phoneNumber and clientId are required"),
        { statusCode: 400 }
      );
    }

    const isSigned = (hrFeedback || "").toString().toLowerCase().includes("signed");
    if (isSigned) {
      const count = Number(trustReceiptsCount || 0);
      const amount = Number(trustReceiptsAmount || 0);
      if (count <= 0 || amount <= 0) {
        throw Object.assign(
          new Error("يجب إدخال عدد إيصالات الأمانة وقيمتها أولاً لإتمام عملية التعاقد (الحالة Signed)."),
          { statusCode: 400 }
        );
      }
    }

    // ✅ vendorId required + exists
    await assertVendorExists(vendorId, { transaction: t });

    if (nationalId) {
      const isBlacklisted = await Driver.findOne({
        where: { nationalId: nationalId, isBlacklisted: true },
        transaction: t,
      });
      if (isBlacklisted) {
        throw Object.assign(
          new Error("هذا المندوب مسجل في القائمة السوداء ولا يمكن اضافته."),
          { statusCode: 400 }
        );
      }
    }

    const normalizedVehicleType =
      typeof vehicleType === "undefined" ? null : normalizeVehicleType(vehicleType);

    // No longer validating against hardcoded enum in controller

    const interviewDate = date || new Date();

    let finalTicketNo = ticketNo || null;
    let finalTicketExpiresAt = ticketExpiresAt || null;

    const hrSigned = (hrFeedback || "").toString().toLowerCase().includes("signed");
    if (hrSigned && !finalTicketNo) {
      finalTicketNo = await generateUniqueTicketNo(clientId);
      finalTicketExpiresAt = addDays(new Date(), 14);
    }

    const newInterview = await Interview.create(
      {
        date: interviewDate,
        ticketNo: finalTicketNo,
        ticketExpiresAt: finalTicketExpiresAt,

        courierName,
        phoneNumber,
        nationalId,
        residence,
        relativeName,
        relativePhoneNumber,
        contractLocationType: contractLocationType || 'company',
        contractLocationCourierId: contractLocationCourierId || null,
        clientId,
        hubId,
        zoneId,
        vendorId: Number(vendorId), // ✅ NEW
        position,
        module,
        vehicleType: normalizedVehicleType,
        vehiclePlateNumber: vehiclePlateNumber || null,
        day1Date: isCourierActive(courierStatus) ? new Date().toISOString().split('T')[0] : null,
        hiringDate: (securityResult || "").toString().toLowerCase() === "negative" ? new Date().toISOString().split('T')[0] : null,

        vLicenseExpiryDate,
        dLicenseExpiryDate,
        idExpiryDate,

        accountManagerId,
        interviewerId,
        signedWithHr,
        feedback,
        hrFeedback,
        crmFeedback,
        followUp1,
        followUp2,
        followUp3,
        courierStatus,
        securityResult,
        notes,
        trustReceiptsCount: trustReceiptsCount ? Number(trustReceiptsCount) : 0,
        trustReceiptsAmount: trustReceiptsAmount ? Number(trustReceiptsAmount) : 0.00,
        paymentMethod: paymentMethod || null,
        bankName: bankName || null,
        bankAccountNumber: bankAccountNumber || null,
        walletName: walletName || null,
        walletNumber: walletNumber || null,
      },
      { transaction: t, audit }
    );

    newInterviewId = newInterview.id;

    // ✅ sync driver row داخل نفس transaction + audit
    await upsertDriverFromInterviewId(newInterview.id, {
      transaction: t,
      audit,
    });

    // ✅ Trigger inventory decrement (best-effort)
    if (isCourierActive(courierStatus)) {
      try {
        inventoryAction = await sequelize.transaction(
          { transaction: t },
          async (tInv) =>
            applyPendingRequestDecrementForInterview(newInterview, tInv, audit)
        );
      } catch (invErr) {
        inventoryAction = {
          applied: false,
          error: invErr.message,
          statusCode: invErr.statusCode || 500,
        };
      }
    }

    await t.commit();
  } catch (error) {
    if (t && !t.finished) {
      try {
        await t.rollback();
      } catch (_) {}
    }

    console.error("createInterview error:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }

  try {
    const fullInterview = await Interview.findByPk(newInterviewId, {
      include: INTERVIEW_INCLUDES,
    });
    const payload = fullInterview?.toJSON ? fullInterview.toJSON() : fullInterview;
    return res.status(201).json({ ...payload, inventoryAction });
  } catch (error) {
    console.error("createInterview post-commit read error:", error);
    return res.status(201).json({ id: newInterviewId, inventoryAction });
  }
};

/* =========================
   PUT /api/interviews/:id
   ========================= */

exports.updateInterview = async (req, res) => {
  const t = await sequelize.transaction();
  let inventoryAction = null;

  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid id parameter" });
    }

    const interview = await Interview.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!interview) {
      await t.rollback();
      return res.status(404).json({ message: "Interview not found" });
    }

    const fields = [
      "date",
      "ticketNo",
      "ticketExpiresAt",
      "courierName",
      "phoneNumber",
      "nationalId",
      "residence",
      "relativeName",
      "relativePhoneNumber",
      "contractLocationType",
      "contractLocationCourierId",
      "clientId",
      "hubId",
      "zoneId",
      "vendorId", // ✅ NEW
      "position",
      "module",
      "vehicleType",
      "vehiclePlateNumber",
      "vLicenseExpiryDate",
      "dLicenseExpiryDate",
      "idExpiryDate",
      "accountManagerId",
      "interviewerId",
      "signedWithHr",
      "feedback",
      "hrFeedback",
      "crmFeedback",
      "followUp1",
      "followUp2",
      "followUp3",
      "courierStatus",
      "securityResult",
      "notes",
      "day1Date",
      "hiringDate",
      "trustReceiptsCount",
      "trustReceiptsAmount",
      "paymentMethod",
      "bankName",
      "bankAccountNumber",
      "walletName",
      "walletNumber",
    ];

    const changedFields = fields.filter((f) =>
      Object.prototype.hasOwnProperty.call(req.body, f)
    );

    if (req.body.nationalId) {
      const isBlacklisted = await Driver.findOne({
        where: { nationalId: req.body.nationalId, isBlacklisted: true },
        transaction: t,
      });
      if (isBlacklisted) {
        await t.rollback();
        return res.status(400).json({ message: "هذا المندوب مسجل في القائمة السوداء ولا يمكن اضافته." });
      }
    }

    const wasSigned = (interview.hrFeedback || "").toString().toLowerCase().includes("signed");
    const wasActive = isCourierActive(interview.courierStatus);

    for (const f of fields) {
      if (Object.prototype.hasOwnProperty.call(req.body, f)) {
        if (f === "vehicleType") {
          const raw = req.body[f];
          const vt = normalizeVehicleType(raw);
          interview.vehicleType = vt;
        } else if (f === "vendorId") {
          // ✅ validate vendor
          await assertVendorExists(req.body[f], { transaction: t });
          interview.vendorId = Number(req.body[f]);
        } else if (f === "phoneNumber") {
          interview.phoneNumber = req.body[f] ? formatLocalEgyptianPhone(req.body[f]) : null;
        } else {
          interview[f] = req.body[f];
        }
      }
    }

    const isNowSigned = (interview.hrFeedback || "").toString().toLowerCase().includes("signed");
    if (isNowSigned) {
      const count = Number(typeof req.body.trustReceiptsCount !== 'undefined' ? req.body.trustReceiptsCount : interview.trustReceiptsCount || 0);
      const amount = Number(typeof req.body.trustReceiptsAmount !== 'undefined' ? req.body.trustReceiptsAmount : interview.trustReceiptsAmount || 0);
      if (count <= 0 || amount <= 0) {
        await t.rollback();
        return res.status(400).json({ message: "يجب إدخال عدد إيصالات الأمانة وقيمتها أولاً لإتمام عملية التعاقد (الحالة Signed)." });
      }
    }

    if (!wasSigned && isNowSigned && !interview.ticketNo && interview.clientId) {
      interview.ticketNo = await generateUniqueTicketNo(interview.clientId);
      interview.ticketExpiresAt = addDays(new Date(), 14);
    }

    const isNowActive = isCourierActive(interview.courierStatus);
    if (!wasActive && isNowActive) {
      interview.day1Date = new Date().toISOString().split('T')[0];
      if (!changedFields.includes('day1Date')) changedFields.push('day1Date');
    }

    const wasNegative = (interview.securityResult || "").toString().toLowerCase() === "negative";
    const isNowNegative = (req.body.securityResult || interview.securityResult || "").toString().toLowerCase() === "negative";
    if (!wasNegative && isNowNegative) {
      interview.hiringDate = new Date().toISOString().split('T')[0];
      if (!changedFields.includes('hiringDate')) changedFields.push('hiringDate');
    }

    const shortChanged = changedFields.slice(0, 8).join(", ");

    const audit = req.makeAudit?.({
      summary: changedFields.length ? `Interview updated: ${shortChanged}` : "Interview updated",
      meta: { controller: "Interview", op: "UPDATE", changedFields },
    });

    await interview.save({
      transaction: t,
      audit,
      fields: changedFields,
    });

    // ✅ sync driver row داخل نفس transaction + audit
    await upsertDriverFromInterviewId(interview.id, { transaction: t, audit });

    if (!wasActive && isNowActive) {
      try {
        inventoryAction = await sequelize.transaction(
          { transaction: t },
          async (tInv) => applyPendingRequestDecrementForInterview(interview, tInv, audit)
        );
      } catch (invErr) {
        inventoryAction = {
          applied: false,
          error: invErr.message,
          statusCode: invErr.statusCode || 500,
        };
      }
    }

    // ✅ Automate Replacement Request
    if (req.body.createReplacementRequest === true && !isNowActive) {
      try {
        let oldPriceProps = {};

        if (interview.inventoryPendingRequestItemId) {
           const oldItem = await PendingRequestItem.findByPk(interview.inventoryPendingRequestItemId, { transaction: t });
           if (oldItem) {
              oldPriceProps = {
                 orderPrice: oldItem.orderPrice,
                 guaranteeMinOrders: oldItem.guaranteeMinOrders,
                 fixedAmount: oldItem.fixedAmount,
                 allowanceAmount: oldItem.allowanceAmount,
                 totalAmount: oldItem.totalAmount,
              };
           }
        }

        const replacementHeader = await PendingRequest.create({
           clientId: interview.clientId,
           hubId: interview.hubId || null,
           zoneId: interview.zoneId || null,
           requestDate: new Date().toISOString().split('T')[0],
           billingMonth: null,
           status: 'APPROVED',
           priority: 'high',
           notes: `Auto-generated replacement request for ${interview.courierName || 'Courier'} due to InActive status.`,
           createdBy: req.user?.id || req.body.updatedById || null,
        }, { transaction: t });

        await PendingRequestItem.create({
           pendingRequestId: replacementHeader.id,
           vehicleType: interview.vehicleType || 'Unknown',
           vehicleCount: 1,
           ...oldPriceProps
        }, { transaction: t });

        inventoryAction = {
           ...(inventoryAction || {}),
           replacementCreated: true,
           replacementRequestId: replacementHeader.id
        };
      } catch (replErr) {
        console.error("Replacement Request error:", replErr);
      }
    }

    await t.commit();

    const full = await Interview.findByPk(interview.id, {
      include: INTERVIEW_INCLUDES,
    });
    const payload = full?.toJSON ? full.toJSON() : full;
    return res.json({ ...payload, inventoryAction });
  } catch (error) {
    if (t && !t.finished) {
      try {
        await t.rollback();
      } catch (_) {}
    }

    console.error("updateInterview error:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }
};

/* =========================
   DELETE /api/interviews/:id
   ========================= */

exports.deleteInterview = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid id parameter" });
    }

    const interview = await Interview.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!interview) {
      await t.rollback();
      return res.status(404).json({ message: "Interview not found" });
    }

    const audit = req.makeAudit?.({
      summary: `Interview deleted (${interview.courierName || "Unnamed"})`,
      meta: { controller: "Interview", op: "DELETE" },
    });

    await interview.destroy({ transaction: t, audit });

    await t.commit();
    return res.json({ message: "Interview deleted" });
  } catch (error) {
    if (t && !t.finished) {
      try {
        await t.rollback();
      } catch (_) {}
    }
    console.error("deleteInterview error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};