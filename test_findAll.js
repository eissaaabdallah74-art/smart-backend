require('dotenv').config();
const db = require("./src/models");

(async () => {
  try {
    await db.sequelize.authenticate();
    const drivers = await db.Driver.findAll({
      include: [
        {
          model: db.Vendor,
          as: 'vendor',
          attributes: ['id', 'name'],
          required: false,
        },
      ],
      order: [['id', 'ASC']],
    });
    console.log("Success! Found", drivers.length, "drivers.");
    process.exit(0);
  } catch (err) {
    console.error("Error executing query:", err.message);
    process.exit(1);
  }
})();
