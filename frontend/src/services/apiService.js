// src/services/apiService.js
import axios from 'axios';

// Get API URL from environment or default to empty string (relative URLs)
const API_URL = process.env.REACT_APP_API_URL || '';

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
    const response = await api.post('/api/maps/geocode', { address });
    return response.data;
  } catch (error) {
    console.error('Error getting coordinates');
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
    const response = await api.post('/api/maps/roof-size', { lat, lng });
    return response.data;
  } catch (error) {
    console.error('Error estimating roof size');
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
    const response = await api.post('/api/estimates/generate', formData);
    return response.data;
  } catch (error) {
    console.error('Error generating estimate');
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
    const response = await api.post('/api/estimates/submit', data);
    return response.data;
  } catch (error) {
    console.error('Error submitting estimate');
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
