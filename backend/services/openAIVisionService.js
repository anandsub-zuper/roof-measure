// backend/services/openAIVisionService.js
const { OpenAI } = require('openai');
const axios = require('axios');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Get satellite imagery for a location
 */
const getSatelliteImage = async (lat, lng) => {
  const zoom = 20; // High zoom level for detailed view
  const size = "640x640"; // Large image for better analysis
  const mapType = "satellite";
  const scale = 2; // Higher resolution
  
  const imageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${size}&scale=${scale}&maptype=${mapType}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
  
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary').toString('base64');
  } catch (error) {
    console.error("Error fetching satellite image:", error);
    throw error;
  }
};

/**
 * Analyze a roof using OpenAI Vision
 */
const analyzeRoof = async (lat, lng, propertyData) => {
  try {
    console.log("🔍 VISION: Starting roof analysis for coordinates:", lat, lng);
    console.log("🔍 VISION: Property data provided:", !!propertyData);
    
    // Get satellite image
    const imageBase64 = await getSatelliteImage(lat, lng);
    console.log("🔍 VISION: Satellite image fetched successfully");
    
    return await analyzeRoofFromImage(imageBase64, propertyData, lat, lng);
  } catch (error) {
    console.error("🔍 VISION: Error in roof analysis:", error);
    throw error;
  }
};

/**
 * Process the satellite image with OpenAI Vision
 */
const analyzeRoofFromImage = async (imageBase64, propertyData, lat, lng) => {
  try {
    // Prepare property information string
    let propertyInfo = "No property data available.";
    
    if (propertyData) {
      propertyInfo = `This property has ${propertyData.buildingSize || 'unknown'} square feet total ` +
        `with ${propertyData.stories || 1} stories, and is a ${propertyData.propertyType || 'residential'} building. ` +
        `${propertyData.yearBuilt ? `It was built in ${propertyData.yearBuilt}.` : ''}`;
    }
    
    console.log("🔍 VISION: Sending to OpenAI with property info:", propertyInfo);
    
    // Call OpenAI Vision API
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert roof measurement specialist. Analyze the satellite imagery to identify and measure the main building's roof. The image is centered at coordinates: ${lat}, ${lng}.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this satellite image of a property. ${propertyInfo}
              
              Please:
              1. Identify the main building's roof outline
              2. Calculate the approximate roof square footage
              3. Determine if it's a simple or complex roof shape
              4. Provide coordinates for a polygon that outlines the roof
              5. Estimate the roof pitch if possible
              
              Return your analysis ONLY in JSON format with these fields:
              {
                "roofArea": number (in square feet),
                "confidence": "high" | "medium" | "low",
                "roofShape": "simple" | "complex",
                "roofPolygon": array of {lat, lng} points,
                "estimatedPitch": "flat" | "low" | "moderate" | "steep" | "unknown",
                "notes": string
              }`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      max_tokens: 1500,
      temperature: 0.2,
      response_format: { type: "json_object" }
    });
    
    // Parse the JSON response
    let analysis;
    try {
      analysis = JSON.parse(response.choices[0].message.content);
      console.log("🔍 VISION: OpenAI analysis result:", analysis);
    } catch (parseError) {
      console.error("🔍 VISION: Error parsing OpenAI response:", parseError);
      console.log("🔍 VISION: Raw response:", response.choices[0].message.content);
      throw new Error("Failed to parse OpenAI response");
    }
    
    // Cross-validate with property data
    if (propertyData && propertyData.buildingSize && propertyData.stories > 0) {
      const footprint = propertyData.buildingSize / propertyData.stories;
      let expectedRoofArea = footprint;
      
      // Adjust for roof pitch based on estimated pitch
      const pitchFactors = {
        'flat': 1.05,
        'low': 1.15,
        'moderate': 1.3,
        'steep': 1.5,
        'unknown': 1.25
      };
      
      expectedRoofArea *= pitchFactors[analysis.estimatedPitch] || 1.25;
      
      // Compare with AI's estimate
      const ratio = analysis.roofArea / expectedRoofArea;
      console.log("🔍 VISION: Cross-validation - AI area:", analysis.roofArea, 
                  "Expected area:", expectedRoofArea, "Ratio:", ratio);
      
      // If there's a significant discrepancy
      if (ratio < 0.6 || ratio > 1.6) {
        console.log("🔍 VISION: Significant discrepancy detected. Reducing confidence.");
        analysis.confidence = "low";
        analysis.notes = (analysis.notes || "") + 
                        ` AI estimate (${analysis.roofArea} sq ft) differs significantly from property-based estimate (${Math.round(expectedRoofArea)} sq ft).`;
      }
    }
    
    return {
      success: true,
      ...analysis,
      method: "openai_vision"
    };
  } catch (error) {
    console.error("🔍 VISION: OpenAI Vision analysis error:", error);
    throw error;
  }
};

/**
 * Calculate roof size from property data (fallback)
 */
const calculateRoofSizeFromProperty = (propertyData, lat, lng) => {
  console.log("🔍 VISION: Falling back to property-based calculation");
  
  if (!propertyData || !propertyData.buildingSize) {
    console.log("🔍 VISION: Insufficient property data for calculation");
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
  
  // Generate a simple rectangular polygon for this roof
  const roofPolygon = generateSimpleRoofPolygon(lat, lng, roofArea);
  
  return {
    success: true,
    roofArea,
    confidence: "medium",
    roofShape: "simple",
    roofPolygon,
    estimatedPitch: "moderate",
    method: "property_data_calculation",
    notes: "Calculated from property data only."
  };
};

/**
 * Generate a simple rectangular roof polygon
 */
const generateSimpleRoofPolygon = (lat, lng, roofArea) => {
  // Calculate dimensions based on a typical aspect ratio
  const aspectRatio = 1.5; // Length:Width ratio
  const totalAreaMeters = roofArea / 10.7639; // Convert sq ft to sq meters
  
  // Calculate dimensions
  const width = Math.sqrt(totalAreaMeters / aspectRatio);
  const length = width * aspectRatio;
  
  // Convert to degrees
  const metersPerDegreeLat = 111319.9; // at equator
  const latRadians = lat * (Math.PI / 180);
  const metersPerDegreeLng = metersPerDegreeLat * Math.cos(latRadians);
  
  const latOffset = (length / 2) / metersPerDegreeLat;
  const lngOffset = (width / 2) / metersPerDegreeLng;
  
  // Create rectangle
  return [
    { lat: lat - latOffset, lng: lng - lngOffset },
    { lat: lat - latOffset, lng: lng + lngOffset },
    { lat: lat + latOffset, lng: lng + lngOffset },
    { lat: lat + latOffset, lng: lng - lngOffset },
    { lat: lat - latOffset, lng: lng - lngOffset } // Close the polygon
  ];
};

module.exports = {
  analyzeRoof,
  calculateRoofSizeFromProperty
};
