// controllers/openAIController.js
const openAIService = require('../services/openaiService');
const apiResponse = require('../utils/apiResponse');
const { logInfo, logError } = require('../utils/logger');

/**
 * Generate a roof estimate using OpenAI
 */
exports.generateEstimate = async (req, res) => {
  try {
    logInfo('OpenAI generate estimate request', { body: req.body });
    const estimateData = await openAIService.generateRoofEstimate(req.body);
    
    apiResponse.send(res, 
      apiResponse.success('Estimate generated successfully', estimateData)
    );
  } catch (error) {
    logError('Error in OpenAI estimate controller', { error: error.message });
    
    apiResponse.send(res, 
      apiResponse.error('Error generating estimate', error)
    );
  }
};

/**
 * Analyze a roof image to detect boundaries
 */
exports.analyzeRoof = async (req, res) => {
  try {
    logInfo('OpenAI analyze roof request');
    const { image } = req.body;
    
    if (!image) {
      return apiResponse.send(res,
        apiResponse.validationError('Image data is required')
      );
    }
    
    // In a complete implementation, this would call OpenAI Vision API
    // Since we've created a better solution with Google Maps Drawing,
    // we'll return a simulated success
    
    apiResponse.send(res,
      apiResponse.success('Roof analysis complete', {
        message: 'Roof analysis is now performed client-side with Google Maps Drawing tools for improved accuracy'
      })
    );
  } catch (error) {
    logError('Error in OpenAI roof analysis controller', { error: error.message });
    
    apiResponse.send(res,
      apiResponse.error('Error analyzing roof image', error)
    );
  }
};

/**
 * Answer a roofing-related question
 */
exports.askQuestion = async (req, res) => {
  try {
    const { question } = req.body;
    logInfo('OpenAI ask question request', { question });
    
    if (!question) {
      return apiResponse.send(res,
        apiResponse.validationError('Question is required')
      );
    }
    
    // This would normally call OpenAI to get an answer
    // For now, return a simulated response
    
    apiResponse.send(res,
      apiResponse.success('Question answered', {
        answer: `This is a placeholder answer for: "${question}". In a real implementation, this would be answered by OpenAI.`,
        source: 'simulated'
      })
    );
  } catch (error) {
    logError('Error in OpenAI ask question controller', { error: error.message });
    
    apiResponse.send(res,
      apiResponse.error('Error answering question', error)
    );
  }
};
