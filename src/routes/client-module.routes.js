// src/routes/client-module.routes.js
const express = require("express");
const router = express.Router();
const clientModulesController = require("../controllers/client-module.controller");
const authMiddleware = require("../middlewares/auth.middleware");

// Add authentication middleware to all routes
router.use(authMiddleware);

router.post("/", clientModulesController.create);
router.post("/bulk", clientModulesController.bulkCreate);
router.post("/bulk-replace", clientModulesController.bulkReplace);
router.get("/", clientModulesController.findAll);
router.get("/:id", clientModulesController.findOne);
router.get("/client/:clientId", clientModulesController.findByClient);
router.put("/:id", clientModulesController.update);
router.delete("/:id", clientModulesController.delete);

module.exports = router;
