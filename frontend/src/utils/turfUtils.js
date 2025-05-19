// src/utils/turfUtils.js
/**
 * Utility functions for area calculation and polygon manipulation using TurfJS
 */

/**
 * Calculate polygon area in square feet
 * @param {Array} coordinates - Array of {lat, lng} coordinates
 * @returns {number} - Area in square feet
 */
export const calculatePolygonArea = (coordinates) => {
  if (!window.turf) {
    console.error("Turf.js library not available");
    return 0;
  }
  
  if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 3) {
    console.warn("Invalid coordinates for area calculation");
    return 0;
  }
  
  try {
    // Convert coordinates to GeoJSON format [lng, lat]
    const turfCoordinates = coordinates.map(point => [point.lng, point.lat]);
    
    // Close the polygon if needed
    if (turfCoordinates.length > 0 && 
        (turfCoordinates[0][0] !== turfCoordinates[turfCoordinates.length-1][0] || 
         turfCoordinates[0][1] !== turfCoordinates[turfCoordinates.length-1][1])) {
      turfCoordinates.push(turfCoordinates[0]);
    }
    
    // Create a Turf polygon and calculate area
    const turfPolygon = window.turf.polygon([turfCoordinates]);
    const areaInSquareMeters = window.turf.area(turfPolygon);
    
    // Convert to square feet and round
    const areaInSquareFeet = Math.round(areaInSquareMeters * 10.7639);
    
    console.log("Calculated area with Turf.js:", areaInSquareFeet, "sq ft");
    return areaInSquareFeet;
  } catch (error) {
    console.error("Error calculating area with Turf.js:", error);
    return 0;
  }
};

/**
 * Adjust a polygon to match a target area
 * @param {Array} coordinates - Array of {lat, lng} coordinates 
 * @param {number} targetArea - Target area in square feet
 * @returns {Array} - Adjusted coordinates
 */
export const adjustPolygonToArea = (coordinates, targetArea) => {
  if (!window.turf) {
    console.error("Turf.js library not available");
    return coordinates;
  }
  
  if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 3 || !targetArea) {
    return coordinates;
  }
  
  try {
    // Calculate current area
    const currentArea = calculatePolygonArea(coordinates);
    
    if (currentArea <= 0) {
      return coordinates;
    }
    
    // Calculate scale factor
    const scaleFactor = Math.sqrt(targetArea / currentArea);
    
    if (scaleFactor === 1 || isNaN(scaleFactor)) {
      return coordinates;
    }
    
    // Calculate centroid
    const centroid = calculateCentroid(coordinates);
    
    // Scale polygon around centroid
    return coordinates.map(point => {
      const dLat = point.lat - centroid.lat;
      const dLng = point.lng - centroid.lng;
      
      return {
        lat: centroid.lat + dLat * scaleFactor,
        lng: centroid.lng + dLng * scaleFactor
      };
    });
  } catch (error) {
    console.error("Error adjusting polygon area:", error);
    return coordinates;
  }
};

/**
 * Calculate the centroid of a polygon
 * @param {Array} coordinates - Array of {lat, lng} coordinates
 * @returns {Object} - Centroid {lat, lng}
 */
export const calculateCentroid = (coordinates) => {
  if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 3) {
    console.warn("Invalid coordinates for centroid calculation");
    return { lat: 0, lng: 0 };
  }
  
  try {
    if (window.turf) {
      // Use Turf.js for accurate centroid
      const turfCoordinates = coordinates.map(point => [point.lng, point.lat]);
      
      // Close the polygon if needed
      if (turfCoordinates.length > 0 && 
          (turfCoordinates[0][0] !== turfCoordinates[turfCoordinates.length-1][0] || 
           turfCoordinates[0][1] !== turfCoordinates[turfCoordinates.length-1][1])) {
        turfCoordinates.push(turfCoordinates[0]);
      }
      
      const turfPolygon = window.turf.polygon([turfCoordinates]);
      const centroid = window.turf.centroid(turfPolygon);
      
      return {
        lat: centroid.geometry.coordinates[1],
        lng: centroid.geometry.coordinates[0]
      };
    }
    
    // Fallback to simple average
    let latSum = 0;
    let lngSum = 0;
    
    coordinates.forEach(point => {
      latSum += point.lat;
      lngSum += point.lng;
    });
    
    return {
      lat: latSum / coordinates.length,
      lng: lngSum / coordinates.length
    };
  } catch (error) {
    console.error("Error calculating centroid:", error);
    
    // Fallback to basic average
    let latSum = 0;
    let lngSum = 0;
    
    coordinates.forEach(point => {
      latSum += point.lat;
      lngSum += point.lng;
    });
    
    return {
      lat: latSum / coordinates.length,
      lng: lngSum / coordinates.length
    };
  }
};

/**
 * Apply a roof pitch factor to a flat area
 * @param {number} flatArea - Flat area in square feet
 * @param {string} pitch - Roof pitch (flat, low, moderate, steep)
 * @returns {number} - Adjusted area
 */
export const applyPitchFactor = (flatArea, pitch) => {
  const pitchFactors = {
    'flat': 1.05,
    'low': 1.15,
    'moderate': 1.35,
    'steep': 1.6,
    'unknown': 1.3
  };
  
  const factor = pitchFactors[pitch] || pitchFactors.moderate;
  return Math.round(flatArea * factor);
};

export default {
  calculatePolygonArea,
  adjustPolygonToArea,
  calculateCentroid,
  applyPitchFactor
};
