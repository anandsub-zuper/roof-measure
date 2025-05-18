// src/services/apiService.js - Updated getRoofSizeEstimate function
import axios from 'axios';

// Get API URL from environment or default to empty string (relative URLs)
const API_URL = process.env.REACT_APP_API_URL || 
  (window.location.hostname === 'localhost' 
    ? 'http://localhost:5000' 
    : '/api'); // Better fallback to relative path

console.log("API URL configured as:", API_URL);

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 15000 // 15 second timeout
});

// Add response interceptor for consistent error handling
api.interceptors.response.use(
  response => response,
  error => {
    // Log the error with useful information
    if (error.response) {
      console.error(`API Error (${error.response.status}):`, error.response.data);
    } else if (error.request) {
      console.error('API Error: No response received', error.request);
    } else {
      console.error('API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// In-memory cache for address data
const addressCache = {};

/**
 * Test the API connection
 * @returns {Promise} - Resolves with API status
 */
export const testApiConnection = async () => {
  try {
    const response = await api.get('/');
    return response.data;
  } catch (error) {
    console.error('API connection test failed');
    throw error;
  }
};

/**
 * Get coordinates from an address (geocoding)
 * @param {string} address - The address to geocode
 * @param {Object} propertyData - Optional property data from Rentcast
 * @returns {Promise} - Resolves with coordinates and address data
 */
export const getAddressCoordinates = async (address, propertyData = null) => {
  try {
    // Check cache first
    const cacheKey = address.replace(/\s+/g, '_').toLowerCase();
    if (addressCache[cacheKey]?.coordinates) {
      console.log("Using cached coordinates for address:", address);
      return addressCache[cacheKey].coordinates;
    }
    
    console.log("Geocoding address:", address);
    
    // If propertyData includes coordinates, use them instead of API call
    if (propertyData && propertyData.latitude && propertyData.longitude) {
      console.log("Using coordinates from property data");
      const coordinateData = {
        lat: propertyData.latitude,
        lng: propertyData.longitude,
        success: true
      };
      
      // Save to cache
      if (!addressCache[cacheKey]) addressCache[cacheKey] = {};
      addressCache[cacheKey].coordinates = coordinateData;
      
      return coordinateData;
    }
    
    // Call the geocoding API
    const response = await api.post('/api/maps/geocode', { address });
    console.log("Raw geocoding response:", response.data);
    
    // Check if the response has the success property
    if (response.data && response.data.success === false) {
      throw new Error(response.data.message || "Geocoding failed");
    }
    
    // Save results to cache
    if (!addressCache[cacheKey]) addressCache[cacheKey] = {};
    addressCache[cacheKey].coordinates = response.data;
    
    return response.data;
  } catch (error) {
    console.error('Error getting coordinates:', error);
    throw error;
  }
};

/**
 * Get roof size estimate based on coordinates
 * FIXED: Now tries OpenAI Vision first before falling back to basic estimation
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Object} propertyData - Optional property data for better estimation
 * @returns {Promise} - Resolves with roof size data
 */
export const getRoofSizeEstimate = async (lat, lng, propertyData = null) => {
  try {
    // Generate a cache key for this coordinate pair
    const coordKey = `${lat.toFixed(6)}_${lng.toFixed(6)}`;
    
    // Check cache for coordinate-based lookup
    if (addressCache[coordKey]?.roofSize) {
      console.log("Using cached roof size for coordinates:", { lat, lng });
      return addressCache[coordKey].roofSize;
    }
    
    console.log("Getting roof size for coordinates:", { lat, lng });
    
    // Prepare request data
    const requestData = { lat, lng };
    
    // Add property data if available for better backend estimation
    if (propertyData) {
      requestData.propertyData = {
        propertyType: propertyData.propertyType,
        buildingSize: propertyData.buildingSize,
        stories: propertyData.stories,
        yearBuilt: propertyData.yearBuilt,
        roofType: propertyData.roofType
      };
    }
    
    // FIXED: First try to use OpenAI Vision analysis for better accuracy
    try {
      console.log("Attempting OpenAI Vision roof analysis");
      const visionResponse = await api.post('/api/roof/analyze', requestData);
      console.log("OpenAI Vision response:", visionResponse.data);
      
      if (visionResponse.data && visionResponse.data.success) {
        console.log("OpenAI Vision analysis successful");
        
        // Add method info to be displayed to the user
        const visionResult = visionResponse.data.data || visionResponse.data;
        visionResult.roofAnalysisMethod = "openai_vision";
        
        // Store roof shape and pitch for UI display
        visionResult.roofShape = visionResult.roofShape || "unknown";
        visionResult.roofPitch = visionResult.estimatedPitch || "unknown";
        
        // Convert size field name if needed
        if (visionResult.roofArea && !visionResult.size) {
          visionResult.size = visionResult.roofArea;
        }
        
        // Cache the result
        if (!addressCache[coordKey]) addressCache[coordKey] = {};
        addressCache[coordKey].roofSize = visionResult;
        
        return visionResult;
      }
    } catch (visionError) {
      console.warn("Vision analysis failed, falling back to basic estimation:", visionError.message);
    }
    
    // Fallback to simple estimation if Vision API fails
    console.log("Using basic roof size estimation");
    const response = await api.post('/api/maps/roof-size', requestData);
    console.log("Basic roof size response:", response.data);
    
    // Check if the response has the success property
    if (response.data && response.data.success === false) {
      throw new Error(response.data.message || "Roof size estimation failed");
    }
    
    // Add method info to result
    const basicResult = response.data;
    basicResult.roofAnalysisMethod = "basic_estimation";
    
    // Cache the result
    if (!addressCache[coordKey]) addressCache[coordKey] = {};
    addressCache[coordKey].roofSize = basicResult;
    
    return basicResult;
  } catch (error) {
    console.error('Error estimating roof size:', error);
    throw error;
  }
};

/**
 * Analyze roof using OpenAI Vision
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Object} propertyData - Property data for cross-validation
 * @returns {Promise} - Resolves with roof analysis data
 */
export const analyzeRoof = async (lat, lng, propertyData = null) => {
  try {
    console.log("Analyzing roof with OpenAI Vision:", { lat, lng });
    
    // Generate a cache key for this coordinate pair
    const coordKey = `analysis_${lat.toFixed(6)}_${lng.toFixed(6)}`;
    
    // Check cache for previous analysis
    if (addressCache[coordKey]) {
      console.log("Using cached roof analysis for coordinates:", { lat, lng });
      return addressCache[coordKey];
    }
    
    // Prepare request data with property information
    const requestData = { 
      lat, 
      lng,
      propertyData: propertyData ? {
        propertyType: propertyData.propertyType,
        buildingSize: propertyData.buildingSize,
        stories: propertyData.stories,
        yearBuilt: propertyData.yearBuilt,
        roofType: propertyData.roofType
      } : null
    };
    
    // Make API request to the roof analysis endpoint
    const response = await api.post('/api/roof/analyze', requestData);
    console.log("Roof analysis response:", response.data);
    
    // Extract the recommended result or use the directly returned data
    const result = response.data.data?.recommended || response.data.data || response.data;
    
    // Format the response
    const analysisResult = {
      success: true,
      size: result.roofArea || result.size,
      roofPolygon: result.roofPolygon,
      confidence: result.confidence,
      roofShape: result.roofShape,
      estimatedPitch: result.estimatedPitch,
      method: result.method,
      notes: result.notes
    };
    
    // Cache the result
    addressCache[coordKey] = analysisResult;
    
    return analysisResult;
  } catch (error) {
    console.error('Error analyzing roof:', error);
    
    // If analysis fails, try to return a fallback calculation from property data
    if (propertyData && propertyData.buildingSize) {
      console.log("Falling back to property-based roof size calculation");
      
      const stories = propertyData.stories || 1;
      const footprint = propertyData.buildingSize / stories;
      
      // Adjust for roof pitch based on property type
      let pitchFactor = 1.3; // Default moderate pitch
      
      if (propertyData.propertyType) {
        const type = propertyData.propertyType.toLowerCase();
        if (type.includes('flat') || type.includes('condo')) {
          pitchFactor = 1.1; // Flatter roofs
        } else if (type.includes('single') && type.includes('family')) {
          pitchFactor = 1.4; // Typically more pitched
        }
      }
      
      const roofSize = Math.round(footprint * pitchFactor);
      
      return {
        success: true,
        size: roofSize,
        roofPolygon: null, // No polygon available in fallback
        confidence: "medium",
        roofShape: "simple", // Assume simple in fallback
        estimatedPitch: "moderate", // Assume moderate in fallback
        method: "property_data_fallback",
        notes: "Calculated from property data after vision analysis failed."
      };
    }
    
    // If no property data, re-throw the error
    throw error;
  }
};

/**
 * Generate a roof estimate based on form data
 * @param {Object} formData - The form data from all steps
 * @returns {Promise} - Resolves with estimate data
 */
export const generateRoofEstimate = async (formData) => {
  try {
    console.log("Generating estimate with data:", formData);
    
    // Create a copy of formData to avoid modifying the original
    const requestData = { ...formData };
    
    // If we have propertyData from Rentcast, include it
    if (formData.propertyData) {
      // Include only relevant property data fields to reduce payload size
      requestData.propertyData = {
        buildingType: formData.propertyData.propertyType,
        buildingSize: formData.propertyData.buildingSize,
        stories: formData.propertyData.stories,
        yearBuilt: formData.propertyData.yearBuilt,
        roofType: formData.propertyData.roofType
      };
    }
    
    const response = await api.post('/api/estimates/generate', requestData);
    console.log("Raw estimate response:", response.data);
    
    // Check if the response has the success property
    if (response.data && response.data.success === false) {
      throw new Error(response.data.message || "Estimate generation failed");
    }
    
    return response.data;
  } catch (error) {
    console.error('Error generating estimate:', error);
    throw error;
  }
};

/**
 * Submit final estimate with user contact information
 * @param {Object} data - Form data with contact info and estimate results
 * @returns {Promise} - Resolves with submission confirmation
 */
export const submitEstimate = async (data) => {
  try {
    console.log("Submitting estimate with contact info:", {
      name: data.name,
      email: data.email,
      phone: data.phone
    });
    
    // Create a copy of data to avoid modifying the original
    const requestData = { ...data };
    
    // Include property data if available
    if (data.propertyData) {
      requestData.propertyData = {
        buildingType: data.propertyData.propertyType,
        buildingSize: data.propertyData.buildingSize,
        stories: data.propertyData.stories,
        yearBuilt: data.propertyData.yearBuilt,
        roofType: data.propertyData.roofType
      };
    }
    
    const response = await api.post('/api/estimates/submit', requestData);
    console.log("Raw submission response:", response.data);
    
    // Check if the response has the success property
    if (response.data && response.data.success === false) {
      throw new Error(response.data.message || "Estimate submission failed");
    }
    
    return response.data;
  } catch (error) {
    console.error('Error submitting estimate:', error);
    throw error;
  }
};

/**
 * Clear the address cache
 */
export const clearAddressCache = () => {
  Object.keys(addressCache).forEach(key => {
    delete addressCache[key];
  });
  console.log("Address cache cleared");
};

// Export the service functions
const apiService = {
  testApiConnection,
  getAddressCoordinates,
  getRoofSizeEstimate,
  analyzeRoof,
  generateRoofEstimate,
  submitEstimate,
  clearAddressCache
};

export default apiService;
