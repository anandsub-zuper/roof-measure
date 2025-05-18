// src/services/apiService.js
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

// Debug: Log all API URLs
console.log("API URL configuration:", {
  baseURL: API_URL,
  geocodeEndpoint: `${API_URL}/api/maps/geocode`,
  roofSizeEndpoint: `${API_URL}/api/maps/roof-size`,
  estimateEndpoint: `${API_URL}/api/estimates/generate`
});

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
 * Check cache for address data and return cached values if available
 * @param {string} address - The address to check cache for
 * @returns {Object|null} - Cached data or null if not found
 */
export const getAddressCache = (address) => {
  if (!address) return null;
  
  try {
    const addressKey = address.replace(/[^a-zA-Z0-9]/g, '_');
    
    // Check if we have cached data for this address
    const cachedLat = localStorage.getItem(`lat_${addressKey}`);
    const cachedLng = localStorage.getItem(`lng_${addressKey}`);
    const cachedRoofSize = localStorage.getItem(`roofSize_${addressKey}`);
    const cachedRoofPolygon = localStorage.getItem(`roofPolygon_${addressKey}`);
    
    if (cachedLat && cachedLng && cachedRoofSize) {
      console.log("Found cached address data:", {
        address,
        lat: cachedLat,
        lng: cachedLng,
        roofSize: cachedRoofSize
      });
      
      return {
        lat: parseFloat(cachedLat),
        lng: parseFloat(cachedLng),
        roofSize: parseInt(cachedRoofSize, 10),
        roofPolygon: cachedRoofPolygon ? JSON.parse(cachedRoofPolygon) : null
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error reading address cache:", error);
    return null;
  }
};

/**
 * Save address data to cache
 * @param {string} address - The address
 * @param {Object} data - The data to cache
 */
export const saveAddressCache = (address, data) => {
  if (!address || !data) return;
  
  try {
    const addressKey = address.replace(/[^a-zA-Z0-9]/g, '_');
    
    if (data.lat) localStorage.setItem(`lat_${addressKey}`, data.lat.toString());
    if (data.lng) localStorage.setItem(`lng_${addressKey}`, data.lng.toString());
    if (data.roofSize) localStorage.setItem(`roofSize_${addressKey}`, data.roofSize.toString());
    if (data.roofPolygon) localStorage.setItem(`roofPolygon_${addressKey}`, JSON.stringify(data.roofPolygon));
    
    console.log("Saved address data to cache:", { address, data });
  } catch (error) {
    console.error("Error saving address to cache:", error);
  }
};

/**
 * Get coordinates from an address (geocoding)
 * @param {string} address - The address to geocode
 * @returns {Promise} - Resolves with coordinates and address data
 */
export const getAddressCoordinates = async (address) => {
  try {
    // First check if we have cached data
    const cachedData = getAddressCache(address);
    if (cachedData && cachedData.lat && cachedData.lng) {
      console.log("Using cached coordinates for address:", address);
      return {
        lat: cachedData.lat,
        lng: cachedData.lng,
        success: true
      };
    }
    
    console.log("Geocoding address:", address);
    const response = await api.post('/api/maps/geocode', { address });
    console.log("Raw geocoding response:", response.data);
    
    // Check if the response has the success property
    if (response.data && response.data.success === false) {
      throw new Error(response.data.message || "Geocoding failed");
    }
    
    // Save results to cache
    const data = response.data || response;
    if (data.lat && data.lng) {
      saveAddressCache(address, {
        lat: data.lat,
        lng: data.lng
      });
    }
    
    return response.data;
  } catch (error) {
    console.error('Error getting coordinates:', error);
    throw error;
  }
};

/**
 * Get roof size estimate based on coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise} - Resolves with roof size data
 */
export const getRoofSizeEstimate = async (lat, lng) => {
  try {
    // Check for cached roof size using coordinates as key
    const coordKey = `${lat.toFixed(6)}_${lng.toFixed(6)}`;
    const cachedSize = localStorage.getItem(`roofSize_coord_${coordKey}`);
    const cachedPolygon = localStorage.getItem(`roofPolygon_coord_${coordKey}`);
    
    if (cachedSize) {
      console.log("Using cached roof size for coordinates:", { lat, lng });
      return {
        size: parseInt(cachedSize, 10),
        roofPolygon: cachedPolygon ? JSON.parse(cachedPolygon) : null,
        success: true
      };
    }
    
    console.log("Getting roof size for coordinates:", { lat, lng });
    const response = await api.post('/api/maps/roof-size', { lat, lng });
    console.log("Raw roof size response:", response.data);
    
    // Check if the response has the success property
    if (response.data && response.data.success === false) {
      throw new Error(response.data.message || "Roof size estimation failed");
    }
    
    // Cache the result
    const data = response.data || response;
    if (data.size) {
      localStorage.setItem(`roofSize_coord_${coordKey}`, data.size.toString());
      
      if (data.roofPolygon) {
        localStorage.setItem(`roofPolygon_coord_${coordKey}`, JSON.stringify(data.roofPolygon));
      }
    }
    
    return response.data;
  } catch (error) {
    console.error('Error estimating roof size:', error);
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
    const response = await api.post('/api/estimates/generate', formData);
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
    const response = await api.post('/api/estimates/submit', data);
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

// Export the service functions
const apiService = {
  testApiConnection,
  getAddressCoordinates,
  getRoofSizeEstimate,
  generateRoofEstimate,
  submitEstimate,
  getAddressCache,
  saveAddressCache
};

export default apiService;
