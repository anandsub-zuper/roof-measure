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
    // Construct prompt for OpenAI with the updated national price guidance
    const prompt = `
      Generate a detailed roofing cost estimate with the following parameters:
      - Roof size: ${data.roofSize} square feet
      - Roof steepness: ${data.roofSteepness}
      - Desired material: ${data.desiredRoofMaterial}
      - Current material: ${data.currentRoofMaterial || 'Not specified'}
      - Building type: ${data.buildingType || 'Not specified'}
      - Location: ${data.city || ''}, ${data.state || ''}
      - Timeline: ${data.timeline || 'Not specified'}
      
      CRITICAL PRICING INSTRUCTIONS:
      - For standard asphalt shingles, the FINAL price MUST be between $7-$10 per square foot AFTER ALL ADJUSTMENTS.
      - For architectural asphalt shingles, the FINAL price MUST be between $8-$11 per square foot AFTER ALL ADJUSTMENTS.
      - For any asphalt shingle type, NEVER exceed $11 per square foot total, regardless of adjustments.
      - Apply adjustments MULTIPLICATIVELY, not additively (e.g., base × 1.15 × 1.1, not base + 15% + 10%)
      - Always use 3-tab standard shingles as the default asphalt type unless specifically requested
      - If the final price exceeds the maximum after adjustments, SCALE IT DOWN to meet the maximum limit
      
      STRICT NATIONAL PRICE GUIDANCE (Base prices that MUST be followed):
      
      ASPHALT SHINGLES (National average installed cost):
      - 3-tab standard: $5.50-$7.50 per sq ft
      - Architectural/dimensional: $7.00-$9.50 per sq ft
      - Premium designer: $8.00-$11.00 per sq ft
      
      METAL ROOFING (National average installed cost):
      - Standing seam: $10.00-$14.00 per sq ft
      - Metal shingles: $8.50-$12.00 per sq ft
      - Corrugated panels: $7.00-$10.00 per sq ft
      
      TILE ROOFING (National average installed cost):
      - Concrete tile: $12.00-$16.00 per sq ft
      - Clay tile: $15.00-$20.00 per sq ft
      
      CEDAR SHAKES (National average installed cost):
      - Cedar shingles: $9.00-$13.00 per sq ft
      - Cedar shakes: $11.00-$16.00 per sq ft
      
      REGIONAL ADJUSTMENT FACTORS (MUST be applied to base prices):
      - Northeast (ME, NH, VT, MA, RI, CT, NY, NJ, PA): +10%
      - Mid-Atlantic (DE, MD, DC, VA, WV): +5%
      - Southeast (NC, SC, GA, FL, AL, MS, TN, KY): -5%
      - Midwest (OH, IN, IL, MI, WI, MN, IA, MO): -3%
      - Great Plains (ND, SD, NE, KS, OK): -10%
      - Rocky Mountains (MT, ID, WY, CO, UT): +5%
      - Southwest (AZ, NM, TX, NV): -7%
      - West Coast (CA, OR, WA): +15%
      - Alaska & Hawaii: +25%
      
      NOTE: For asphalt shingles in West Coast regions, apply no more than +10% regional adjustment to keep within price limits.
      
      ROOF STEEPNESS FACTORS (MUST be applied after regional adjustment):
      - Flat: Multiply by 0.9 (10% reduction)
      - Low: Multiply by 1.0 (no change)
      - Moderate: Multiply by 1.1 (10% increase)
      - Steep: Multiply by 1.2 (20% increase MAXIMUM)
      
      COST BREAKDOWN (% of total):
      - Materials: 40%
      - Labor: 45%
      - Removal & Disposal: 8%
      - Permits & Overhead: 7%
      
      Additional modifiers:
      - Emergency timeline: +10%
      - ASAP timeline: +5%
      - Same material replacement: -3% (simplified removal)
      - Residential building: Standard pricing
      - Commercial building: +15%
      
      Calculate the final cost using this formula:
      Base Material Cost × Regional Factor × Steepness Factor × Timeline Factor = Final Price Per Sq Ft
      
      FINAL CHECK: For asphalt shingles, if your final price exceeds $11/sq ft, adjust it down to $10.99/sq ft.
      
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
      
      // Additional safety check to ensure asphalt shingle prices don't exceed limits
      if (data.desiredRoofMaterial === 'asphalt' && estimateData.pricePerSqft > 11) {
        logInfo('Adjusting excessive price down to maximum limit', {
          original: estimateData.pricePerSqft,
          adjusted: 10.99
        });
        
        const adjustmentFactor = 10.99 / estimateData.pricePerSqft;
        estimateData.pricePerSqft = 10.99;
        estimateData.estimate = Math.round(estimateData.estimate * adjustmentFactor);
        estimateData.lowEstimate = Math.round(estimateData.lowEstimate * adjustmentFactor);
        estimateData.highEstimate = Math.round(estimateData.highEstimate * adjustmentFactor);
        
        // Adjust all cost components as well
        if (estimateData.estimateParts && Array.isArray(estimateData.estimateParts)) {
          estimateData.estimateParts.forEach(part => {
            part.cost = Math.round(part.cost * adjustmentFactor);
          });
        }
      }
      
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
    'asphalt': 6.5,  // Reduced from original to match new guidelines
    'metal': 11.0,
    'tile': 14.0,
    'cedar': 11.0
  }[data.desiredRoofMaterial] || 6.5;
  
  // Regional adjustment based on state
  const regionFactor = (() => {
    if (!data.state) return 1.0;
    
    const state = data.state.toUpperCase();
    // West Coast (higher cost)
    if (['CA', 'OR', 'WA'].includes(state)) {
      // Apply a reduced West Coast factor for asphalt to keep within price cap
      return data.desiredRoofMaterial === 'asphalt' ? 1.1 : 1.15;
    }
    // Northeast
    if (['ME', 'NH', 'VT', 'MA', 'RI', 'CT', 'NY', 'NJ', 'PA'].includes(state)) return 1.1;
    // Mid-Atlantic
    if (['DE', 'MD', 'DC', 'VA', 'WV'].includes(state)) return 1.05;
    // Rocky Mountains
    if (['MT', 'ID', 'WY', 'CO', 'UT'].includes(state)) return 1.05;
    // Alaska & Hawaii
    if (['AK', 'HI'].includes(state)) return 1.25;
    // Southeast
    if (['NC', 'SC', 'GA', 'FL', 'AL', 'MS', 'TN', 'KY'].includes(state)) return 0.95;
    // Midwest
    if (['OH', 'IN', 'IL', 'MI', 'WI', 'MN', 'IA', 'MO'].includes(state)) return 0.97;
    // Great Plains
    if (['ND', 'SD', 'NE', 'KS', 'OK'].includes(state)) return 0.9;
    // Southwest
    if (['AZ', 'NM', 'TX', 'NV'].includes(state)) return 0.93;
    
    return 1.0;
  })();
  
  // Adjustment factors
  const steepnessFactor = {
    'flat': 0.9,
    'low': 1.0,
    'moderate': 1.1,
    // Cap steepness factor for asphalt to avoid exceeding price limits
    'steep': data.desiredRoofMaterial === 'asphalt' ? 1.2 : 1.25
  }[data.roofSteepness] || 1.0;
  
  // Timeline factor
  const timelineFactor = {
    'emergency': 1.1,
    'asap': 1.05,
    '1_3_months': 1.0,
    'planning': 0.98
  }[data.timeline] || 1.0;
  
  // Building type factor
  const buildingFactor = data.buildingType === 'commercial' ? 1.15 : 1.0;
  
  // Same material replacement discount
  const materialReplacementFactor = 
    data.currentRoofMaterial && data.currentRoofMaterial === data.desiredRoofMaterial 
      ? 0.97 
      : 1.0;
  
  // Calculate estimate
  const totalSqft = parseFloat(data.roofSize) || 3000;
  let adjustedPricePerSqft = basePricePerSqft * regionFactor * steepnessFactor * timelineFactor * buildingFactor * materialReplacementFactor;
  
  // Apply price cap for asphalt shingles
  if (data.desiredRoofMaterial === 'asphalt' && adjustedPricePerSqft > 10.99) {
    logInfo('Capping asphalt price in simulated estimate', {
      original: adjustedPricePerSqft,
      capped: 10.99
    });
    adjustedPricePerSqft = 10.99;
  }
  
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
  
  // Generate estimate factors
  const estimateFactors = [];
  
  // Add roof size factor
  estimateFactors.push({
    factor: "Roof Size",
    impact: "High Impact",
    description: `Your ${totalSqft} sq ft roof is the primary cost factor`
  });
  
  // Add steepness factor if significant
  if (data.roofSteepness === 'steep') {
    estimateFactors.push({
      factor: "Roof Steepness",
      impact: "High Impact",
      description: "Steep roofs require more safety measures and time, increasing labor costs."
    });
  } else if (data.roofSteepness === 'moderate') {
    estimateFactors.push({
      factor: "Roof Steepness",
      impact: "Moderate Impact",
      description: "Moderate slope requires additional care during installation."
    });
  }
  
  // Add regional factor
  if (regionFactor !== 1.0) {
    const regionImpact = regionFactor > 1.1 ? "High Impact" : "Moderate Impact";
    estimateFactors.push({
      factor: "Regional Adjustment",
      impact: regionImpact,
      description: data.state ? `${data.city || ''} ${data.state} region ${regionFactor > 1.0 ? 'increases' : 'decreases'} costs by ${Math.abs(Math.round((regionFactor - 1) * 100))}%` : 'National average pricing used'
    });
  }
  
  // Add material factor
  estimateFactors.push({
    factor: "Material Choice",
    impact: "Moderate Impact",
    description: `${data.desiredRoofMaterial.charAt(0).toUpperCase() + data.desiredRoofMaterial.slice(1)} impacts overall cost and longevity`
  });
  
  // Add timeline factor if significant
  if (data.timeline === 'emergency' || data.timeline === 'asap') {
    estimateFactors.push({
      factor: "Timeline",
      impact: data.timeline === 'emergency' ? "High Impact" : "Moderate Impact",
      description: `${data.timeline === 'emergency' ? 'Emergency' : 'ASAP'} timeline requires priority scheduling, adding to costs`
    });
  }
  
  // Material match factor if applicable
  if (data.currentRoofMaterial && data.currentRoofMaterial === data.desiredRoofMaterial) {
    estimateFactors.push({
      factor: "Material Match",
      impact: "Neutral",
      description: "The current material is asphalt, which simplifies installation and disposal."
    });
  }
  
  // Calculate cost breakdown parts
  const materialCost = Math.round(averagePrice * 0.40);
  const laborCost = Math.round(averagePrice * 0.45);
  const removalCost = Math.round(averagePrice * 0.08);
  const permitsCost = Math.round(averagePrice * 0.07);
  
  return {
    lowEstimate: Math.round(averagePrice * 0.9),
    estimate: averagePrice,
    highEstimate: Math.round(averagePrice * 1.1),
    pricePerSqft: Math.round(adjustedPricePerSqft * 10) / 10,
    estimateParts: [
      { name: "Materials", cost: materialCost },
      { name: "Labor", cost: laborCost },
      { name: "Removal & Disposal", cost: removalCost },
      { name: "Permits & Overhead", cost: permitsCost }
    ],
    estimateFactors: estimateFactors,
    materialInfo: materialInfo
  };
};

module.exports = {
  generateRoofEstimate
};
