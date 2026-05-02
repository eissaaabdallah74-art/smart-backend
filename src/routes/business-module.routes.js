// src/routes/business-module.routes.js
const express = require("express");
const router = express.Router();
const businessModuleController = require("../controllers/business-module.controller");
const { requireAdmin } = require("../middlewares/role.helpers");

router.get("/", businessModuleController.getAllBusinessModules);
router.post("/", requireAdmin, businessModuleController.createBusinessModule);
router.put("/:id", requireAdmin, businessModuleController.updateBusinessModule);
router.delete("/:id", requireAdmin, businessModuleController.deleteBusinessModule);

module.exports = router;
