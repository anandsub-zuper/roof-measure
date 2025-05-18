// backend/controllers/roofAnalysisController.js
const openAIVisionService = require('../services/openAIVisionService');
const apiResponse = require('../utils/apiResponse');
const { logInfo, logError } = require('../utils/logger');

/**
 * Analyze roof using OpenAI Vision and property data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.analyzeRoof = async (req, res) => {
  try {
    const { lat, lng, propertyData } = req.body;
    
    logInfo('Roof analysis request received', { lat, lng, hasPropertyData: !!propertyData });
    
    if (!lat || !lng) {
      return apiResponse.send(res, 
        apiResponse.validationError('Latitude and longitude are required')
      );
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
        return apiResponse.send(res, 
          apiResponse.success('Roof analysis completed successfully', analysisResult)
        );
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
          return apiResponse.send(res, 
            apiResponse.success('Roof analysis completed with fallback', {
              visionAnalysis: analysisResult,
              propertyBasedCalculation: propertyBasedResult,
              recommended: propertyBasedResult
            })
          );
        }
      }
      
      // If property-based calculation failed or wasn't possible, return vision result anyway
      return apiResponse.send(res, 
        apiResponse.success('Roof analysis completed with low confidence', analysisResult)
      );
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
          return apiResponse.send(res, 
            apiResponse.success('Roof analysis completed using property data', propertyBasedResult)
          );
        }
      }
      
      // If all else fails, return error
      throw visionError;
    }
  } catch (error) {
    logError('Roof analysis error', { error: error.message });
    return apiResponse.send(res, 
      apiResponse.error('Error analyzing roof', error)
    );
  }
};
