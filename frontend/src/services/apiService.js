import axios from 'axios';

// Get API URL from environment variables (set in Netlify)
const API_URL = process.env.REACT_APP_API_URL;

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Address validation and coordinates
export const getAddressCoordinates = async (address) => {
  try {
    const response = await api.post('/api/maps/geocode', { address });
    return response.data;
  } catch (error) {
    console.error('Error getting coordinates:', error);
    throw error;
  }
};

// Roof size estimation
export const getRoofSizeEstimate = async (lat, lng) => {
  try {
    const response = await api.post('/api/maps/roof-size', { lat, lng });
    return response.data;
  } catch (error) {
    console.error('Error estimating roof size:', error);
    throw error;
  }
};

// Generate roof estimate
export const generateRoofEstimate = async (formData) => {
  try {
    const response = await api.post('/api/estimates/generate', formData);
    return response.data;
  } catch (error) {
    console.error('Error generating estimate:', error);
    throw error;
  }
};

// Submit final estimate with user contact info
export const submitEstimate = async (data) => {
  try {
    const response = await api.post('/api/estimates/submit', data);
    return response.data;
  } catch (error) {
    console.error('Error submitting estimate:', error);
    throw error;
  }
};

export default {
  getAddressCoordinates,
  getRoofSizeEstimate,
  generateRoofEstimate,
  submitEstimate
};
