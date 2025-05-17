const axios = require('axios');

// OpenAI API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4-turbo';

// Generate roof estimate
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
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: "You are an expert roofing contractor with detailed knowledge of costs and material requirements." },
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 1500
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Extract the JSON response
    const content = response.data.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const estimateData = JSON.parse(jsonMatch[0]);
      return estimateData;
    }
    
    // Fallback to simulated estimate if parsing fails
    return generateSimulatedEstimate(data);
  } catch (error) {
    console.error('OpenAI error:', error);
    // Fallback to simulated estimate on API error
    return generateSimulatedEstimate(data);
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
  generateRoofEstimate
};
