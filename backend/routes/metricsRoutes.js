// backend/routes/metricsRoutes.js
const express = require('express');
const router = express.Router();
const { logInfo } = require('../utils/logger');

/**
 * Log measurement discrepancies
 */
router.post('/log', (req, res) => {
  try {
    const { type, backendSize, frontendSize, ratio, percentDiff, address } = req.body;
    
    logInfo('Metrics data received', { 
      type, 
      backendSize, 
      frontendSize, 
      ratio: ratio?.toFixed(2), 
      percentDiff: percentDiff?.toFixed(1),
      address: address?.substring(0, 15) // Limit for privacy
    });
    
    // Future enhancement: Store in database for analysis
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error logging metrics:', error);
    res.status(500).json({ success: false });
  }
});

/**
 * Log API timing
 */
router.post('/timing', (req, res) => {
  try {
    const { endpoint, duration } = req.body;
    
    logInfo('API timing data received', { endpoint, duration });
    
    // Future enhancement: Store in database for performance monitoring
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error logging API timing:', error);
    res.status(500).json({ success: false });
  }
});

module.exports = router;

// Add to your server.js:
// app.use('/api/metrics', require('./routes/metricsRoutes'));
