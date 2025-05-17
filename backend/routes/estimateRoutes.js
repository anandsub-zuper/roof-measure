routes/estimateRoutes.js
javascriptconst express = require('express');
const router = express.Router();
const estimateController = require('../controllers/estimateController');

// Generate a roof estimate based on form data
router.post('/generate', estimateController.generateEstimate);

// Submit final estimate with user contact info
router.post('/submit', estimateController.submitEstimate);

module.exports = router;
