// backend/routes/api.js
const express = require('express');
const router = express.Router();
const openAIController = require('../controllers/openAIController');

// OpenAI-powered endpoints
router.post('/estimate', openAIController.generateEstimate);
router.post('/analyze-roof', openAIController.analyzeRoof);
router.post('/ask', openAIController.askQuestion);

module.exports = router;
