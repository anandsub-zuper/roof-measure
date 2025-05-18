// backend/services/openAIService.js
const axios = require('axios');

// OpenAI API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o';
const OPENAI_VISION_MODEL = 'gpt-4o';

/**
 * Make a request to OpenAI API with standardized error handling
 * @param {Object} requestData - The request payload
 * @returns {Promise<Object>} - The OpenAI API response
 */
const makeOpenAIRequest = async (requestData) => {
  try {
    const response = await axios.post(
      OPENAI_API_URL,
      requestData,
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('OpenAI API error:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Generate roof estimate using OpenAI
 * @param {Object} data - The form data for the estimate
 * @returns {Promise<Object>} - The estimate data
 */
const generateRoofEstimate = async (data) => {
  try {
    // Construct prompt for OpenAI
    const prompt = `
      Generate a detailed roofing cost estimate with the following parameters:
      - Roof size: ${data.roofSize} square feet
      - Roof steepness: ${data.roofSteepness}
      - Desired material: ${data.desiredRoofMaterial}
      - Current material: ${data.currentRoofMaterial}
      - Building type: ${data.buildingType}
      - Location: ${data.city}, ${data.state}
      
      Provide a complete estimate including:
      1. Total cost range (low, average, high)
      2. Cost breakdown by category
      3. Price per square foot
      4. Factors affecting the price
      5. Material information
      
      Format the response as a JSON object that can be parsed.
    `;
    
    // Call OpenAI API
    const requestData = {
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: "You are an expert roofing contractor with detailed knowledge of costs and material requirements." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 1500
    };
    
    const responseData = await makeOpenAIRequest(requestData);
    
    // Extract the JSON response
    const content = responseData.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const estimateData = JSON.parse(jsonMatch[0]);
      return estimateData;
    }
    
    // Fallback to simulated estimate if parsing fails
    return generateSimulatedEstimate(data);
  } catch (error) {
    console.error('Error generating estimate:', error);
    // Fallback to simulated estimate on API error
    return generateSimulatedEstimate(data);
  }
};

/**
 * Analyze a roof image to identify roof boundaries
 * @param {string} imageBase64 - The base64-encoded image data
 * @returns {Promise<Array>} - Array of coordinates for the roof polygon
 */
const analyzeRoofImage = async (imageBase64) => {
  try {
    if (!imageBase64) {
      throw new Error('No image data provided');
    }
    
    // Create the OpenAI Vision API request
    const requestData = {
      model: OPENAI_VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this satellite image and identify the roof boundaries. Return ONLY a JSON array of coordinates representing the roof polygon. Format should be [{lat: number, lng: number}, ...]. Be precise and include only the main building roof."
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
      max_tokens: 1000
    };
    
    // Make the API request
    const responseData = await makeOpenAIRequest(requestData);
    
    // Extract the JSON array from the response
    const responseText = responseData.choices[0].message.content;
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    
    if (jsonMatch) {
      try {
        const coordinates = JSON.parse(jsonMatch[0]);
        
        // Validate the coordinates
        if (Array.isArray(coordinates) && coordinates.length >= 3) {
          const validCoordinates = coordinates.every(coord => 
            typeof coord === 'object' && 
            typeof coord.lat === 'number' && 
            typeof coord.lng === 'number'
          );
          
          if (validCoordinates) {
            return coordinates;
          }
        }
        throw new Error('Invalid coordinates format');
      } catch (parseError) {
        console.error("Failed to parse coordinates from OpenAI response:", parseError);
        throw new Error('Failed to parse AI response');
      }
    }
    
    throw new Error('Unable to extract coordinates from AI response');
  } catch (error) {
    console.error('Error analyzing roof image:', error);
    throw error;
  }
};

/**
 * Answer a roofing-related question using OpenAI
 * @param {string} question - The question to ask
 * @returns {Promise<Object>} - The answer data
 */
const askRoofingQuestion = async (question) => {
  try {
    const requestData = {
      model: OPENAI_MODEL,
      messages: [
        { 
          role: "system", 
          content: "You are an expert roofing contractor with extensive knowledge about roofing materials, installation, maintenance, and costs. Provide helpful, accurate information to homeowners."
        },
        { 
          role: "user", 
          content: question 
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    };
    
    const responseData = await makeOpenAIRequest(requestData);
    return {
      answer: responseData.choices[0].message.content,
      metadata: {
        model: OPENAI_MODEL,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error answering roofing question:', error);
    throw error;
  }
};

// Fallback function to generate estimates without API
const generateSimulatedEstimate = (data) => {
  // Price per square foot based on material
  const basePricePerSqft = {
    'asphalt': 4.5,
    'metal': 8.5,
    'tile': 9.5
  }[data.desiredRoofMaterial] || 5.5;
  
  // Adjustment factors
  const steepnessFactor = {
    'flat': 0.9,
    'low': 1.0,
    'moderate': 1.15,
    'steep': 1.4
  }[data.roofSteepness] || 1.0;
  
  // Calculate estimate
  const totalSqft = parseFloat(data.roofSize);
  const averagePrice = Math.round(totalSqft * basePricePerSqft * steepnessFactor);
  
  return {
    lowEstimate: Math.round(averagePrice * 0.85),
    estimate: averagePrice,
    highEstimate: Math.round(averagePrice * 1.15),
    pricePerSqft: Math.round(basePricePerSqft * steepnessFactor * 10) / 10,
    estimateParts: [
      { name: "Removal & Disposal", cost: Math.round(averagePrice * 0.15) },
      { name: "Materials", cost: Math.round(averagePrice * 0.45) },
      { name: "Labor", cost: Math.round(averagePrice * 0.3) },
      { name: "Permits & Overhead", cost: Math.round(averagePrice * 0.1) }
    ],
    estimateFactors: [
      { factor: "Roof Size", impact: "High Impact", description: `Your ${data.roofSize} sq ft roof is the primary cost factor` },
      { factor: "Roof Steepness", impact: steepnessFactor > 1.1 ? "High Impact" : "Medium Impact", description: `${data.roofSteepness} roof requires ${data.roofSteepness === 'steep' ? 'specialized equipment' : 'standard installation'}` },
      { factor: "Material", impact: "High Impact", description: `${data.desiredRoofMaterial} roofing affects cost and longevity` }
    ]
  };
};

module.exports = {
  generateRoofEstimate,
  analyzeRoofImage,
  askRoofingQuestion
};
