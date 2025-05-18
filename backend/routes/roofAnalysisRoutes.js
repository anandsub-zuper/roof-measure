// backend/routes/roofAnalysisRoutes.js
const express = require('express');
const router = express.Router();
const roofAnalysisController = require('../controllers/roofAnalysisController');

/**
 * @route   POST /api/roof/analyze
 * @desc    Analyze roof using OpenAI Vision and property data
 * @access  Public
 */
router.post('/analyze', roofAnalysisController.analyzeRoof);

module.exports = router;
