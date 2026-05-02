// src/controllers/public-holiday.controller.js
const { PublicHoliday, sequelize } = require("../models");
const { Op } = require("sequelize");

// GET /api/public-holidays
exports.listHolidays = async (req, res) => {
  try {
    const { year, month } = req.query;
    const where = {};

    if (year) {
      where.date = {
        [Op.and]: [
          sequelize.where(sequelize.fn('YEAR', sequelize.col('date')), year)
        ]
      };
    }

    if (month) {
      // month as YYYY-MM
      where.date = {
        [Op.startsWith]: month
      };
    }

    const rows = await PublicHoliday.findAll({
      where,
      order: [["date", "ASC"]],
    });

    return res.json(rows);
  } catch (e) {
    console.error("listHolidays error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// POST /api/public-holidays
exports.createHoliday = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { date, startDate, endDate, name, note } = req.body;

    if (!name) {
      await t.rollback();
      return res.status(400).json({ message: "Holiday Name is required" });
    }

    const datesToCreate = [];

    if (startDate && endDate) {
      // Range Mode
      let current = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(current.getTime()) || isNaN(end.getTime())) {
        await t.rollback();
        return res.status(400).json({ message: "Invalid startDate or endDate" });
      }

      if (current > end) {
        await t.rollback();
        return res.status(400).json({ message: "startDate cannot be after endDate" });
      }

      while (current <= end) {
        const iso = current.toISOString().split("T")[0];
        datesToCreate.push(iso);
        current.setDate(current.getDate() + 1);
      }
    } else if (date) {
      // Single Mode
      datesToCreate.push(date);
    } else {
      await t.rollback();
      return res.status(400).json({ message: "A date or a date range is required" });
    }

    // Check for any existing
    const existing = await PublicHoliday.findAll({
      where: { date: { [Op.in]: datesToCreate } },
      transaction: t,
    });

    if (existing.length > 0) {
      const existingDates = existing.map((h) => h.date).join(", ");
      await t.rollback();
      return res.status(400).json({
        message: `Holidays already exist for these date(s): ${existingDates}`
      });
    }

    const created = await PublicHoliday.bulkCreate(
      datesToCreate.map((d) => ({ date: d, name, note })),
      { transaction: t }
    );

    await t.commit();
    return res.status(201).json({ ok: true, createdCount: created.length });
  } catch (e) {
    await t.rollback();
    console.error("createHoliday error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// DELETE /api/public-holidays/:id
exports.deleteHoliday = async (req, res) => {
  try {
    const id = req.params.id;
    const row = await PublicHoliday.findByPk(id);

    if (!row) {
      return res.status(404).json({ message: "Holiday not found" });
    }

    await row.destroy();
    return res.json({ ok: true });
  } catch (e) {
    console.error("deleteHoliday error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};
