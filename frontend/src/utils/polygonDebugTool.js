// src/utils/polygonDebugTool.js
/**
 * Debugging tools for roof polygon issues
 * This utility allows you to troubleshoot polygon scaling and area calculation
 */

/**
 * Log detailed polygon information to the console
 * @param {Array} polygonCoords - The polygon coordinates
 * @param {number} expectedSize - Expected roof size in square feet
 */
export const debugPolygon = (polygonCoords, expectedSize) => {
  if (!polygonCoords || !Array.isArray(polygonCoords) || polygonCoords.length < 3) {
    console.error("Invalid polygon coordinates:", polygonCoords);
    return;
  }
  
  console.group("Polygon Debug Information");
  console.log("Polygon coordinates:", polygonCoords);
  
  // Calculate and log area
  try {
    // Calculate area using simple methods
    const roughArea = calculateRoughArea(polygonCoords);
    console.log("Rough area calculation:", roughArea.toFixed(2), "sq ft");
    
    // Calculate using improved Mercator projection
    const mercatorArea = calculateAreaMercator(polygonCoords);
    console.log("Mercator projection area:", mercatorArea.toFixed(2), "sq ft");
    
    // Calculate using Haversine
    const haversineArea = calculateHaversineArea(polygonCoords);
    console.log("Haversine area:", haversineArea.toFixed(2), "sq ft");
    
    // Calculate size mismatch
    if (expectedSize) {
      const ratioRough = roughArea / expectedSize;
      const ratioMercator = mercatorArea / expectedSize;
      const ratioHaversine = haversineArea / expectedSize;
      
      console.log("Size ratio (rough/expected):", ratioRough.toFixed(4));
      console.log("Size ratio (mercator/expected):", ratioMercator.toFixed(4));
      console.log("Size ratio (haversine/expected):", ratioHaversine.toFixed(4));
      
      // Recommend scaling factor
      const recommendedFactor = 1 / Math.sqrt(ratioMercator);
      console.log("Recommended scaling factor:", recommendedFactor.toFixed(4));
    }
    
    // Calculate and log polygon dimensions
    const dimensions = calculatePolygonDimensions(polygonCoords);
    console.log("Polygon dimensions:", dimensions);
    
    // Calculate and log centroid
    const centroid = calculateCentroid(polygonCoords);
    console.log("Polygon centroid:", centroid);
    
  } catch (error) {
    console.error("Error in polygon debug calculations:", error);
  }
  
  console.groupEnd();
};

/**
 * Fix polygon scaling issues - UPDATED
 * @param {Array} polygonCoords - The polygon coordinates
 * @param {number} targetSize - Target roof size in square feet
 * @returns {Array} - Fixed polygon coordinates
 */
export const fixPolygonScaling = (polygonCoords, targetSize) => {
  if (!polygonCoords || !Array.isArray(polygonCoords) || polygonCoords.length < 3 || !targetSize) {
    console.error("Invalid inputs for polygon scaling fix");
    return polygonCoords;
  }
  
  try {
    // Calculate current area
    const currentArea = calculateAreaMercator(polygonCoords);
    
    // Calculate scaling factor
    const scaleFactor = Math.sqrt(targetSize / currentArea);
    
    // Find centroid
    const centroid = calculateCentroid(polygonCoords);
    
    // Scale polygon around centroid
    const scaledPolygon = polygonCoords.map(point => {
      const dLat = point.lat - centroid.lat;
      const dLng = point.lng - centroid.lng;
      
      return {
        lat: centroid.lat + dLat * scaleFactor,
        lng: centroid.lng + dLng * scaleFactor
      };
    });
    
    // Log debug info
    console.log("Polygon scaling fix applied:", {
      originalArea: currentArea.toFixed(2),
      targetArea: targetSize,
      scaleFactor: scaleFactor.toFixed(4),
      centroid
    });
    
    return scaledPolygon;
  } catch (error) {
    console.error("Error fixing polygon scaling:", error);
    return polygonCoords;
  }
};

/**
 * Calculate area using simple lat/lng distance approximation
 * @param {Array} polygonCoords - The polygon coordinates
 * @returns {number} - Area in square feet
 */
const calculateRoughArea = (polygonCoords) => {
  // Convert to simple x,y coordinates using degrees
  const points = polygonCoords.map(point => {
    return { x: point.lng, y: point.lat };
  });
  
  // Apply shoelace formula
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  
  area = Math.abs(area / 2);
  
  // Convert to square feet
  // This is very rough - 1 degree is approximately 69 miles at the equator
  const feetPerDegreeLat = 364000;
  const centerLat = calculateCentroid(polygonCoords).lat;
  const latRadians = centerLat * (Math.PI / 180);
  const feetPerDegreeLng = feetPerDegreeLat * Math.cos(latRadians);
  
  return area * feetPerDegreeLat * feetPerDegreeLng;
};

