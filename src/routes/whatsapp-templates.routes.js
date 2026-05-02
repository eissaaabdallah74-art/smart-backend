const express = require("express");
const router = express.Router();
const whatsappTemplatesController = require("../controllers/whatsapp-templates.controller");

// Groups
router.post("/groups", whatsappTemplatesController.createGroup);
router.get("/groups", whatsappTemplatesController.getGroups);
router.put("/groups/:id", whatsappTemplatesController.updateGroup);
router.delete("/groups/:id", whatsappTemplatesController.deleteGroup);

// Templates
router.post("/", whatsappTemplatesController.createTemplate);
router.put("/:id", whatsappTemplatesController.updateTemplate);
router.delete("/:id", whatsappTemplatesController.deleteTemplate);

module.exports = router;
