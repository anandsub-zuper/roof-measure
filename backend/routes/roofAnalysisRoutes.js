// backend/routes/roofAnalysisRoutes.js
const express = require('express');
const router = express.Router();
const { logInfo, logError } = require('../utils/logger');
const openAIVisionService = require('../services/openAIVisionService');

/**
 * Analyze roof using OpenAI Vision
 */
router.post('/analyze', async (req, res) => {
  try {
    const { lat, lng, propertyData } = req.body;
    
    logInfo('Roof analysis request received', { 
      lat, 
      lng, 
      hasPropertyData: !!propertyData 
    });
    
    // Input validation
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }
    
    // Try OpenAI Vision analysis first
    try {
      const analysisResult = await openAIVisionService.analyzeRoof(
        parseFloat(lat), 
        parseFloat(lng), 
        propertyData
      );
      
      logInfo('OpenAI Vision analysis completed', { 
        confidence: analysisResult.confidence,
        roofArea: analysisResult.roofArea
      });
      
      // If confidence is high or medium, return the vision result
      if (analysisResult.confidence === "high" || analysisResult.confidence === "medium") {
        return res.json({
          success: true,
          data: analysisResult
        });
      }
      
      // If confidence is low, try property-based calculation
      logInfo('Vision analysis has low confidence, trying property-based calculation');
      
      if (propertyData && propertyData.buildingSize) {
        const propertyBasedResult = openAIVisionService.calculateRoofSizeFromProperty(
          propertyData, 
          parseFloat(lat), 
          parseFloat(lng)
        );
        
        if (propertyBasedResult) {
          logInfo('Property-based calculation completed', { 
            roofArea: propertyBasedResult.roofArea 
          });
          
          // Return both results, but recommend the property-based one
          return res.json({
            success: true,
            data: {
              visionAnalysis: analysisResult,
              propertyBasedCalculation: propertyBasedResult,
              recommended: propertyBasedResult
            }
          });
        }
      }
      
      // If property-based calculation failed or wasn't possible, return vision result anyway
      return res.json({
        success: true,
        data: analysisResult
      });
    } catch (visionError) {
      logError('OpenAI Vision analysis failed', { error: visionError.message });
      
      // Try property-based calculation as fallback
      if (propertyData && propertyData.buildingSize) {
        const propertyBasedResult = openAIVisionService.calculateRoofSizeFromProperty(
          propertyData, 
          parseFloat(lat), 
          parseFloat(lng)
        );
        
        if (propertyBasedResult) {
          logInfo('Fallback to property-based calculation successful');
          return res.json({
            success: true,
            data: propertyBasedResult
          });
        }
      }
      
      // If all else fails, return error
      throw visionError;
    }
  } catch (error) {
    logError('Roof analysis error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Error analyzing roof',
      error: error.message
    });
  }
});

module.exports = router;
