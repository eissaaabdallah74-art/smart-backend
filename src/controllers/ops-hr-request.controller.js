const db = require("../models");
const { Op } = require("sequelize");

exports.getInactiveCouriers = async (req, res) => {
  try {
    const { page = 1, limit = 10, clientName, hub, area, nationalId } = req.query;
    
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    const whereClause = {
      [Op.or]: [
        { hiringStatus: "inactive" },
        { contractStatus: "Inactive" }
      ]
    };

    if (clientName) whereClause.clientName = { [Op.like]: `%${clientName}%` };
    if (hub) whereClause.hub = { [Op.like]: `%${hub}%` };
    if (area) whereClause.area = { [Op.like]: `%${area}%` };
    if (nationalId) whereClause.nationalId = { [Op.like]: `%${nationalId}%` };

    const { count, rows } = await db.Driver.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: db.CourierClearance,
          as: "clearance",
        },
      ],
      limit: limitNum,
      offset: offset,
      order: [['id', 'DESC']]
    });

    res.status(200).json({
      data: rows,
      total: count,
      page: pageNum,
      totalPages: Math.ceil(count / limitNum)
    });
  } catch (error) {
    console.error("Error fetching inactive couriers:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.createRequest = async (req, res) => {
  try {
    const { driverId, opsNotes, requiredAction } = req.body;
    
    // Check if there's already a pending request
    const existing = await db.OpsHrRequest.findOne({
      where: {
        driver_id: driverId,
        status: {
          [Op.in]: ["pending", "in_progress", "requires_action"]
        }
      }
    });

    if (existing) {
      return res.status(400).json({ message: "There is already an active request for this courier." });
    }

    const newRequest = await db.OpsHrRequest.create({
      driverId,
      opsNotes,
      requiredAction,
      requestedBy: req.user.id,
      status: "pending"
    });

    res.status(201).json({ message: "Request created successfully", data: newRequest });
  } catch (error) {
    console.error("Error creating ops hr request:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getRequests = async (req, res) => {
  try {
    const { status, requestedBy, page, limit, q } = req.query;
    
    const isPaginated = page && limit;
    const pageNum = isPaginated ? parseInt(page, 10) : 1;
    const limitNum = isPaginated ? parseInt(limit, 10) : null;
    const offset = isPaginated ? (pageNum - 1) * limitNum : null;

    const where = {};
    if (status) {
      where.status = status;
    }
    if (requestedBy) {
      where.requestedBy = requestedBy;
    }

    if (q) {
      where['$driver.name$'] = { [Op.like]: `%${q}%` };
    }

    const queryOptions = {
      where,
      include: [
        {
          model: db.Driver,
          as: "driver",
          required: !!q,
        },
        {
          model: db.Auth,
          as: "requester",
          attributes: ["id", "fullName", "email"]
        },
        {
          model: db.Auth,
          as: "hrHandler",
          attributes: ["id", "fullName", "email"]
        }
      ],
      order: [["created_at", "DESC"]]
    };

    if (isPaginated) {
      queryOptions.limit = limitNum;
      queryOptions.offset = offset;
      const { rows, count } = await db.OpsHrRequest.findAndCountAll(queryOptions);
      return res.status(200).json({
        data: rows,
        meta: {
          total: count,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(count / limitNum)
        }
      });
    }

    const requests = await db.OpsHrRequest.findAll(queryOptions);
    res.status(200).json(requests);
  } catch (error) {
    console.error("Error fetching requests:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { hrReply, status, requiredAction } = req.body;

    const request = await db.OpsHrRequest.findByPk(id);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    await request.update({
      hrReply: hrReply !== undefined ? hrReply : request.hrReply,
      status: status || request.status,
      requiredAction: requiredAction !== undefined ? requiredAction : request.requiredAction,
      hrHandledBy: req.user.id
    });

    if (request.requiredAction === "Security Check Renewal" && ["approved", "rejected"].includes(request.status)) {
      const driver = await db.Driver.findByPk(request.driver_id);
      if (driver) {
        driver.lastSecurityCheckDate = new Date().toISOString().split('T')[0];
        if (request.hrReply) {
          const isNegative = request.hrReply.toLowerCase().includes('negative');
          driver.securityQueryStatus = isNegative ? 'Negative' : 'Positive';
          driver.securityQueryComment = request.hrReply;
        }
        await driver.save();
      }
    }

    res.status(200).json({ message: "Request updated successfully", data: request });
  } catch (error) {
    console.error("Error updating request:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getPendingCount = async (req, res) => {
  try {
    const count = await db.OpsHrRequest.count({
      where: { status: "pending" }
    });
    res.status(200).json({ count });
  } catch (error) {
    console.error("Error fetching pending count:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.enlistCourier = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { id } = req.params;
    const { client, hub, zone } = req.body;

    const request = await db.OpsHrRequest.findByPk(id, {
      include: [
        { model: db.Driver, as: "driver" },
        { model: db.Auth, as: "requester" }
      ],
      transaction
    });

    if (!request) {
      await transaction.rollback();
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.status !== "approved") {
      await transaction.rollback();
      return res.status(400).json({ message: "Request must be approved by HR first" });
    }

    if (!client || !client.id || !client.name) {
      await transaction.rollback();
      return res.status(400).json({ message: "Client is required" });
    }

    const driver = request.driver;

    let vendorId = driver.vendorId || driver.vendor_id;
    if (!vendorId) {
      const smvVendor = await db.Vendor.findOne({ where: { code: 'SMV' }, transaction });
      vendorId = smvVendor ? smvVendor.id : 1;
    }

    // Create Interview record for KPIs
    await db.Interview.create({
      courierName: driver.name,
      phoneNumber: driver.courierPhone || "00000000000",
      nationalId: driver.nationalId,
      residence: driver.residence,
      relativeName: driver.relativeName,
      relativePhoneNumber: driver.relativePhoneNumber,
      contractLocationType: driver.contractLocationType || 'company',
      contractLocationCourierId: driver.contractLocationCourierId,
      position: driver.position,
      vehicleType: driver.vehicleType,
      vehiclePlateNumber: driver.vehiclePlateNumber,
      module: driver.module,
      vLicenseExpiryDate: driver.vLicenseExpiryDate,
      dLicenseExpiryDate: driver.dLicenseExpiryDate,
      idExpiryDate: driver.idExpiryDate,
      clientId: client.id,
      hubId: hub?.id || null,
      zoneId: zone?.id || null,
      vendorId: vendorId,
      accountManagerId: request.requestedBy,
      interviewerId: null,
      signedWithHr: "hiring from hold",
      date: new Date(),
      day1Date: new Date()
    }, { transaction });

    // Update Driver
    await driver.update({
      clientName: client.name,
      hub: hub?.name || null,
      area: zone?.name || null,
      accountManager: request.requester?.fullName,
      hiringStatus: "active",
      contractStatus: "Active",
      signedWithHr: "hiring from hold",
      inactiveDate: null,
      day1Date: new Date()
    }, { transaction });

    // Update Request status
    await request.update({ status: "enlisted" }, { transaction });

    await transaction.commit();
    res.status(200).json({ message: "Courier enlisted successfully" });
  } catch (error) {
    await transaction.rollback();
    console.error("Error enlisting courier:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
