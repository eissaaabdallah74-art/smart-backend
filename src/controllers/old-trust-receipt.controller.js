const { OldTrustReceipt } = require("../models");
const { Op } = require("sequelize");

// GET /api/old-trust-receipts
exports.getAllOldTrustReceipts = async (req, res) => {
  try {
    const { q, status, page, limit } = req.query;
    
    const isPaginated = page && limit;
    const pageNum = isPaginated ? parseInt(page, 10) : 1;
    const limitNum = isPaginated ? parseInt(limit, 10) : null;
    const offset = isPaginated ? (pageNum - 1) * limitNum : null;

    const where = {};

    if (q) {
      const like = { [Op.like]: `%${q}%` };
      where[Op.or] = [
        { courierName: like },
        { residence: like },
        { nationalId: like },
        { phoneNumber: like },
      ];
    }

    if (status && status !== "All") {
      where.status = status;
    }

    const queryOptions = {
      where,
      order: [["id", "DESC"]],
    };

    if (isPaginated) {
      queryOptions.limit = limitNum;
      queryOptions.offset = offset;
      const { rows, count } = await OldTrustReceipt.findAndCountAll(queryOptions);
      return res.json({
        data: rows,
        meta: {
          total: count,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(count / limitNum)
        }
      });
    }

    const receipts = await OldTrustReceipt.findAll(queryOptions);
    return res.json(receipts);
  } catch (error) {
    console.error("getAllOldTrustReceipts error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// POST /api/old-trust-receipts
exports.createOldTrustReceipt = async (req, res) => {
  try {
    const { courierName, residence, nationalId, phoneNumber, amount, status } = req.body;

    if (!courierName) {
      return res.status(400).json({ message: "Courier name is required" });
    }

    const receipt = await OldTrustReceipt.create({
      courierName,
      residence,
      nationalId,
      phoneNumber,
      amount: amount ? Number(amount) : 0.00,
      status: status || "Signed",
      createdById: req.user?.id || null,
    });

    return res.status(201).json(receipt);
  } catch (error) {
    console.error("createOldTrustReceipt error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// PUT /api/old-trust-receipts/:id
exports.updateOldTrustReceipt = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid id parameter" });
    }

    const receipt = await OldTrustReceipt.findByPk(id);
    if (!receipt) {
      return res.status(404).json({ message: "Receipt not found" });
    }

    const fields = ["courierName", "residence", "nationalId", "phoneNumber", "amount", "status"];
    for (const f of fields) {
      if (Object.prototype.hasOwnProperty.call(req.body, f)) {
        if (f === "amount") {
          receipt.amount = Number(req.body[f]);
        } else {
          receipt[f] = req.body[f];
        }
      }
    }

    receipt.updatedById = req.user?.id || null;
    await receipt.save();

    return res.json(receipt);
  } catch (error) {
    console.error("updateOldTrustReceipt error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// DELETE /api/old-trust-receipts/:id
exports.deleteOldTrustReceipt = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid id parameter" });
    }

    const receipt = await OldTrustReceipt.findByPk(id);
    if (!receipt) {
      return res.status(404).json({ message: "Receipt not found" });
    }

    receipt.deletedById = req.user?.id || null;
    await receipt.save();
    await receipt.destroy();

    return res.json({ message: "Receipt deleted successfully" });
  } catch (error) {
    console.error("deleteOldTrustReceipt error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
