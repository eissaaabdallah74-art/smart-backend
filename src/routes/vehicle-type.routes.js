// src/routes/vehicle-type.routes.js
const express = require("express");
const router = express.Router();
const vehicleTypeController = require("../controllers/vehicle-type.controller");
const { requireAdmin } = require("../middlewares/role.helpers");

router.get("/", vehicleTypeController.getAllVehicleTypes);
router.post("/", requireAdmin, vehicleTypeController.createVehicleType);
router.put("/:id", requireAdmin, vehicleTypeController.updateVehicleType);
router.delete("/:id", requireAdmin, vehicleTypeController.deleteVehicleType);

module.exports = router;
