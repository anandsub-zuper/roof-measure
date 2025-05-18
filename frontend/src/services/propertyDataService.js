// Enhanced propertyDataService.js with improved debugging
// Replace or modify your frontend/src/services/propertyDataService.js

import axios from 'axios';

// Configure your Rentcast API key
const RENTCAST_API_KEY = process.env.REACT_APP_RENTCAST_API_KEY || '';

// In-memory cache to avoid redundant API calls
const propertyDataCache = {};

// Debug flag - set to true to enable detailed logging
const DEBUG = true; 

/**
 * Get property details from Rentcast API
 * @param {string} address - The property address
 * @returns {Promise<Object>} - Property data
 */
export const getPropertyDetails = async (address) => {
  if (!address) {
    console.error('No address provided for property lookup');
    return null;
  }
  
  // Log the start of the property lookup
  if (DEBUG) {
    console.log('🏠 RENTCAST: Starting property lookup for:', address);
  }
  
  // Check in-memory cache first
  const cacheKey = address.trim().toLowerCase();
  if (propertyDataCache[cacheKey]) {
    if (DEBUG) {
      console.log('🏠 RENTCAST: Using cached property data for:', address);
    }
    return propertyDataCache[cacheKey];
  }

  // Skip API call if no key is configured
  if (!RENTCAST_API_KEY) {
    console.warn('🏠 RENTCAST: No API key configured, using fallback property detection');
    const fallbackData = getFallbackPropertyData(address);
    propertyDataCache[cacheKey] = fallbackData;
    
    if (DEBUG) {
      console.log('🏠 RENTCAST: Generated fallback data:', fallbackData);
    }
    
    return fallbackData;
  }
  
  try {
    // Log the API request
    if (DEBUG) {
      console.log('🏠 RENTCAST: Making API request to Rentcast for:', address);
      console.log('🏠 RENTCAST: API Key present:', !!RENTCAST_API_KEY);
    }
    
    // Make request to Rentcast API
    const response = await axios.get('https://api.rentcast.io/v1/properties', {
      params: {
        address: address
      },
      headers: {
        'X-Api-Key': RENTCAST_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    // Log the API response status
    if (DEBUG) {
      console.log('🏠 RENTCAST: Received response with status:', response.status);
    }
    
    // Process the response
    if (response.data && response.status === 200) {
      // Log the raw API response
      if (DEBUG) {
        console.log('🏠 RENTCAST: Raw API response:', response.data);
      }
      
      const propertyData = processPropertyData(response.data);
      
      // Cache the results in memory
      propertyDataCache[cacheKey] = propertyData;
      
      if (DEBUG) {
        console.log('🏠 RENTCAST: Processed property data:', propertyData);
      }
      
      return propertyData;
    }
    
    // Use fallback if API returns empty result
    console.warn('🏠 RENTCAST: API returned empty result, using fallback detection');
    const fallbackData = getFallbackPropertyData(address);
    propertyDataCache[cacheKey] = fallbackData;
    return fallbackData;
  } catch (error) {
    console.error('🏠 RENTCAST: Error fetching property data:', error);
    
    // Log detailed error information
    if (DEBUG) {
      if (error.response) {
        console.error('🏠 RENTCAST: Error response data:', error.response.data);
        console.error('🏠 RENTCAST: Error response status:', error.response.status);
      } else if (error.request) {
        console.error('🏠 RENTCAST: No response received, request was:', error.request);
      } else {
        console.error('🏠 RENTCAST: Error message:', error.message);
      }
    }
    
    // Fallback to local estimations if API fails
    const fallbackData = getFallbackPropertyData(address);
    propertyDataCache[cacheKey] = fallbackData;
    return fallbackData;
  }
};

/**
 * Process raw property data from Rentcast
 * @param {Object} rawData - Raw API response
 * @returns {Object} - Processed property data
 */
const processPropertyData = (rawData) => {
  // Extract the relevant information from the API response
  // NOTE: Adjust field names based on actual Rentcast API response structure
  const processedData = {
    propertyType: rawData.propertyType || rawData.type || 'unknown',
    buildingSize: rawData.buildingSize || rawData.squareFootage || null,
    lotSize: rawData.lotSize || null,
    bedrooms: rawData.bedrooms || null,
    bathrooms: rawData.bathrooms || null,
    yearBuilt: rawData.yearBuilt || null,
    stories: rawData.stories || 1,
    roofType: rawData.roofType || null,
    lastSaleDate: rawData.lastSaleDate || null,
    lastSalePrice: rawData.lastSalePrice || null,
    estimatedValue: rawData.estimatedValue || null,
    latitude: rawData.latitude || null,
    longitude: rawData.longitude || null,
    parcelId: rawData.parcelId || null,
    source: 'rentcast'
  };
  
  // Log what fields were found vs not found
  if (DEBUG) {
    const foundFields = Object.entries(processedData)
      .filter(([key, value]) => value !== null)
      .map(([key]) => key);
      
    const missingFields = Object.entries(processedData)
      .filter(([key, value]) => value === null)
      .map(([key]) => key);
    
    console.log('🏠 RENTCAST: Fields found in API response:', foundFields.join(', '));
    console.log('🏠 RENTCAST: Fields missing in API response:', missingFields.join(', '));
  }
  
  return processedData;
};

/**
 * Generate fallback property data when API call fails
 * @param {string} address - The property address
 * @returns {Object} - Estimated property data
 */
const getFallbackPropertyData = (address) => {
  // Extract hints from the address
  const addressLower = address.toLowerCase();
  const hasApartmentIndicator = addressLower.includes('apt') || 
                               addressLower.includes('unit') || 
                               addressLower.includes('#') ||
                               addressLower.includes('suite');
  
  const hasCondoIndicator = addressLower.includes('condo') || addressLower.includes('flat');
  
  // Make educated guesses based on address
  let propertyType = 'single_family'; // Default assumption
  
  if (hasApartmentIndicator) {
    propertyType = 'multi_family';
  } else if (hasCondoIndicator) {
    propertyType = 'condo';
  }
  
  // Return basic fallback data
  return {
    propertyType: propertyType,
    buildingSize: null, // We don't know
    lotSize: null,
    bedrooms: null,
    bathrooms: null,
    yearBuilt: null,
    stories: 1,
    source: 'fallback' // Indicate this is estimated data
  };
};

/**
 * Convert property type to standardized building category
 * @param {Object} propertyData - Property data from API
 * @returns {string} - Standardized building category
 */
export const getBuildingCategory = (propertyData) => {
  if (!propertyData) return 'medium'; // Default category
  
  const { propertyType, buildingSize, stories } = propertyData;
  
  // Convert to standardized categories
  if (propertyType) {
    const type = propertyType.toLowerCase();
    
    if (type.includes('apartment') || 
        type.includes('multi-family') || 
        type.includes('multi_family') ||
        type.includes('condo')) {
      return 'multi_unit';
    }
    
    if (type.includes('townhouse') || 
        type.includes('townhome') || 
        type.includes('row_house')) {
      return 'townhouse';
    }
    
    if (type.includes('commercial') || 
        type.includes('industrial') || 
        type.includes('office')) {
      return 'commercial';
    }
  }
  
  // Fallback to size-based categorization
  if (buildingSize) {
    const size = parseInt(buildingSize, 10);
    if (!isNaN(size)) {
      if (size < 1200) return 'small';
      if (size >= 1200 && size < 3000) return 'medium';
      if (size >= 3000 && size < 5000) return 'large';
      return 'xlarge';
    }
  }
  
  // Default for unknown types
  return 'medium';
};

/**
 * Clear the in-memory property data cache
 */
export const clearPropertyDataCache = () => {
  Object.keys(propertyDataCache).forEach(key => {
    delete propertyDataCache[key];
  });
  console.log('🏠 RENTCAST: Property data cache cleared');
};

/**
 * Check if Rentcast API is configured and available
 * @returns {boolean} - True if API is available
 */
export const isRentcastAvailable = () => {
  return !!RENTCAST_API_KEY;
};

export default {
  getPropertyDetails,
  getBuildingCategory,
  clearPropertyDataCache,
  isRentcastAvailable
};
