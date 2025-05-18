// controllers/estimateController.js
const openaiService = require('../services/openaiService');
const apiResponse = require('../utils/apiResponse');
const { logInfo, logError } = require('../utils/logger');

/**
 * Generate a roof estimate using OpenAI
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.generateEstimate = async (req, res) => {
  try {
    const formData = req.body;
    logInfo('Generating estimate', { formData });
    
    // Validate required fields
    if (!formData.roofSize || !formData.roofSteepness || !formData.desiredRoofMaterial) {
      return apiResponse.send(res,
        apiResponse.validationError('Missing required parameters', {
          required: ['roofSize', 'roofSteepness', 'desiredRoofMaterial'],
          received: Object.keys(formData)
        })
      );
    }
    
    // Call OpenAI service to generate estimate
    const estimate = await openaiService.generateRoofEstimate(formData);
    
    apiResponse.send(res,
      apiResponse.success('Estimate generated successfully', estimate)
    );
  } catch (error) {
    logError('Error generating estimate', { error: error.message });
    apiResponse.send(res,
      apiResponse.error('Error generating estimate', error)
    );
  }
};

/**
 * Submit final estimate with user contact info
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.submitEstimate = async (req, res) => {
  try {
    const { name, email, phone, estimateResult, ...formData } = req.body;
    logInfo('Submitting estimate', { name, email, phone });
    
    // Validate required fields
    if (!name || !email || !phone) {
      return apiResponse.send(res,
        apiResponse.validationError('Missing required contact information', {
          required: ['name', 'email', 'phone'],
          received: { name: !!name, email: !!email, phone: !!phone }
        })
      );
    }
    
    // Generate a reference number
    const referenceId = `EST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Here you would typically:
    // 1. Save to database
    // 2. Send confirmation email
    // 3. Integrate with CRM
    
    // For now, just return success with reference ID
    apiResponse.send(res,
      apiResponse.success('Estimate submitted successfully', {
        reference: referenceId,
        submittedAt: new Date().toISOString()
      })
    );
  } catch (error) {
    logError('Error submitting estimate', { error: error.message });
    apiResponse.send(res,
      apiResponse.error('Error submitting estimate', error)
    );
  }
};
