// backend/services/openAIVisionService.js
const { OpenAI } = require('openai');
const axios = require('axios');
const { logInfo, logError } = require('../utils/logger');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Simple in-memory cache to improve performance
const analysisCache = {};
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Main function to analyze roof using OpenAI Vision
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Object} propertyData - Property data including size, type, stories
 * @returns {Object} - Analysis result
 */
exports.analyzeRoof = async (lat, lng, propertyData = null) => {
  try {
    // Important: Log complete property data for debugging
    logInfo('Property data received for roof analysis', { 
      lat, lng, 
      propertyType: propertyData?.propertyType,
      buildingSize: propertyData?.buildingSize,
      stories: propertyData?.stories,
      yearBuilt: propertyData?.yearBuilt
    });

    // Check cache first
    const cacheKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    if (analysisCache[cacheKey] && 
        analysisCache[cacheKey].timestamp > Date.now() - CACHE_TTL &&
        analysisCache[cacheKey].propertySize === propertyData?.buildingSize) {
      logInfo('Using cached roof analysis', { lat, lng, cacheAge: 'less than 24 hours' });
      return analysisCache[cacheKey].result;
    }

    // Get the best satellite image and analysis
    const result = await processMultipleZoomLevels(lat, lng, propertyData);
    
    // Cache the result
    analysisCache[cacheKey] = {
      result,
      timestamp: Date.now(),
      propertySize: propertyData?.buildingSize
    };
    
    // Cross-validate with property data and adjust if necessary
    if (propertyData && propertyData.buildingSize) {
      const crossValidatedResult = crossValidateWithPropertyData(result, propertyData);
      
      // Update cache with cross-validated result
      analysisCache[cacheKey].result = crossValidatedResult;
      
      return crossValidatedResult;
    }
    
    return result;
  } catch (error) {
    logError('Error in OpenAI Vision roof analysis', { 
      error: error.message,
      stack: error.stack
    });
    
    // Try property-based calculation as fallback
    if (propertyData && propertyData.buildingSize) {
      logInfo('Falling back to property data calculation after vision error');
      return calculateRoofSizeFromProperty(propertyData, lat, lng);
    }
    
    // Last resort fallback
    throw error;
  }
};

/**
 * Process multiple zoom levels in parallel
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Object} propertyData - Property data
 */
async function processMultipleZoomLevels(lat, lng, propertyData) {
  // Define zoom levels to try - order by most likely to succeed
  const zoomLevels = [20, 21, 19];
  
  try {
    // Process all zoom levels in parallel for speed
    const zoomPromises = zoomLevels.map(zoom => 
      processZoomLevel(lat, lng, zoom, propertyData).catch(error => {
        logError(`Error processing zoom level ${zoom}`, { error: error.message });
        return {
          zoom,
          success: false,
          error: error.message,
          confidence: 0
        };
      })
    );
    
    // Wait for all zoom levels to process
    const results = await Promise.all(zoomPromises);
    
    // Filter successful results and sort by confidence
    const successfulResults = results
      .filter(result => result.success)
      .sort((a, b) => {
        // First by confidence
        if (b.confidence !== a.confidence) {
          return b.confidence - a.confidence;
        }
        // Then by area (prefer non-zero areas)
        if ((a.analysis.roofArea === 0) !== (b.analysis.roofArea === 0)) {
          return a.analysis.roofArea === 0 ? 1 : -1;
        }
        // Then by zoom level (prefer higher zoom)
        return b.zoom - a.zoom;
      });
    
    // If we have successful results, use the best one
    if (successfulResults.length > 0) {
      const best = successfulResults[0];
      logInfo(`Using best result from zoom level ${best.zoom} with confidence ${best.analysis.confidence} = ${best.confidence}`);
      
      // If we have a high confidence result, use it directly
      if (best.analysis.confidence === 'high') {
        return {
          success: true,
          ...best.analysis,
          method: "openai_vision"
        };
      }
      
      // For medium confidence, do some validation with property data if available
      if (best.analysis.confidence === 'medium' && propertyData?.buildingSize) {
        const expectedFootprint = propertyData.buildingSize / (propertyData.stories || 1);
        const visionFootprint = best.analysis.roofArea / 1.2; // Approximate reversal of pitch factor
        const ratio = visionFootprint / expectedFootprint;
        
        logInfo('Validating vision result against property data', {
          visionArea: best.analysis.roofArea,
          expectedFootprint,
          ratio
        });
        
        // If within reasonable range, confidence stays medium
        if (ratio >= 0.7 && ratio <= 1.5) {
          return {
            success: true,
            ...best.analysis,
            method: "openai_vision"
          };
        } else {
          // Reduce confidence if large discrepancy
          logInfo('Reducing confidence due to property data discrepancy');
          return {
            success: true,
            ...best.analysis,
            confidence: "low", 
            notes: (best.analysis.notes || "") + 
                   ` AI estimate (${best.analysis.roofArea} sq ft) differs significantly from property-based estimate.`,
            method: "openai_vision"
          };
        }
      }
      
      // Otherwise just return the best result we have
      return {
        success: true,
        ...best.analysis,
        method: "openai_vision"
      };
    }
    
    // If all zoom levels failed, return a zero area result with low confidence
    logInfo('All zoom levels failed to produce valid results');
    return {
      success: true,
      roofArea: 0,
      confidence: "low",
      roofShape: "unknown",
      roofPolygon: [],
      estimatedPitch: "unknown",
      notes: "Unable to analyze roof from satellite imagery at any zoom level.",
      method: "openai_vision"
    };
  } catch (error) {
    logError('Error processing multiple zoom levels', { error: error.message });
    throw error;
  }
}

