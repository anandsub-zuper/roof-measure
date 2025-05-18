// src/services/apiService.js - Updated with property data support

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
        buildingType: propertyData.propertyType,
        buildingSize: propertyData.buildingSize,
        stories: propertyData.stories,
        yearBuilt: propertyData.yearBuilt,
        roofType: propertyData.roofType
      };
    }
    
    // Make API request
    const response = await api.post('/api/maps/roof-size', requestData);
    console.log("Raw roof size response:", response.data);
    
    // Check if the response has the success property
    if (response.data && response.data.success === false) {
      throw new Error(response.data.message || "Roof size estimation failed");
    }
    
    // Cache the result
    if (!addressCache[coordKey]) addressCache[coordKey] = {};
    addressCache[coordKey].roofSize = response.data;
    
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
  generateRoofEstimate,
  submitEstimate,
  clearAddressCache
};

export default apiService;
