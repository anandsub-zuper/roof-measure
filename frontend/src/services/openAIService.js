// frontend/src/services/openAIService.js - Updated with your actual API paths

/**
 * Client-side service for OpenAI-related functionality
 * This makes API calls to your backend, which then uses OpenAI
 */
import axios from 'axios';

/**
 * Generate a roof estimate based on form data
 * @param {Object} formData - The form data from the estimate steps
 * @returns {Promise} - Resolves with estimate data
 */
export const generateEstimate = async (formData) => {
  try {
    // Call our backend API, not OpenAI directly
    // This might need adjustment based on your actual endpoint
    const response = await axios.post('/api/estimate', formData);
    return response.data;
  } catch (error) {
    console.error('Error generating estimate:', error);
    throw error;
  }
};

/**
 * Analyze roof image to detect roof boundaries
 * @param {string} address - The address for the roof
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<Object>} - Resolves with roof data including size and polygon
 */
export const analyzeRoof = async (address, lat, lng) => {
  try {
    // Use your actual roof-size endpoint
    const response = await axios.post('/api/maps/roof-size', {
      address,
      lat, 
      lng
    });
    
    return response.data;
  } catch (error) {
    console.error('Error analyzing roof:', error);
    // Return null to trigger fallback mechanisms
    return null;
  }
};

/**
 * Get a completion or answer to a specific roofing question
 * @param {string} question - The question to ask
 * @returns {Promise} - Resolves with answer data
 */
export const askRoofingQuestion = async (question) => {
  try {
    // This might need adjustment based on your actual endpoint
    const response = await axios.post('/api/ask', { question });
    return response.data;
  } catch (error) {
    console.error('Error asking question:', error);
    throw error;
  }
};

export default {
  generateEstimate,
  askRoofingQuestion,
  analyzeRoof
};