/**
 * Process a single zoom level
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} zoom - Zoom level
 * @param {Object} propertyData - Property data
 */
async function processZoomLevel(lat, lng, zoom, propertyData) {
  try {
    // Get satellite image for this zoom level
    const imageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}`+
      `&zoom=${zoom}&size=640x640&scale=2&maptype=satellite`+
      `&format=png&key=${process.env.GOOGLE_MAPS_API_KEY}`;
      
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBase64 = Buffer.from(response.data, 'binary').toString('base64');
    
    // Analyze with OpenAI
    const analysis = await analyzeImageWithOpenAI(imageBase64, lat, lng, propertyData);
    
    // Convert confidence to number for sorting
    const confidenceValue = confidenceToNumber(analysis.confidence);
    
    logInfo(`Analysis at zoom level ${zoom}`, { 
      confidence: analysis.confidence,
      roofArea: analysis.roofArea
    });
    
    // If we get high confidence, log it
    if (analysis.confidence === 'high') {
      logInfo(`Found high confidence result at zoom level ${zoom}`);
    }
    
    return {
      zoom,
      success: true,
      analysis,
      confidence: confidenceValue
    };
  } catch (error) {
    logError(`Error processing zoom level ${zoom}`, { error: error.message });
    throw error;
  }
}

/**
 * Analyze satellite imagery using OpenAI Vision
 * @param {string} imageBase64 - Base64 encoded image
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Object} propertyData - Property data
 */
async function analyzeImageWithOpenAI(imageBase64, lat, lng, propertyData) {
  try {
    // Create a detailed property info string that includes all available data
    let propertyInfo = 'No property data available.';
    
    if (propertyData) {
      // Format property data for the prompt, with explicit story calculation
      const stories = propertyData.stories || 1;
      const footprint = propertyData.buildingSize ? Math.round(propertyData.buildingSize / stories) : null;
      const yearPhrase = propertyData.yearBuilt ? ` built in ${propertyData.yearBuilt}` : '';
      
      propertyInfo = `This is a ${propertyData.propertyType || 'residential'} property with a total of ${propertyData.buildingSize || 'unknown'} square feet across ${stories} ${stories === 1 ? 'story' : 'stories'}${yearPhrase}.`;
      
      if (footprint) {
        propertyInfo += ` The approximate ground floor footprint is ${footprint} square feet.`;
      }
      
      // Add roof type if available
      if (propertyData.roofType) {
        propertyInfo += ` The roof is a ${propertyData.roofType} type.`;
      }
    }
    
    // Log the prompt property info for debugging
    logInfo('OpenAI prompt property info', { propertyInfo });
    
    // Create the OpenAI request with detailed system prompt
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert in roof analysis from satellite imagery. Your task is to:
1. Precisely identify the roof boundaries of the main building
2. Measure the roof area in square feet
3. Determine the roof shape (simple, complex, etc.)
4. Assess the roof pitch if possible

Look for these visual cues:
- Sharp color/shadow transitions defining roof edges
- Regular geometric shapes indicating residential structures
- Roof material textures (shingles, metal, etc.)
- Shadows indicating height and pitch
- Context from surrounding structures and property layouts

IMPORTANT NOTES ON MEASUREMENT:
- For a multi-story building, you are measuring the roof area, not the total building square footage
- The roof area is typically similar to the building's footprint (ground floor area)
- For pitched roofs, the roof area will be larger than the footprint due to the slope
- A typical single family home has a footprint between 1,000-3,000 sq ft
- For multi-story buildings, divide the total square footage by the number of stories to estimate footprint

Be sure your measurements and confidence level are realistic based on image quality and visibility.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this satellite image of a property at coordinates ${lat}, ${lng}.

${propertyInfo}

Based on both the satellite image and the property information provided, please carefully analyze the roof and provide your assessment.

If the property information suggests a building footprint of a certain size, use that as a reference to calibrate your measurements.

Please provide your analysis in JSON format with these fields:
{
  "roofArea": number (in square feet),
  "confidence": "high" | "medium" | "low",
  "roofShape": "simple" | "complex" | "unknown",
  "roofPolygon": array of {lat, lng} points outlining the roof,
  "estimatedPitch": "flat" | "low" | "moderate" | "steep" | "unknown",
  "notes": string with your reasoning
}`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      max_tokens: 1500,
      temperature: 0.2,
      response_format: { type: "json_object" }
    });
    
    try {
      return JSON.parse(response.choices[0].message.content);
    } catch (parseError) {
      logError('Error parsing OpenAI response', { 
        error: parseError.message, 
        rawResponse: response.choices[0].message.content
      });
      throw new Error('Invalid response format from OpenAI');
    }
  } catch (error) {
    logError("Error analyzing image with OpenAI", { error: error.message });
    throw error;
  }
}

