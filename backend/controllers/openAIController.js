// backend/controllers/openAIController.js
const openAIService = require('../services/openAIService');

/**
 * Generate a roof estimate
 */
exports.generateEstimate = async (req, res) => {
  try {
    const estimateData = await openAIService.generateRoofEstimate(req.body);
    return res.json(estimateData);
  } catch (error) {
    console.error('Error in estimate controller:', error);
    return res.status(500).json({ 
      error: 'Error generating estimate',
      message: error.message
    });
  }
};

/**
 * Analyze a roof image to detect boundaries
 */
exports.analyzeRoof = async (req, res) => {
  try {
    const { image } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'Image data is required' });
    }
    
    const coordinates = await openAIService.analyzeRoofImage(image);
    return res.json({ coordinates });
  } catch (error) {
    console.error('Error in roof analysis controller:', error);
    return res.status(500).json({ 
      error: 'Error analyzing roof image',
      message: error.message
    });
  }
};

/**
 * Answer a roofing-related question
 */
exports.askQuestion = async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }
    
    const answerData = await openAIService.askRoofingQuestion(question);
    return res.json(answerData);
  } catch (error) {
    console.error('Error in ask question controller:', error);
    return res.status(500).json({ 
      error: 'Error answering question',
      message: error.message
    });
  }
};
