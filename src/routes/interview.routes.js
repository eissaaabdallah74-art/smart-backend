// src/routes/interview.routes.js
const express = require('express');
const router = express.Router();
const interviewController = require('../controllers/interview.controller');

// GET /api/interviews  (with optional filters)
router.get('/', interviewController.getAllInterviews);

// GET /api/interviews/:id
router.get('/:id', interviewController.getInterviewById);

// POST /api/interviews
router.post('/', interviewController.createInterview);

// PUT /api/interviews/:id
router.put('/:id', interviewController.updateInterview);

// DELETE /api/interviews/:id
router.delete('/:id', interviewController.deleteInterview);

module.exports = router;