/**
 * Cross-validate the OpenAI result with property data
 * @param {Object} visionResult - Result from vision analysis
 * @param {Object} propertyData - Property data
 */
function crossValidateWithPropertyData(visionResult, propertyData) {
  if (!propertyData || !propertyData.buildingSize) {
    return visionResult;
  }
  
  try {
    const stories = propertyData.stories || 1;
    const expectedFootprint = Math.round(propertyData.buildingSize / stories);
    
    // Approximate roof size range based on property type and footprint
    let minExpected = expectedFootprint * 0.8;
    let maxExpected = expectedFootprint * 1.6;
    
    if (propertyData.propertyType) {
      const type = propertyData.propertyType.toLowerCase();
      if (type.includes('single') && type.includes('family')) {
        // Single family homes often have more complex, pitched roofs
        minExpected = expectedFootprint;
        maxExpected = expectedFootprint * 1.8;
      } else if (type.includes('condo') || type.includes('apartment')) {
        // Condos/apartments often have simpler roof designs
        minExpected = expectedFootprint * 0.9;
        maxExpected = expectedFootprint * 1.3;
      }
    }
    
    logInfo('Cross-validating vision result with property data', {
      visionArea: visionResult.roofArea,
      expectedFootprint,
      minExpected,
      maxExpected
    });
    
    // Check if vision result is within expected range
    if (visionResult.roofArea === 0) {
      // Vision failed to detect roof
      logInfo('Vision analysis failed to detect roof, using property-based calculation');
      return calculateRoofSizeFromProperty(propertyData, null, null);
    } else if (visionResult.roofArea < minExpected || visionResult.roofArea > maxExpected) {
      // Vision result is outside expected range
      logInfo('Vision result outside expected range, adjusting confidence');
      
      // If confidence was already low, just use property calculation
      if (visionResult.confidence === 'low') {
        logInfo('Low confidence vision result with large discrepancy, using property-based calculation');
        return calculateRoofSizeFromProperty(propertyData, null, null);
      }
      
      // Otherwise reduce confidence
      const adjustedResult = {
        ...visionResult,
        confidence: visionResult.confidence === 'high' ? 'medium' : 'low',
        notes: (visionResult.notes || "") + 
               ` AI estimate (${visionResult.roofArea} sq ft) differs significantly from property-based estimate (${Math.round(expectedFootprint * 1.2)} sq ft).`
      };
      
      return adjustedResult;
    }
    
    // Vision result is within expected range, keep as is
    return visionResult;
  } catch (error) {
    logError('Error in cross-validation', { error: error.message });
    return visionResult; // Return original on error
  }
}

