// backend/services/openAIVisionService.js - Updated version

const { OpenAI } = require('openai');
const axios = require('axios');
const { logInfo, logError } = require('../utils/logger');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Analyze roof using OpenAI Vision
 */
exports.analyzeRoof = async (lat, lng, propertyData = null) => {
  try {
    logInfo('Starting roof analysis with OpenAI Vision', { lat, lng });
    
    // Get the best satellite image
    const { imageBase64, analysis } = await getOptimalSatelliteImage(lat, lng, propertyData);
    
    return {
      success: true,
      ...analysis,
      method: "openai_vision"
    };
  } catch (error) {
    logError('Error in OpenAI Vision roof analysis', { error: error.message });
    throw error;
  }
};

/**
 * Get the optimal satellite image and analysis
 */
const getOptimalSatelliteImage = async (lat, lng, propertyData) => {
  // Try different zoom levels
  const zoomLevels = [20, 19, 21]; // Try zoom 20 first, then 19, then 21
  const results = [];
  
  for (const zoom of zoomLevels) {
    try {
      const imageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}`+
        `&zoom=${zoom}&size=640x640&scale=2&maptype=satellite`+
        `&format=png&key=${process.env.GOOGLE_MAPS_API_KEY}`;
        
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imageBase64 = Buffer.from(response.data, 'binary').toString('base64');
      
      // Analyze with OpenAI
      const analysis = await analyzeImageWithOpenAI(imageBase64, lat, lng, propertyData);
      
      logInfo(`Analysis at zoom level ${zoom}`, { 
        confidence: analysis.confidence,
        roofArea: analysis.roofArea
      });
      
      results.push({
        zoom,
        imageBase64,
        analysis,
        confidence: confidenceToNumber(analysis.confidence)
      });
      
      // If we get high confidence, return immediately
      if (analysis.confidence === 'high') {
        logInfo(`Found high confidence result at zoom level ${zoom}`);
        return { imageBase64, analysis };
      }
    } catch (error) {
      logError(`Error with zoom level ${zoom}`, { error: error.message });
    }
  }
  
  // Sort by confidence and return the best one
  results.sort((a, b) => b.confidence - a.confidence);
  
  if (results.length > 0) {
    const best = results[0];
    logInfo(`Using best result from zoom level ${best.zoom} with confidence ${best.analysis.confidence}`);
    return { imageBase64: best.imageBase64, analysis: best.analysis };
  }
  
  // If all zoom levels failed, return a low confidence result
  return {
    imageBase64: '',
    analysis: {
      roofArea: 0,
      confidence: "low",
      roofShape: "unknown",
      roofPolygon: [],
      estimatedPitch: "unknown",
      notes: "Could not obtain good satellite imagery for analysis"
    }
  };
};

/**
 * Analyze image with OpenAI Vision
 */
const analyzeImageWithOpenAI = async (imageBase64, lat, lng, propertyData) => {
  try {
    // Format property info for the prompt
    const propertyInfo = propertyData ? 
      `This is a ${propertyData.propertyType} property with ${propertyData.buildingSize} square feet and ${propertyData.stories || 1} stories.` : 
      'No property information is available.';
    
    // Create the OpenAI request
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
- Context from surrounding structures and property layouts`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this satellite image of a property at coordinates ${lat}, ${lng}. ${propertyInfo}
              
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
    
    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    logError("Error analyzing image with OpenAI", { error: error.message });
    throw error;
  }
};

/**
 * Calculate roof size from property data (fallback)
 */
exports.calculateRoofSizeFromProperty = (propertyData, lat, lng) => {
  if (!propertyData || !propertyData.buildingSize) {
    return null;
  }
  
  const stories = propertyData.stories || 1;
  const footprint = propertyData.buildingSize / stories;
  
  // Calculate roof area based on property type and stories
  let roofAreaFactor = 1.2; // Default factor
  
  if (propertyData.propertyType) {
    const type = propertyData.propertyType.toLowerCase();
    if (type.includes('single') && type.includes('family')) {
      roofAreaFactor = 1.4; // Single family homes often have more complex, pitched roofs
    } else if (type.includes('townhouse') || type.includes('town house')) {
      roofAreaFactor = 1.25;
    } else if (type.includes('condo') || type.includes('apartment')) {
      roofAreaFactor = 1.1; // Condos/apartments often have simpler roof designs
    }
  }
  
  const roofArea = Math.round(footprint * roofAreaFactor);
  
  return {
    success: true,
    roofArea,
    confidence: "medium",
    roofShape: "simple",
    roofPolygon: generateSimpleRoofPolygon(lat, lng, roofArea),
    estimatedPitch: "moderate",
    method: "property_data_calculation",
    notes: "Calculated from property data only."
  };
};

/**
 * Generate a simple rectangular roof polygon
 */
function generateSimpleRoofPolygon(lat, lng, size) {
  // Basic square conversion - 1 sq foot = 0.092903 sq meters
  const sqMeters = size * 0.092903;
  
  // Apply scale correction
  const adjustedSqMeters = sqMeters * 0.5;
  
  // Calculate dimensions for a square
  const side = Math.sqrt(adjustedSqMeters);
  
  // Convert to degrees (rough approximation)
  // 1 degree lat = ~111km, 1 degree lng varies with latitude
  const latDegPerMeter = 1 / 111000;
  const lngDegPerMeter = 1 / (111000 * Math.cos(lat * Math.PI / 180));
  
  const latOffset = side * latDegPerMeter / 2;
  const lngOffset = side * lngDegPerMeter / 2;
  
  // Create rectangle coordinates with closing point
  return [
    { lat: lat - latOffset, lng: lng - lngOffset },
    { lat: lat - latOffset, lng: lng + lngOffset },
    { lat: lat + latOffset, lng: lng + lngOffset },
    { lat: lat + latOffset, lng: lng - lngOffset },
    { lat: lat - latOffset, lng: lng - lngOffset } // Close the polygon
  ];
}

// Helper function to convert confidence to number for sorting
function confidenceToNumber(confidence) {
  switch (confidence) {
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0;
  }
}
