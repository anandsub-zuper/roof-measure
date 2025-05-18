// services/openaiService.js
const axios = require('axios');
const { logInfo, logError } = require('../utils/logger');

// OpenAI API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o';

/**
 * Make a request to OpenAI API with standardized error handling
 * @param {Object} requestData - The request payload
 * @returns {Promise<Object>} - The OpenAI API response
 */
const makeOpenAIRequest = async (requestData) => {
  try {
    logInfo('Making OpenAI request', { model: requestData.model });
    
    const response = await axios.post(
      OPENAI_API_URL,
      requestData,
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      }
    );
    
    return response.data;
  } catch (error) {
    logError('OpenAI API error', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
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
      - Current material: ${data.currentRoofMaterial || 'Not specified'}
      - Building type: ${data.buildingType || 'Not specified'}
      - Location: ${data.city || ''}, ${data.state || ''}
      - Timeline: ${data.timeline || 'Not specified'}
      - Financing preferences: ${data.financing || 'Not specified'}
      
      Provide a complete estimate including:
      1. Total cost range (low, average, high)
      2. Cost breakdown by category (materials, labor, removal, etc.)
      3. Price per square foot
      4. Factors affecting the price
      5. Material information (lifespan, pros, cons)
      
      Format the response as a JSON object with the following structure:
      {
        "lowEstimate": number,
        "estimate": number,
        "highEstimate": number,
        "pricePerSqft": number,
        "estimateParts": [
          { "name": string, "cost": number }
        ],
        "estimateFactors": [
          { "factor": string, "impact": string, "description": string }
        ],
        "materialInfo": {
          "lifespan": string,
          "pros": [string],
          "cons": [string]
        }
      }
    `;
    
    // Call OpenAI API
    const requestData = {
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: "You are an expert roofing contractor with detailed knowledge of costs and material requirements. Provide accurate, realistic estimates based on current market rates and local factors." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: "json_object" }
    };
    
    const responseData = await makeOpenAIRequest(requestData);
    const content = responseData.choices[0].message.content;
    
    try {
      // Parse the JSON response
      const estimateData = JSON.parse(content);
      return estimateData;
    } catch (parseError) {
      logError('Error parsing OpenAI response', { error: parseError.message, content });
      // Fallback to simulated estimate if parsing fails
      return generateSimulatedEstimate(data);
    }
  } catch (error) {
    logError('Error generating estimate with OpenAI', { error: error.message });
    // Fallback to simulated estimate on API error
    return generateSimulatedEstimate(data);
  }
};

/**
 * Fallback function to generate estimates without OpenAI
 * @param {Object} data - Form data
 * @returns {Object} Simulated estimate
 */
const generateSimulatedEstimate = (data) => {
  logInfo('Generating simulated estimate', { roofSize: data.roofSize, material: data.desiredRoofMaterial });
  
  // Price per square foot based on material
  const basePricePerSqft = {
    'asphalt': 4.5,
    'metal': 9.5,
    'tile': 12.5,
    'cedar': 8.5
  }[data.desiredRoofMaterial] || 6.0;
  
  // Adjustment factors
  const steepnessFactor = {
    'flat': 0.9,
    'low': 1.0,
    'moderate': 1.15,
    'steep': 1.4
  }[data.roofSteepness] || 1.0;
  
  // Regional adjustment based on state
  const regionFactor = (() => {
    if (!data.state) return 1.0;
    
    const state = data.state.toUpperCase();
    // Higher cost regions
    if (['CA', 'NY', 'MA', 'NJ', 'CT', 'WA', 'DC'].includes(state)) return 1.25;
    // Medium cost regions
    if (['CO', 'OR', 'IL', 'MD', 'VA', 'MN', 'RI'].includes(state)) return 1.1;
    // Lower cost regions
    if (['TX', 'FL', 'GA', 'NC', 'TN', 'AL', 'MS', 'KY', 'OK', 'AR'].includes(state)) return 0.9;
    
    return 1.0;
  })();
  
  // Calculate estimate
  const totalSqft = parseFloat(data.roofSize) || 3000;
  const adjustedPricePerSqft = basePricePerSqft * steepnessFactor * regionFactor;
  const averagePrice = Math.round(totalSqft * adjustedPricePerSqft);
  
  // Material info based on selection
  const materialInfo = {
    'asphalt': {
      lifespan: '15-30 years',
      pros: ['Affordable', 'Widely available', 'Easy to install', 'Good variety of colors'],
      cons: ['Shorter lifespan than other materials', 'Less energy efficient', 'Can be damaged by extreme weather']
    },
    'metal': {
      lifespan: '40-70 years',
      pros: ['Long lifespan', 'Durable in extreme weather', 'Energy efficient', 'Recyclable'],
      cons: ['Higher upfront cost', 'Can be noisy during rain', 'May dent from hail']
    },
    'tile': {
      lifespan: '50+ years',
      pros: ['Extremely durable', 'Great aesthetic appeal', 'Excellent insulation', 'Fire resistant'],
      cons: ['Very heavy - may require structural reinforcement', 'Expensive', 'More complex installation']
    },
    'cedar': {
      lifespan: '20-35 years',
      pros: ['Natural beauty', 'Good insulation', 'Wind resistant', 'Environmentally friendly'],
      cons: ['Regular maintenance required', 'Susceptible to mold and insects', 'Fire hazard without treatment']
    }
  }[data.desiredRoofMaterial] || {
    lifespan: '20-40 years',
    pros: ['Good durability', 'Moderate cost', 'Readily available'],
    cons: ['May require regular maintenance', 'Performance varies by climate']
  };
  
  return {
    lowEstimate: Math.round(averagePrice * 0.85),
    estimate: averagePrice,
    highEstimate: Math.round(averagePrice * 1.15),
    pricePerSqft: Math.round(adjustedPricePerSqft * 10) / 10,
    estimateParts: [
      { name: "Removal & Disposal", cost: Math.round(averagePrice * 0.15) },
      { name: "Materials", cost: Math.round(averagePrice * 0.45) },
      { name: "Labor", cost: Math.round(averagePrice * 0.3) },
      { name: "Permits & Overhead", cost: Math.round(averagePrice * 0.1) }
    ],
    estimateFactors: [
      { factor: "Roof Size", impact: "High Impact", description: `Your ${totalSqft} sq ft roof is the primary cost factor` },
      { factor: "Roof Steepness", impact: steepnessFactor > 1.1 ? "High Impact" : "Medium Impact", description: `${data.roofSteepness} roof requires ${data.roofSteepness === 'steep' ? 'specialized equipment' : 'standard installation'}` },
      { factor: "Material", impact: "High Impact", description: `${data.desiredRoofMaterial} roofing affects cost and longevity` },
      { factor: "Location", impact: regionFactor !== 1.0 ? "Medium Impact" : "Low Impact", description: data.state ? `Regional costs in ${data.state} ${regionFactor > 1.0 ? 'increase' : 'decrease'} overall price` : 'National average pricing used' }
    ],
    materialInfo
  };
};

module.exports = {
  generateRoofEstimate
};
