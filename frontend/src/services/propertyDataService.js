// src/services/propertyDataService.js
import axios from 'axios';

const RENTCAST_API_KEY = process.env.REACT_APP_RENTCAST_API_KEY || '';
const propertyDataCache = {};

/**
 * Get property details from Rentcast API
 */
export const getPropertyDetails = async (address) => {
  if (!address) {
    console.error('No address provided for property lookup');
    return null;
  }
  
  console.log('🏠 RENTCAST: Starting property lookup for:', address);
  
  // Check cache first
  const cacheKey = address.trim().toLowerCase();
  if (propertyDataCache[cacheKey]) {
    console.log('🏠 RENTCAST: Using cached property data');
    return propertyDataCache[cacheKey];
  }

  // Skip API call if no key is configured
  if (!RENTCAST_API_KEY) {
    console.warn('🏠 RENTCAST: No API key configured, using fallback');
    const fallbackData = getFallbackPropertyData(address);
    propertyDataCache[cacheKey] = fallbackData;
    return fallbackData;
  }
  
  try {
    console.log('🏠 RENTCAST: Making API request to Rentcast');
    
    const response = await axios.get('https://api.rentcast.io/v1/properties', {
      params: { address },
      headers: {
        'X-Api-Key': RENTCAST_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('🏠 RENTCAST: Received response with status:', response.status);
    
    if (response.data && response.status === 200) {
      console.log('🏠 RENTCAST: Raw API response:', response.data);
      
      const propertyData = processPropertyData(response.data);
      propertyDataCache[cacheKey] = propertyData;
      
      console.log('🏠 RENTCAST: Processed property data:', propertyData);
      return propertyData;
    }
    
    // Fallback if empty response
    console.warn('🏠 RENTCAST: Empty response, using fallback');
    const fallbackData = getFallbackPropertyData(address);
    propertyDataCache[cacheKey] = fallbackData;
    return fallbackData;
  } catch (error) {
    console.error('🏠 RENTCAST: Error fetching property data:', error);
    
    const fallbackData = getFallbackPropertyData(address);
    propertyDataCache[cacheKey] = fallbackData;
    return fallbackData;
  }
};

/**
 * Process raw property data from Rentcast
 * FIXED: Correctly maps RentCast fields to our model
 */
const processPropertyData = (rawData) => {
  // Handle array response (RentCast returns an array)
  const data = Array.isArray(rawData) && rawData.length > 0 ? rawData[0] : rawData;
  
  // Log all available fields for debugging
  console.log('🏠 RENTCAST: Available fields:', Object.keys(data));
  
  // Extract features if available
  const features = data.features || {};
  
  const processedData = {
    propertyType: data.propertyType || 'unknown',
    buildingSize: data.squareFootage || null,
    lotSize: data.lotSize || null,
    bedrooms: data.bedrooms || null,
    bathrooms: data.bathrooms || null,
    yearBuilt: data.yearBuilt || null,
    stories: features.floorCount || data.stories || 1,
    roofType: features.roofType || data.roofType || null,
    lastSaleDate: data.lastSaleDate || null,
    lastSalePrice: data.lastSalePrice || null,
    estimatedValue: data.estimatedValue || null,
    latitude: data.latitude || null,
    longitude: data.longitude || null,
    parcelId: data.assessorID || data.parcelId || null,
    source: 'rentcast',
    rawData: data // Store the complete raw data for reference
  };
  
  // Log which fields were found vs missing
  const foundFields = Object.entries(processedData)
    .filter(([key, value]) => value !== null && key !== 'rawData')
    .map(([key]) => key);
    
  const missingFields = Object.entries(processedData)
    .filter(([key, value]) => value === null && key !== 'rawData')
    .map(([key]) => key);
  
  console.log('🏠 RENTCAST: Fields found:', foundFields.join(', '));
  console.log('🏠 RENTCAST: Fields missing:', missingFields.join(', '));
  
  return processedData;
};

/**
 * Generate fallback property data when API call fails
 */
const getFallbackPropertyData = (address) => {
  const addressLower = address.toLowerCase();
  
  // Try to extract useful information from the address
  const hasApartmentIndicator = addressLower.includes('apt') || 
                               addressLower.includes('unit') || 
                               addressLower.includes('#');
  
  const hasCondoIndicator = addressLower.includes('condo') || 
                           addressLower.includes('flat');
  
  // Make educated guesses
  let propertyType = 'single_family'; // Default assumption
  
  if (hasApartmentIndicator) {
    propertyType = 'multi_family';
  } else if (hasCondoIndicator) {
    propertyType = 'condo';
  }
  
  return {
    propertyType: propertyType,
    buildingSize: null,
    lotSize: null,
    bedrooms: null,
    bathrooms: null,
    yearBuilt: null,
    stories: 1,
    source: 'fallback'
  };
};

export default {
  getPropertyDetails
};