/**
 * Calculate area using Mercator projection
 * @param {Array} polygonCoords - The polygon coordinates
 * @returns {number} - Area in square feet
 */
const calculateAreaMercator = (polygonCoords) => {
  const earthRadius = 6378137; // meters
  
  // Convert lat/lng to meters with Mercator projection
  const pointsInMeters = polygonCoords.map(point => {
    const x = point.lng * (Math.PI / 180) * earthRadius;
    const y = Math.log(Math.tan((Math.PI / 4) + (point.lat * (Math.PI / 180) / 2))) * earthRadius;
    return { x, y };
  });
  
  // Apply shoelace formula
  let area = 0;
  for (let i = 0; i < pointsInMeters.length; i++) {
    const j = (i + 1) % pointsInMeters.length;
    area += pointsInMeters[i].x * pointsInMeters[j].y;
    area -= pointsInMeters[j].x * pointsInMeters[i].y;
  }
  
  // Convert square meters to square feet
  return Math.abs(area / 2) * 10.7639;
};

/**
 * Calculate area using Haversine formula
 * @param {Array} polygonCoords - The polygon coordinates
 * @returns {number} - Area in square feet
 */
const calculateHaversineArea = (polygonCoords) => {
  const earthRadius = 6378137; // meters
  
  // Calculate area using Haversine-based spherical polygon formula
  let area = 0;
  for (let i = 0; i < polygonCoords.length; i++) {
    const j = (i + 1) % polygonCoords.length;
    
    const lat1 = polygonCoords[i].lat * (Math.PI / 180);
    const lng1 = polygonCoords[i].lng * (Math.PI / 180);
    const lat2 = polygonCoords[j].lat * (Math.PI / 180);
    const lng2 = polygonCoords[j].lng * (Math.PI / 180);
    
    // Calculate area increment
    area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  
  // Convert to square meters, then to square feet
  area = Math.abs(area * earthRadius * earthRadius / 2);
  return area * 10.7639;
};

/**
 * Calculate centroid of polygon
 * @param {Array} polygonCoords - The polygon coordinates
 * @returns {Object} - Centroid coordinates {lat, lng}
 */
const calculateCentroid = (polygonCoords) => {
  let latSum = 0;
  let lngSum = 0;
  
  polygonCoords.forEach(point => {
    latSum += point.lat;
    lngSum += point.lng;
  });
  
  return {
    lat: latSum / polygonCoords.length,
    lng: lngSum / polygonCoords.length
  };
};

/**
 * Calculate approximate dimensions of polygon (width and height)
 * @param {Array} polygonCoords - The polygon coordinates
 * @returns {Object} - Dimensions in feet {width, height, diagonal}
 */
const calculatePolygonDimensions = (polygonCoords) => {
  // Find min/max lat/lng
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  
  polygonCoords.forEach(point => {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLng = Math.min(minLng, point.lng);
    maxLng = Math.max(maxLng, point.lng);
  });
  
  // Calculate width and height in degrees
  const widthDegrees = maxLng - minLng;
  const heightDegrees = maxLat - minLat;
  
  // Convert to feet
  const centerLat = (minLat + maxLat) / 2;
  const feetPerDegreeLat = 364000;
  const latRadians = centerLat * (Math.PI / 180);
  const feetPerDegreeLng = feetPerDegreeLat * Math.cos(latRadians);
  
  const width = widthDegrees * feetPerDegreeLng;
  const height = heightDegrees * feetPerDegreeLat;
  const diagonal = Math.sqrt(width * width + height * height);
  
  return {
    width: Math.round(width),
    height: Math.round(height),
    diagonal: Math.round(diagonal)
  };
};

/**
 * Generate a test polygon for debugging
 * @param {number} lat - Center latitude
 * @param {number} lng - Center longitude
 * @param {number} size - Target size in square feet
 * @returns {Array} - Test polygon coordinates
 */
export const generateTestPolygon = (lat, lng, size = 2500) => {
  const earthRadius = 6378137; // meters
  const sqMeters = size / 10.7639;
  
  // Calculate dimensions
  const width = Math.sqrt(sqMeters);
  const height = width;
  
  // Convert to degrees
  const metersPerDegreeLat = 111319.9; // at equator
  const latRadians = lat * (Math.PI / 180);
  const metersPerDegreeLng = metersPerDegreeLat * Math.cos(latRadians);
  
  const latOffset = (height / 2) / metersPerDegreeLat;
  const lngOffset = (width / 2) / metersPerDegreeLng;
  
  // Create rectangle
  return [
    { lat: lat - latOffset, lng: lng - lngOffset },
    { lat: lat - latOffset, lng: lng + lngOffset },
    { lat: lat + latOffset, lng: lng + lngOffset },
    { lat: lat + latOffset, lng: lng - lngOffset }
  ];
};

export default {
  debugPolygon,
  fixPolygonScaling,
  generateTestPolygon
};
