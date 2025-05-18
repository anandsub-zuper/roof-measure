// src/services/apiService.js
import axios from 'axios';
import config from '../config';

// Feature flags for endpoints
const API_FEATURE_FLAGS = {
  VISION_API_ENABLED: true,   // Set to true now that we've added the endpoint
  METRICS_LOGGING_ENABLED: true  // Set to true now that we've added the endpoint
};

// Get API URL from environment or default to relative URL
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

// Add request interceptor for timing metrics
api.interceptors.request.use(config => {
  config.metadata = { startTime: new Date().getTime() };
  return config;
}, error => {
  return Promise.reject(error);
});

// Add response interceptor for consistent error handling and metrics
api.interceptors.response.use(
  response => {
    // Calculate request duration for metrics
    const endTime = new Date().getTime();
    const duration = endTime - response.config.metadata.startTime;
    
    // Log timing metrics for significant requests
    if (duration > 500 && API_FEATURE_FLAGS.METRICS_LOGGING_ENABLED) {
      safelyLogMetrics('api_timing', {
        endpoint: response.config.url,
        duration,
        status: response.status
      });
    }
    
    return response;
  },
  error => {
    // Log the error with useful information
    if (error.response) {
      console.error(`API Error (${error.response.status}):`, error.response.data);
      
      // Log 404 errors to metrics to track missing endpoints
      if (error.response.status === 404 && API_FEATURE_FLAGS.METRICS_LOGGING_ENABLED) {
        safelyLogMetrics('missing_endpoint', {
          endpoint: error.config.url,
          method: error.config.method
        });
      }
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
 * Safely log metrics without crashing if endpoint is missing
 * @param {string} type - Metric type
 * @param {Object} data - Metric data
 */
export const safelyLogMetrics = (type, data) => {
  // Always log to console
  console.log(`METRICS [${type}]:`, data);
  
  // Only try API call if enabled
  if (API_FEATURE_FLAGS.METRICS_LOGGING_ENABLED) {
    try {
      api.post('/api/metrics/log', {
        type,
        ...data,
        timestamp: new Date().toISOString()
      }).catch(err => {
        // Silently handle 404s - endpoint might still be deploying
        if (err.response && err.response.status !== 404) {
          console.warn("Metrics logging failed:", err.message);
        }
      });
    } catch (e) {
      // Silently fail - metrics should never affect UX
    }
  }
};

/**
 * Log measurement discrepancy between backend and frontend
 * @param {number} backendSize - Size from backend calculation
 * @param {number} frontendSize - Size from frontend calculation
 * @param {string} address - Property address
 */
export const logMeasurementDiscrepancy = (backendSize, frontendSize, address) => {
  if (!backendSize || !frontendSize || !address) return;
  
  const ratio = frontendSize / backendSize;
  const discrepancy = Math.abs(frontendSize - backendSize);
  const percentDiff = Math.abs((frontendSize - backendSize) / backendSize) * 100;
  
  // Log to console for debugging
  console.log(`Measurement discrepancy: ${percentDiff.toFixed(1)}% (${discrepancy} sq ft)`);
  console.log(`Backend: ${backendSize} sq ft, Frontend: ${frontendSize} sq ft, Ratio: ${ratio.toFixed(2)}`);
  
  // Only include street number for privacy
  const anonymizedAddress = address.split(',')[0].trim();
  
  // Log to backend
  safelyLogMetrics('measurement_discrepancy', {
    backendSize,
    frontendSize,
    ratio,
    percentDiff,
    address: anonymizedAddress
  });
  
  // Add to local storage for monitoring large discrepancies
  if (percentDiff > 25) {
    console.warn(`Large measurement discrepancy detected: ${percentDiff.toFixed(1)}%`);
    
    try {
      const discrepancies = JSON.parse(localStorage.getItem('roofai_discrepancies') || '[]');
      discrepancies.push({
        backendSize,
        frontendSize,
        ratio,
        percentDiff,
        address: anonymizedAddress,
        timestamp: new Date().toISOString()
      });
      
      // Keep only the last 50 entries
      if (discrepancies.length > 50) {
        discrepancies.shift();
      }
      
      localStorage.setItem('roofai_discrepancies', JSON.stringify(discrepancies));
    } catch (e) {
      // Ignore storage errors
    }
  }
};

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
 * UPDATED: Now attempts OpenAI Vision analysis first before falling back
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
    
    // Add property data if available for better estimation
    if (propertyData) {
      requestData.propertyData = {
        propertyType: propertyData.propertyType,
        buildingSize: propertyData.buildingSize,
        stories: propertyData.stories,
        yearBuilt: propertyData.yearBuilt,
        roofType: propertyData.roofType
      };
    }
    
    // Attempt OpenAI Vision analysis first if enabled
    if (API_FEATURE_FLAGS.VISION_API_ENABLED) {
      try {
        console.log("Attempting OpenAI Vision roof analysis");
        const visionResponse = await api.post('/api/roof/analyze', requestData);
        console.log("OpenAI Vision response:", visionResponse.data);
        
        if (visionResponse.data && visionResponse.data.success) {
          console.log("OpenAI Vision analysis successful");
          
          // Extract the result - handle both direct and recommended formats
          const visionResult = visionResponse.data.data?.recommended || visionResponse.data.data;
          
          // Format and normalize response
          const formattedResult = {
            success: true,
            size: visionResult.roofArea,
            roofPolygon: visionResult.roofPolygon,
            accuracy: visionResult.confidence,
            method: visionResult.method || "openai_vision",
            roofShape: visionResult.roofShape,
            roofPitch: visionResult.estimatedPitch,
            roofAnalysisMethod: visionResult.method,
            roofAnalysisNotes: visionResult.notes
          };
          
          // Cache the result
          if (!addressCache[coordKey]) addressCache[coordKey] = {};
          addressCache[coordKey].roofSize = formattedResult;
          
          return formattedResult;
        }
      } catch (visionError) {
        // Only log the error, don't rethrow - we'll try the backup method
        console.warn("Vision analysis failed, falling back to basic estimation:", visionError.message);
      }
    } else {
      console.log("Vision API disabled, using basic estimation");
    }
    
    // Fallback to basic roof size estimation
    console.log("Using basic roof size estimation");
    const response = await api.post('/api/maps/roof-size', requestData);
    console.log("Basic roof size response:", response.data);
    
    // Check if the response has the success property
    if (response.data && response.data.success === false) {
      throw new Error(response.data.message || "Roof size estimation failed");
    }
    
    // Format the response for consistency
    const basicResult = {
      success: true,
      size: response.data.size,
      roofPolygon: response.data.roofPolygon,
      accuracy: response.data.accuracy,
      method: response.data.method,
      roofAnalysisMethod: "basic_estimation"
    };
    
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
    
    // Check for recommended result
    if (response.data.data?.recommended) {
      console.log("Using recommended analysis method:", response.data.data.recommended.method);
      return formatAnalysisResult(response.data.data.recommended);
    }
    
    // Otherwise use the direct result
    const result = formatAnalysisResult(response.data.data);
    
    // Cache the result
    addressCache[coordKey] = result;
    
    return result;
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

// Helper to format analysis result consistently
const formatAnalysisResult = (result) => {
  return {
    success: true,
    size: result.roofArea,
    roofPolygon: result.roofPolygon,
    confidence: result.confidence,
    roofShape: result.roofShape,
    estimatedPitch: result.estimatedPitch,
    method: result.method,
    notes: result.notes
  };
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
        propertyType: formData.propertyData.propertyType,
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
        propertyType: data.propertyData.propertyType,
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

/**
 * Get stored measurement discrepancies (for debugging)
 * @returns {Array} - Array of discrepancy objects
 */
export const getStoredDiscrepancies = () => {
  try {
    return JSON.parse(localStorage.getItem('roofai_discrepancies') || '[]');
  } catch (e) {
    return [];
  }
};

/**
 * Clear stored discrepancies
 */
export const clearStoredDiscrepancies = () => {
  localStorage.removeItem('roofai_discrepancies');
};

// Make the functions globally accessible for debugging in development
if (process.env.NODE_ENV === 'development') {
  window.roofAIApi = {
    clearAddressCache,
    getStoredDiscrepancies,
    clearStoredDiscrepancies,
    API_FEATURE_FLAGS
  };
}

// Export the service functions
const apiService = {
  testApiConnection,
  getAddressCoordinates,
  getRoofSizeEstimate,
  analyzeRoof,
  generateRoofEstimate,
  submitEstimate,
  clearAddressCache,
  getStoredDiscrepancies,
  clearStoredDiscrepancies,
  logMeasurementDiscrepancy
};

export default apiService;
