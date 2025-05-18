// src/utils/persistentCache.js
/**
 * Persistent storage utility for caching roof measurement data
 * 
 * This module provides a consistent way to store and retrieve
 * measurement data to ensure polygons and measurements remain
 * consistent across sessions.
 */

const CACHE_PREFIX = 'roofai_cache_';
const CACHE_VERSION = 'v1';

/**
 * Generate a consistent cache key for an address
 * @param {string} address - The address to generate a key for
 * @returns {string} - The cache key
 */
const generateAddressKey = (address) => {
  if (!address) return null;
  
  // Remove special characters and standardize format
  return `${CACHE_PREFIX}${CACHE_VERSION}_${address.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
};

/**
 * Generate a consistent cache key for coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string} - The cache key
 */
const generateCoordinateKey = (lat, lng) => {
  if (!lat || !lng) return null;
  
  // Truncate coordinates to 6 decimal places for consistency
  const fixedLat = parseFloat(lat).toFixed(6);
  const fixedLng = parseFloat(lng).toFixed(6);
  
  return `${CACHE_PREFIX}${CACHE_VERSION}_coord_${fixedLat}_${fixedLng}`;
};

/**
 * Store address data in persistent cache
 * @param {string} address - The address
 * @param {Object} data - The data to cache
 */
const storeAddressData = (address, data) => {
  if (!address || !data) return;
  
  try {
    const key = generateAddressKey(address);
    if (!key) return;
    
    // Store all data in one object for consistency
    const cacheData = {
      address: address,
      timestamp: Date.now(),
      ...data
    };
    
    // Store in localStorage
    localStorage.setItem(key, JSON.stringify(cacheData));
    
    // If coordinates are provided, also create a coordinate-based key
    if (data.lat && data.lng) {
      const coordKey = generateCoordinateKey(data.lat, data.lng);
      if (coordKey) {
        localStorage.setItem(coordKey, JSON.stringify(cacheData));
      }
    }
    
    console.log("Stored address data in cache:", { address, key });
    return true;
  } catch (error) {
    console.error("Error storing address data:", error);
    return false;
  }
};

/**
 * Retrieve address data from persistent cache
 * @param {string} address - The address to retrieve
 * @returns {Object|null} - The cached data or null if not found
 */
const retrieveAddressData = (address) => {
  if (!address) return null;
  
  try {
    const key = generateAddressKey(address);
    if (!key) return null;
    
    const cachedData = localStorage.getItem(key);
    if (!cachedData) return null;
    
    const data = JSON.parse(cachedData);
    
    // Add a friendly message about using cached data
    data._cacheMessage = `Using cached data from ${new Date(data.timestamp).toLocaleString()}`;
    
    console.log("Retrieved address data from cache:", { address, key });
    return data;
  } catch (error) {
    console.error("Error retrieving address data:", error);
    return null;
  }
};

/**
 * Retrieve data by coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Object|null} - The cached data or null if not found
 */
const retrieveCoordinateData = (lat, lng) => {
  if (!lat || !lng) return null;
  
  try {
    const key = generateCoordinateKey(lat, lng);
    if (!key) return null;
    
    const cachedData = localStorage.getItem(key);
    if (!cachedData) return null;
    
    const data = JSON.parse(cachedData);
    
    // Add a friendly message about using cached data
    data._cacheMessage = `Using cached data from ${new Date(data.timestamp).toLocaleString()}`;
    
    console.log("Retrieved coordinate data from cache:", { lat, lng, key });
    return data;
  } catch (error) {
    console.error("Error retrieving coordinate data:", error);
    return null;
  }
};

/**
 * Clear all cached data
 */
const clearAllCachedData = () => {
  try {
    // Find all keys that start with our prefix
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    
    // Remove all found keys
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log(`Cleared ${keysToRemove.length} cached items`);
    return true;
  } catch (error) {
    console.error("Error clearing cache:", error);
    return false;
  }
};

export default {
  storeAddressData,
  retrieveAddressData,
  retrieveCoordinateData,
  clearAllCachedData,
  generateAddressKey,
  generateCoordinateKey
};
