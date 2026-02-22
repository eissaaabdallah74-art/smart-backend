// src/routes/company-documents.routes.js
const router = require("express").Router();
const ctrl = require("../controllers/company-documents.controller");

// =======================================================
// Dropdowns (Modal helpers): Companies + Document Types
// =======================================================
router.get("/companies", ctrl.listCompanies);

router.get("/document-types", ctrl.listDocumentTypes);
router.post("/document-types", ctrl.createDocumentType); // optional

// ===================================
// Company Documents (Sheet CRUD)
// ===================================
router.get("/", ctrl.list);
router.post("/", ctrl.create);

router.get("/:id", ctrl.getOne);
router.put("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);

module.exports = router;