/**
 * Calculate roof size from property data (fallback)
 * @param {Object} propertyData - Property metadata
 * @param {number} lat - Latitude coordinate (optional)
 * @param {number} lng - Longitude coordinate (optional)
 * @returns {Object} - Analysis result
 */
exports.calculateRoofSizeFromProperty = calculateRoofSizeFromProperty;

function calculateRoofSizeFromProperty(propertyData, lat, lng) {
  if (!propertyData || !propertyData.buildingSize) {
    return {
      success: true,
      roofArea: 2500, // Default reasonable value
      confidence: "low",
      roofShape: "unknown",
      roofPolygon: lat && lng ? generateSimpleRoofPolygon(lat, lng, 2500) : [],
      estimatedPitch: "moderate",
      method: "default_fallback",
      notes: "Used default values due to insufficient property data."
    };
  }
  
  // Extract key property data
  const stories = propertyData.stories || 1;
  const buildingSize = propertyData.buildingSize;
  
  // Calculate the ground floor footprint
  const footprint = Math.round(buildingSize / stories);
  
  // Calculate roof area based on property type and stories
  let roofAreaFactor = 1.2; // Default factor for moderate pitch
  let pitchDescription = "moderate";
  
  if (propertyData.propertyType) {
    const type = propertyData.propertyType.toLowerCase();
    
    if (type.includes('single') && type.includes('family')) {
      // Single family homes often have more complex, pitched roofs
      roofAreaFactor = 1.4;
      pitchDescription = "moderate";
    } else if (type.includes('townhouse') || type.includes('town house')) {
      roofAreaFactor = 1.25;
      pitchDescription = "moderate";
    } else if (type.includes('condo') || type.includes('apartment')) {
      // Condos/apartments often have simpler roof designs
      roofAreaFactor = 1.1;
      pitchDescription = "low";
    } else if (type.includes('commercial')) {
      // Commercial buildings often have flat roofs
      roofAreaFactor = 1.05;
      pitchDescription = "flat";
    }
  }
  
  // Apply roof pitch factor to footprint
  const roofArea = Math.round(footprint * roofAreaFactor);
  
  // Generate polygon if coordinates are provided
  const roofPolygon = (lat && lng) 
    ? generateSimpleRoofPolygon(lat, lng, roofArea)
    : [];
    
  logInfo('Calculated roof area from property data', {
    buildingSize,
    stories,
    footprint,
    roofAreaFactor,
    roofArea
  });
  
  return {
    success: true,
    roofArea,
    confidence: "medium",
    roofShape: "simple",
    roofPolygon,
    estimatedPitch: pitchDescription,
    method: "property_data_calculation",
    notes: `Calculated from ${buildingSize} sq ft ${stories}-story ${propertyData.propertyType || 'building'}.`
  };
}

/**
 * Generate a simple rectangular roof polygon
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} size - Roof area in sq ft
 * @returns {Array} - Array of lat/lng points
 */
function generateSimpleRoofPolygon(lat, lng, size) {
  // Basic square conversion - 1 sq foot = 0.092903 sq meters
  const sqMeters = size * 0.092903;
  
  // Apply scale correction for visual representation
  const adjustedSqMeters = sqMeters * 0.5;
  
  // Calculate dimensions assuming a rectangle with 1.5:1 aspect ratio
  const aspectRatio = 1.5;
  const width = Math.sqrt(adjustedSqMeters / aspectRatio);
  const length = width * aspectRatio;
  
  // Convert to degrees (rough approximation)
  // 1 degree lat = ~111km, 1 degree lng varies with latitude
  const latDegPerMeter = 1 / 111000;
  const lngDegPerMeter = 1 / (111000 * Math.cos(lat * Math.PI / 180));
  
  const latOffset = length * latDegPerMeter / 2;
  const lngOffset = width * lngDegPerMeter / 2;
  
  // Create rectangle coordinates with closing point
  return [
    { lat: lat - latOffset, lng: lng - lngOffset },
    { lat: lat - latOffset, lng: lng + lngOffset },
    { lat: lat + latOffset, lng: lng + lngOffset },
    { lat: lat + latOffset, lng: lng - lngOffset },
    { lat: lat - latOffset, lng: lng - lngOffset } // Close the polygon
  ];
}

/**
 * Convert confidence level to numeric value for sorting
 * @param {string} confidence - Confidence level (high, medium, low)
 * @returns {number} - Numeric confidence value
 */
function confidenceToNumber(confidence) {
  switch (confidence) {
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0;
  }
}
