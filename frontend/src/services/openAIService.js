// frontend/src/services/openAIService.js - Fix for post method error

/**
 * Client-side service for OpenAI-related functionality
 * This makes API calls to your backend, which then uses OpenAI
 */
import axios from 'axios'; // Direct import axios instead of relying on apiService

/**
 * Generate a roof estimate based on form data
 * @param {Object} formData - The form data from the estimate steps
 * @returns {Promise} - Resolves with estimate data
 */
export const generateEstimate = async (formData) => {
  try {
    // Call your existing endpoint
    const response = await axios.post('/api/estimate', formData);
    return response.data;
  } catch (error) {
    console.error('Error generating estimate:', error);
    throw error;
  }
};

/**
 * Analyze roof image to detect roof boundaries using OpenAI Vision
 * @param {string} imageBase64 - Base64 encoded image of the roof from satellite view
 * @returns {Promise<Array>} - Resolves with array of coordinates forming the roof polygon
 */
export const analyzeRoofImage = async (imageBase64) => {
  try {
    // Direct axios call instead of using apiService
    const response = await axios.post('/api/analyze-roof', {
      image: imageBase64
    });
    
    // Return the coordinates from the response
    return response.data.coordinates;
  } catch (error) {
    console.error('Error analyzing roof image:', error);
    // Return null instead of throwing to avoid breaking the application
    // This will trigger the fallback method
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
    // Direct axios call
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
  analyzeRoofImage
};
