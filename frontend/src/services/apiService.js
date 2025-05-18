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
 * Get coordinates from an address (geocoding)
 * @param {string} address - The address to geocode
 * @returns {Promise} - Resolves with coordinates and address data
 */
export const getAddressCoordinates = async (address) => {
  try {
    console.log("Geocoding address:", address);
    const response = await api.post('/api/maps/geocode', { address });
    console.log("Raw geocoding response:", response.data);
    
    // Check if the response has the success property
    if (response.data && response.data.success === false) {
      throw new Error(response.data.message || "Geocoding failed");
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
    console.log("Getting roof size for coordinates:", { lat, lng });
    const response = await api.post('/api/maps/roof-size', { lat, lng });
    console.log("Raw roof size response:", response.data);
    
    // Check if the response has the success property
    if (response.data && response.data.success === false) {
      throw new Error(response.data.message || "Roof size estimation failed");
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
  submitEstimate
};

export default apiService;
