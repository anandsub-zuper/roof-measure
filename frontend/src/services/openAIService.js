// frontend/src/services/openAIService.js

/**
 * Client-side service for OpenAI-related functionality
 * This makes API calls to your backend, which then uses OpenAI
 */

import apiService from './apiService';

/**
 * Generate a roof estimate based on form data
 * @param {Object} formData - The form data from the estimate steps
 * @returns {Promise} - Resolves with estimate data
 */
export const generateEstimate = async (formData) => {
  try {
    // Call our backend API, not OpenAI directly
    const response = await apiService.generateRoofEstimate(formData);
    return response.data;
  } catch (error) {
    console.error('Error generating estimate:', error);
    throw error;
  }
};

/**
 * Get a completion or answer to a specific roofing question
 * @param {string} question - The question to ask
 * @returns {Promise} - Resolves with answer data
 */
export const askRoofingQuestion = async (question) => {
  try {
    // This would call a backend endpoint that uses OpenAI
    // Example implementation - update to match your backend API
    const response = await apiService.post('/api/ask', { question });
    return response.data;
  } catch (error) {
    console.error('Error asking question:', error);
    throw error;
  }
};

export default {
  generateEstimate,
  askRoofingQuestion
};
