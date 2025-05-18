// src/services/apiService.js
import axios from 'axios';

// Get API URL from environment variables (set in Netlify)
const API_URL = process.env.REACT_APP_API_URL;

// For debugging - remove in production
console.log('API URL being used:', API_URL);

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Get coordinates from an address (geocoding)
 * @param {string} address - The address to geocode
 * @returns {Promise} - Resolves with coordinates and address data
 */
export const getAddressCoordinates = async (address) => {
  try {
    console.log('Geocoding address:', address);
    const response = await api.post('/api/maps/geocode', { address });
    console.log('Geocoding response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting coordinates:', error);
    // Provide more detailed error logging
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Error response:', error.response.data);
      console.error('Error status:', error.response.status);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Error request:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error message:', error.message);
    }
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
    console.log('Getting roof size for coordinates:', lat, lng);
    const response = await api.post('/api/maps/roof-size', { lat, lng });
    console.log('Roof size response:', response.data);
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
    console.log('Generating estimate with data:', formData);
    const response = await api.post('/api/estimates/generate', formData);
    console.log('Estimate response:', response.data);
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
    console.log('Submitting estimate with contact info');
    const response = await api.post('/api/estimates/submit', data);
    console.log('Submission response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error submitting estimate:', error);
    throw error;
  }
};

/**
 * Test the API connection
 * @returns {Promise} - Resolves with API status
 */
export const testApiConnection = async () => {
  try {
    const response = await api.get('/');
    console.log('API connection test:', response.data);
    return response.data;
  } catch (error) {
    console.error('API connection test failed:', error);
    throw error;
  }
};

// Fix for ESLint "import/no-anonymous-default-export" warning
// Assign the object to a variable before exporting as default
const apiService = {
  getAddressCoordinates,
  getRoofSizeEstimate,
  generateRoofEstimate,
  submitEstimate,
  testApiConnection
};

export default apiService;
