// backend/services/openAIVisionService.js
const { OpenAI } = require('openai');
const axios = require('axios');
const { logInfo, logError } = require('../utils/logger');
const fs = require('fs');
const path = require('path');

// Initialize OpenAI with API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// In-memory cache for performance optimization
const analysisCache = {};
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// File-based cache for persistence across restarts
const CACHE_DIR = path.join(__dirname, '..', 'cache');
const DISK_CACHE_ENABLED = true;

// Ensure cache directory exists
if (DISK_CACHE_ENABLED) {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      logInfo('Created cache directory', { path: CACHE_DIR });
    }
  } catch (error) {
    logError('Failed to create cache directory', { error: error.message });
  }
}

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

    // Generate cache key based on coordinates and property data hash
    const propDataHash = propertyData ? 
      hashPropertyData(propertyData) : 'no-property-data';
    const cacheKey = `${lat.toFixed(6)},${lng.toFixed(6)}-${propDataHash}`;
    
    // Check memory cache first
    if (analysisCache[cacheKey] && 
        analysisCache[cacheKey].timestamp > Date.now() - CACHE_TTL) {
      logInfo('Using memory-cached roof analysis', { lat, lng, cacheAge: 'less than 24 hours' });
      return analysisCache[cacheKey].result;
    }
    
    // Check disk cache if enabled
    if (DISK_CACHE_ENABLED) {
      const diskCacheResult = await checkDiskCache(cacheKey);
      if (diskCacheResult) {
        // Store in memory cache too
        analysisCache[cacheKey] = {
          result: diskCacheResult,
          timestamp: Date.now()
        };
        logInfo('Using disk-cached roof analysis', { lat, lng });
        return diskCacheResult;
      }
    }

    // No cache hit, perform the analysis
    logInfo('Starting roof analysis with OpenAI Vision', { lat, lng });
    
    // Process multiple zoom levels
    const result = await processMultipleZoomLevels(lat, lng, propertyData);
    
    // Apply industry standard adjustments
    const adjustedResult = adjustToIndustryStandards(result, propertyData);
    
    // Cross-validate with property data and adjust if necessary
    let finalResult = crossValidateWithPropertyData(adjustedResult, propertyData);
    
    // Store in memory cache
    analysisCache[cacheKey] = {
      result: finalResult,
      timestamp: Date.now()
    };
    
    // Store in disk cache if enabled
    if (DISK_CACHE_ENABLED) {
      saveToDiskCache(cacheKey, finalResult).catch(err => {
        logError('Failed to save to disk cache', { error: err.message });
      });
    }
    
    logInfo('OpenAI Vision analysis completed', { 
      confidence: finalResult.confidence,
      roofArea: finalResult.roofArea,
      cacheSaved: true
    });
    
    return finalResult;
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
  const zoomLevels = [21, 20, 19];
  
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
 * Analyze satellite imagery using OpenAI Vision with enhanced industry standards
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
    
    // Create the OpenAI request with enhanced system prompt for industry standards
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert roof measurement specialist using satellite imagery to assess residential and commercial roofs. Your goal is to provide comprehensive and accurate measurements that match industry standards used by roofing contractors.

CRITICAL ROOF MEASUREMENT PRINCIPLES:
1. MEASURE COMPLETE ROOF AREA - Include ALL roof planes visible and implied, not just the main section
2. ACCOUNT FOR PITCH COMPLETELY - Steep pitches can add 40-70% to horizontal footprint area
3. INCLUDE ALL ROOF FEATURES - Measure dormers, overhangs, porches, and extensions
4. CONSIDER MULTI-LEVEL ROOFS - Different levels should be measured separately and summed
5. INCLUDE HIDDEN SECTIONS - Use visual cues to estimate sections partially obscured by trees
6. APPLY INDUSTRY STANDARDS - Roofers typically measure conservatively to avoid material shortages

TYPICAL MEASUREMENT RANGES:
- Small homes (1000-1500 sq ft footprint): Typically 1500-2400 sq ft roof area
- Medium homes (1500-2500 sq ft footprint): Typically 2200-3800 sq ft roof area
- Large homes (2500-4000 sq ft footprint): Typically 3500-6000 sq ft roof area

