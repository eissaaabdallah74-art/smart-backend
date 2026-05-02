const { BusinessModule } = require("../models");

module.exports = async () => {
  const defaultModules = [
    'first mile',
    'middle mile',
    'last mile',
    'bulky',
    'box',
    'temp'
  ];

  for (const name of defaultModules) {
    await BusinessModule.findOrCreate({
      where: { name },
      defaults: { name }
    });
  }

  console.log("✅ Business modules seeded.");
};
