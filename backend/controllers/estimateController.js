const openaiService = require('../services/openaiService');

// Generate a roof estimate using OpenAI
exports.generateEstimate = async (req, res) => {
  try {
    const formData = req.body;
    
    // Validate required fields
    if (!formData.roofSize || !formData.roofSteepness || !formData.desiredRoofMaterial) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      });
    }
    
    // Call OpenAI service to generate estimate
    const estimate = await openaiService.generateRoofEstimate(formData);
    
    res.json({
      success: true,
      data: estimate
    });
  } catch (error) {
    console.error('Error generating estimate:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating estimate',
      error: error.message
    });
  }
};

// Submit final estimate with user contact info
exports.submitEstimate = async (req, res) => {
  try {
    const { name, email, phone, estimateResult, ...formData } = req.body;
    
    // Validate required fields
    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Missing required contact information'
      });
    }
    
    // Here you would typically:
    // 1. Send email to user and/or yourself
    // 2. Save to database if needed
    // 3. Integrate with CRM or lead service
    
    // For now, just return success
    res.json({
      success: true,
      message: 'Estimate submitted successfully',
      reference: `EST-${Date.now()}`
    });
  } catch (error) {
    console.error('Error submitting estimate:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting estimate',
      error: error.message
    });
  }
};
