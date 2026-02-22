// src/routes/employee-loans.routes.js
const express = require("express");
const ctrl = require("../controllers/employee-loans.controller");

const router = express.Router();

// ✅ Ping to prove router is mounted and matching
router.get("/__ping", (req, res) => {
  res.json({ ok: true, from: "employee-loans.router", pid: process.pid });
});

// ===== Employee (self) =====
router.get("/me/summary", ctrl.getMySummary);
router.get("/me", ctrl.getMyLoans);
router.post("/", ctrl.createMyLoanRequest);

// ===== Admin/Finance =====
router.get("/policies", ctrl.listPolicies);
router.put("/policies/:employeeId", ctrl.upsertPolicy);

router.get("/", ctrl.listLoans);
router.patch("/:id/approve", ctrl.approveLoan);
router.patch("/:id/reject", ctrl.rejectLoan);
router.post("/:id/cancel", ctrl.cancelLoan);

module.exports = router;