When analyzing roofs of 2-story single-family homes:
- For low pitch: Add 10-15% to footprint
- For moderate pitch: Add 20-30% to footprint
- For steep pitch: Add 40-70% to footprint
- Overhangs typically add 5-15% to measurement
- Complex shapes add another 5-15% for valleys and intricate sections

If you're uncertain about a measurement, err on the conservative side used by contractors who typically measure roofs 10-15% larger to account for waste, overlaps, and complex cuts.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this satellite image of a property at coordinates ${lat}, ${lng}.

${propertyInfo}

I need a COMPREHENSIVE roof measurement that follows industry standards for roofing contractors. Please:

1. Examine all visible roof planes and sections
2. Measure the TOTAL ROOF SURFACE AREA including all pitches, not just the building footprint
3. Include overhangs, dormers, and any extensions in your calculation
4. Consider the roof pitch carefully - most single-family homes have at least moderate pitch
5. If trees or shadows obscure parts of the roof, make a reasonable estimate for those areas

Provide your analysis in JSON format with these fields:
{
  "roofArea": number (in square feet, TOTAL SURFACE AREA including all pitch factors),
  "confidence": "high" | "medium" | "low",
  "roofShape": "simple" | "complex" | "unknown",
  "roofPolygon": array of {lat, lng} points outlining the roof,
  "estimatedPitch": "flat" | "low" | "moderate" | "steep" | "unknown",
  "notes": string with your reasoning,
  "includedFeaturesInArea": ["main roof", "garage", "dormers", "overhangs", etc]
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
      // Parse the JSON response and clean up the result
      const analysisResult = JSON.parse(response.choices[0].message.content);
      
      // Ensure roofPolygon exists
      if (!analysisResult.roofPolygon || !Array.isArray(analysisResult.roofPolygon)) {
        analysisResult.roofPolygon = [];
      }
      
      // Normalize includedFeaturesInArea as an array
      if (!analysisResult.includedFeaturesInArea) {
        analysisResult.includedFeaturesInArea = [];
      }
      
      return analysisResult;
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
 * Apply industry standard adjustments to ensure measurements match contractor norms
 * @param {Object} visionResult - Result from vision analysis
 * @param {Object} propertyData - Property data
 */
function adjustToIndustryStandards(visionResult, propertyData) {
  if (!propertyData || !propertyData.buildingSize) {
    return visionResult; // No adjustment possible without property data
  }
  
  try {
    // Extract key data
    const stories = propertyData.stories || 1;
    const footprint = Math.round(propertyData.buildingSize / stories);
    const roofArea = visionResult.roofArea;
    const propertyType = (propertyData.propertyType || '').toLowerCase();
    const isSingleFamily = propertyType.includes('single') && propertyType.includes('family');
    
    // Determine industry standard minimums based on property type
    let minIndustryFactor = 1.2; // Default 20% above footprint
    
    if (isSingleFamily) {
      // Single family homes typically have larger industry factors
      if (visionResult.estimatedPitch === 'steep') {
        minIndustryFactor = 1.4; // 40% for steep pitch
      } else if (visionResult.estimatedPitch === 'moderate') {
        minIndustryFactor = 1.25; // 25% for moderate pitch
      } else if (visionResult.estimatedPitch === 'low') {
        minIndustryFactor = 1.15; // 15% for low pitch
      }
      
      // Add complexity factor
      if (visionResult.roofShape === 'complex') {
        minIndustryFactor += 0.1; // Additional 10% for complex shapes
      }
    }
    
    // Calculate minimum industry standard measurement
    const minIndustryStandard = Math.round(footprint * minIndustryFactor);
    
    // If vision result is below industry standard, adjust upward
    if (roofArea < minIndustryStandard) {
      logInfo('Adjusting measurement to meet industry standards', {
        originalArea: roofArea,
        adjustedArea: minIndustryStandard,
        factor: minIndustryFactor,
        reason: 'Below industry minimum'
      });
      
      return {
        ...visionResult,
        roofArea: minIndustryStandard,
        notes: (visionResult.notes || '') + 
               ' Adjusted to meet industry standards for roofing contractors.'
      };
    }
    
    return visionResult; // Already meets industry standards
  } catch (error) {
    logError('Error applying industry standards', { error: error.message });
    return visionResult; // Return original on error
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
    
    // Determine appropriate factors based on property type
    const propertyType = (propertyData.propertyType || '').toLowerCase();
    const isSingleFamily = propertyType.includes('single') && propertyType.includes('family');
    
    // Approximate roof size range based on property type and footprint
    let minExpected, maxExpected;
    
    if (isSingleFamily) {
      // Single family homes have wider acceptable ranges
      minExpected = expectedFootprint;
      maxExpected = Math.round(expectedFootprint * 1.8);
    } else {
      // Other property types have narrower ranges
      minExpected = Math.round(expectedFootprint * 0.9);
      maxExpected = Math.round(expectedFootprint * 1.5);
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
    } else if (visionResult.roofArea < minExpected) {
      // Vision result is below expected minimum
      logInfo('Vision result below expected minimum, adjusting upward');
      
      // If confidence was already low, use property calculation
      if (visionResult.confidence === 'low') {
        return calculateRoofSizeFromProperty(propertyData, null, null);
      }
      
      // Otherwise adjust the vision result upward
      const adjustedResult = {
        ...visionResult,
        roofArea: minExpected,
        notes: (visionResult.notes || "") + 
               ` Adjusted upward (from ${visionResult.roofArea} sq ft) to meet expected minimum for this property type.`
      };
      
      return adjustedResult;
    } else if (visionResult.roofArea > maxExpected && visionResult.confidence !== 'high') {
      // Vision result is above expected maximum and not high confidence
      logInfo('Vision result above expected maximum and not high confidence, adjusting downward');
      
      const adjustedResult = {
        ...visionResult,
        roofArea: maxExpected,
        confidence: 'medium',
        notes: (visionResult.notes || "") + 
               ` Adjusted downward (from ${visionResult.roofArea} sq ft) to meet expected maximum for this property type.`
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
 * Calculate roof size from property data (fallback and cross-reference)
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
  let roofShapeDescription = "simple";
  
  if (propertyData.propertyType) {
    const type = propertyData.propertyType.toLowerCase();
    
    if (type.includes('single') && type.includes('family')) {
      // Single family homes often have more complex, pitched roofs
      // Use higher factors to match industry standards
      roofAreaFactor = 1.5; // Increased for industry standard match
      pitchDescription = "moderate";
      roofShapeDescription = footprint > 2000 ? "complex" : "simple";
    } else if (type.includes('townhouse') || type.includes('town house')) {
      roofAreaFactor = 1.3;
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
    roofShape: roofShapeDescription,
    roofPolygon,
    estimatedPitch: pitchDescription,
    method: "property_data_calculation",
    notes: `Calculated from ${buildingSize} sq ft ${stories}-story ${propertyData.propertyType || 'building'} using industry standard measurements.`,
    includedFeaturesInArea: ["main roof", "overhangs"]
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

/**
 * Create a basic hash of property data for cache key
 * @param {Object} propertyData - Property data
 * @returns {string} - Hash string
 */
function hashPropertyData(propertyData) {
  if (!propertyData) return 'null';
  
  const relevant = {
    type: propertyData.propertyType || '',
    size: propertyData.buildingSize || 0,
    stories: propertyData.stories || 1
  };
  
  return `${relevant.type}-${relevant.size}-${relevant.stories}`;
}

/**
 * Check disk cache for an entry
 * @param {string} cacheKey - Cache key
 * @returns {Object|null} - Cached result or null
 */
async function checkDiskCache(cacheKey) {
  if (!DISK_CACHE_ENABLED) return null;
  
  try {
    const cacheFile = path.join(CACHE_DIR, `${encodeURIComponent(cacheKey)}.json`);
    
    if (!fs.existsSync(cacheFile)) {
      return null;
    }
    
    const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    
    // Check if cache has expired
    if (cacheData.timestamp && (Date.now() - cacheData.timestamp) > CACHE_TTL) {
      return null;
    }
    
    return cacheData.result;
  } catch (error) {
    logError('Error checking disk cache', { error: error.message });
    return null;
  }
}

/**
 * Save result to disk cache
 * @param {string} cacheKey - Cache key
 * @param {Object} result - Result to cache
 */
async function saveToDiskCache(cacheKey, result) {
  if (!DISK_CACHE_ENABLED) return;
  
  try {
    const cacheFile = path.join(CACHE_DIR, `${encodeURIComponent(cacheKey)}.json`);
    
    const cacheData = {
      timestamp: Date.now(),
      result
    };
    
    fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
  } catch (error) {
    logError('Error saving to disk cache', { error: error.message });
  }
}
