const { VehicleType } = require("../models");

module.exports = async () => {
  const defaultTypes = [
    'BIKE',
    'BYCYCLE',
    'TRICYCLE',
    'SEDAN',
    'VAN',
    'TRUCK_OPEN',
    'TRUCK_CLOSED',
    'TRUCK_REFRIGERATED',
    'NKR',
    'JUMBO_4_OPEN',
    'JUMBO_4_CLOSED',
    'JUMBO_4_REFRIGERATED',
    'JUMBO_6_OPEN',
    'JUMBO_6_CLOSED',
    'JUMBO_6_REFRIGERATED',
    'HELPER',
    'PICKUP_OPEN',
    'PICKUP_CLOSED'
  ];

  for (const name of defaultTypes) {
    await VehicleType.findOrCreate({
      where: { name },
      defaults: { name }
    });
  }

  console.log("✅ Vehicle types seeded.");
};
