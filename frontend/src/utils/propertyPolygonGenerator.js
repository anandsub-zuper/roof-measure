// src/utils/propertyPolygonGenerator.js - Updated with improved measurement
/**
 * Property-specific polygon generation utility
 * Creates accurate roof polygons based on property metadata
 */

/**
 * Generate property-specific polygon based on building type and metadata
 * @param {number} lat - Latitude coordinate
 * @param {number} lng - Longitude coordinate 
 * @param {number} size - Roof size in square feet
 * @param {Object} propertyData - Property metadata
 * @returns {Array} - Array of polygon coordinates
 */
export const generatePropertyPolygon = (lat, lng, size, propertyData = null) => {
  // Always validate inputs first
  if (!lat || !lng || !size) {
    console.warn("Invalid inputs for polygon generation");
    return generateSimplePolygon(lat, lng, 2500, 0.85); // Using larger scale factor
  }
  
  // If we have property data, use it for better polygon generation
  if (propertyData) {
    const buildingType = propertyData.propertyType || 'unknown';
    const buildingSize = propertyData.buildingSize || size;
    const stories = propertyData.stories || 1;
    
    return generateTypedPolygon(lat, lng, buildingSize, buildingType, stories, propertyData);
  }
  
  // Fallback to adaptive scaling based on size alone
  return generateSizeBasedPolygon(lat, lng, size);
};

/**
 * Generate polygon tailored to specific building type
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} size - Building size
 * @param {string} buildingType - Property type
 * @param {number} stories - Number of stories
 * @param {Object} metadata - Additional property metadata
 * @returns {Array} - Polygon coordinates
 */
const generateTypedPolygon = (lat, lng, size, buildingType, stories, metadata) => {
  const typeInfo = {
    // Extract type info from building type
    isSingleFamily: buildingType.toLowerCase().includes('single'),
    isMultiFamily: buildingType.toLowerCase().includes('multi'),
    isTownhouse: buildingType.toLowerCase().includes('town'),
    isApartment: buildingType.toLowerCase().includes('apart'),
    isCommercial: buildingType.toLowerCase().includes('commercial'),
    isIndustrial: buildingType.toLowerCase().includes('industrial'),
    isWarehouse: buildingType.toLowerCase().includes('warehouse'),
    isStorage: buildingType.toLowerCase().includes('storage')
  };
  
  // Calculate basic size metrics
  const sqMeters = size * 0.092903;
  
  // Define building-specific scaling factors
  let scaleFactor = 0.85; // Increased from 0.4
  let aspectRatio = 1.5; // Default
  
  // Adjust scaling based on building type
  if (typeInfo.isSingleFamily) {
    // Single family homes
    scaleFactor = 0.9; // Increased from 0.4
    aspectRatio = 1.4;
  } else if (typeInfo.isTownhouse) {
    // Townhouses are narrower and longer
    scaleFactor = 0.85; // Increased from 0.35
    aspectRatio = 2.2;
  } else if (typeInfo.isMultiFamily || typeInfo.isApartment) {
    // Multi-family buildings often have complex shapes
    scaleFactor = 0.9; // Increased from 0.45
    aspectRatio = 1.6;
  } else if (typeInfo.isCommercial || typeInfo.isIndustrial) {
    // Commercial buildings tend to be larger and more square
    scaleFactor = 0.85; // Increased from 0.35
    aspectRatio = 1.2;
  } else if (typeInfo.isWarehouse || typeInfo.isStorage) {
    // Warehouses are very rectangular
    scaleFactor = 0.8; // Increased from 0.3
    aspectRatio = 2.5;
  }
  
  // Adjust for multi-story buildings
  if (stories > 1) {
    // For multi-story, scale factor should be larger to account for the full footprint
    // A 2-story building should have a footprint ~50% of the total area
    const adjustedSize = size / stories;
    scaleFactor *= 0.9 + (0.2 * stories); // Increase scale factor for multi-story buildings
    
    // Recalculate square meters with story adjustment
    const adjustedSqMeters = adjustedSize * 0.092903 * scaleFactor;
    
    // Calculate dimensions
    const width = Math.sqrt(adjustedSqMeters / aspectRatio);
    const length = width * aspectRatio;
    
    // Convert to degrees
    const feetPerDegreeLat = 364000;
    const latRadians = lat * (Math.PI / 180);
    const feetPerDegreeLng = feetPerDegreeLat * Math.cos(latRadians);
    
    const latOffset = (length / 2) / feetPerDegreeLat;
    const lngOffset = (width / 2) / feetPerDegreeLng;
    
    // Position adjustment - different for various buildings
    const posAdjustment = 0.25; // Increased from 0.15 for better positioning
    const adjustedLat = lat + (latOffset * posAdjustment);
    
    // Return simple polygon for multi-story buildings
    return [
      { lat: adjustedLat - latOffset, lng: lng - lngOffset },
      { lat: adjustedLat - latOffset, lng: lng + lngOffset },
      { lat: adjustedLat + latOffset, lng: lng + lngOffset },
      { lat: adjustedLat + latOffset, lng: lng - lngOffset }
    ];
  }
  
  // For single-story buildings, proceed with standard calculation
  const adjustedSqMeters = sqMeters * scaleFactor;
  
  // Calculate dimensions
  const width = Math.sqrt(adjustedSqMeters / aspectRatio);
  const length = width * aspectRatio;
  
  // Convert to degrees
  const feetPerDegreeLat = 364000;
  const latRadians = lat * (Math.PI / 180);
  const feetPerDegreeLng = feetPerDegreeLat * Math.cos(latRadians);
  
  const latOffset = (length / 2) / feetPerDegreeLat;
  const lngOffset = (width / 2) / feetPerDegreeLng;
  
  // Position adjustment - different for various buildings
  const posAdjustment = 0.25; // Increased from 0.15 for better positioning
  const adjustedLat = lat + (latOffset * posAdjustment);
  
  // Create complex polygons for certain building types
  if ((typeInfo.isMultiFamily || typeInfo.isApartment) && size > 3000) {
    // Multi-family large buildings often have L shapes
    // Use a deterministic approach based on coordinates
    const orientation = Math.round((lat * 1000 + lng * 1000) % 4);
    
    switch(orientation) {
      case 0: // L-shape extending north-west
        return [
          { lat: adjustedLat - latOffset, lng: lng - lngOffset },
          { lat: adjustedLat - latOffset, lng: lng + lngOffset },
          { lat: adjustedLat + latOffset, lng: lng + lngOffset },
          { lat: adjustedLat + latOffset, lng: lng - lngOffset * 0.3 },
          { lat: adjustedLat + latOffset * 0.4, lng: lng - lngOffset * 0.3 },
          { lat: adjustedLat + latOffset * 0.4, lng: lng - lngOffset },
          { lat: adjustedLat - latOffset, lng: lng - lngOffset }
        ];
      case 1: // L-shape extending north-east
        return [
          { lat: adjustedLat - latOffset, lng: lng - lngOffset },
          { lat: adjustedLat - latOffset, lng: lng + lngOffset },
          { lat: adjustedLat + latOffset, lng: lng + lngOffset },
          { lat: adjustedLat + latOffset, lng: lng - lngOffset * 0.3 },
          { lat: adjustedLat, lng: lng - lngOffset * 0.3 },
          { lat: adjustedLat, lng: lng - lngOffset },
          { lat: adjustedLat - latOffset, lng: lng - lngOffset }
        ];
      case 2: // L-shape extending south-east
        return [
          { lat: adjustedLat - latOffset, lng: lng - lngOffset },
          { lat: adjustedLat - latOffset, lng: lng + lngOffset },
          { lat: adjustedLat + latOffset * 0.4, lng: lng + lngOffset },
          { lat: adjustedLat + latOffset * 0.4, lng: lng },
          { lat: adjustedLat + latOffset, lng: lng },
          { lat: adjustedLat + latOffset, lng: lng - lngOffset },
          { lat: adjustedLat - latOffset, lng: lng - lngOffset }
        ];
      case 3: // L-shape extending south-west
      default:
        return [
          { lat: adjustedLat - latOffset, lng: lng - lngOffset },
          { lat: adjustedLat - latOffset, lng: lng + lngOffset * 0.4 },
          { lat: adjustedLat, lng: lng + lngOffset * 0.4 },
          { lat: adjustedLat, lng: lng + lngOffset },
          { lat: adjustedLat + latOffset, lng: lng + lngOffset },
          { lat: adjustedLat + latOffset, lng: lng - lngOffset },
          { lat: adjustedLat - latOffset, lng: lng - lngOffset }
        ];
    }
  } else if (typeInfo.isCommercial && size > 8000) {
    // Large commercial buildings often have U shapes
    return [
      // Left wing
      { lat: adjustedLat - latOffset, lng: lng - lngOffset },
      { lat: adjustedLat - latOffset, lng: lng - lngOffset * 0.3 },
      { lat: adjustedLat + latOffset, lng: lng - lngOffset * 0.3 },
      // Center connector
      { lat: adjustedLat + latOffset, lng: lng + lngOffset * 0.3 },
      // Right wing
      { lat: adjustedLat - latOffset, lng: lng + lngOffset * 0.3 },
      { lat: adjustedLat - latOffset, lng: lng + lngOffset },
      { lat: adjustedLat + latOffset * 0.5, lng: lng + lngOffset },
      { lat: adjustedLat + latOffset * 0.5, lng: lng - lngOffset },
      { lat: adjustedLat - latOffset, lng: lng - lngOffset }
    ];
  }
  
  // For most cases, return a rectangular polygon
  return [
    { lat: adjustedLat - latOffset, lng: lng - lngOffset },
    { lat: adjustedLat - latOffset, lng: lng + lngOffset },
    { lat: adjustedLat + latOffset, lng: lng + lngOffset },
    { lat: adjustedLat + latOffset, lng: lng - lngOffset }
  ];
};

/**
 * Generate polygon based on size when property type unknown
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} size - Building size 
 * @returns {Array} - Polygon coordinates
 */
export const generateSizeBasedPolygon = (lat, lng, size) => {
  // Size to square meters
  const sqMeters = size * 0.092903;
  
  // Apply a larger scale factor for visual representation
  let scaleFactor = 0.85; // Increased from 0.4
  
  // Adjust scaling based on size categories 
  if (size < 1200) {
    scaleFactor = 0.9; // Increased from 0.45
  } else if (size >= 1200 && size < 3000) {
    scaleFactor = 0.87; // Increased from 0.42
  } else if (size >= 3000 && size < 5000) {
    scaleFactor = 0.85; // Increased from 0.4
  } else {
    scaleFactor = 0.83; // Increased from 0.38
  }
  
  const adjustedSqMeters = sqMeters * scaleFactor;
  
  // Adapt aspect ratio based on building size
  let aspectRatio = 1.5; // Default
  
  if (size < 1200) {
    aspectRatio = 1.3; // Smaller buildings tend to be more square
  } else if (size >= 3000) {
    aspectRatio = 1.7; // Larger buildings often more rectangular
  }
  
  // Calculate dimensions
  const width = Math.sqrt(adjustedSqMeters / aspectRatio);
  const length = width * aspectRatio;
  
  // Convert to degrees
  const feetPerDegreeLat = 364000;
  const latRadians = lat * (Math.PI / 180);
  const feetPerDegreeLng = feetPerDegreeLat * Math.cos(latRadians);
  
  const latOffset = (length / 2) / feetPerDegreeLat;
  const lngOffset = (width / 2) / feetPerDegreeLng;
  
  // Position adjustment - increased for better positioning
  const posAdjustment = 0.25; 
  const adjustedLat = lat + (latOffset * posAdjustment);
  
  // Create rectangle
  return [
    { lat: adjustedLat - latOffset, lng: lng - lngOffset },
    { lat: adjustedLat - latOffset, lng: lng + lngOffset },
    { lat: adjustedLat + latOffset, lng: lng + lngOffset },
    { lat: adjustedLat + latOffset, lng: lng - lngOffset }
  ];
};

/**
 * Generate a simple rectangular polygon (fallback)
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} size - Roof size
 * @param {number} scaleFactor - Scaling factor
 * @returns {Array} - Polygon coordinates
 */
export const generateSimplePolygon = (lat, lng, size = 2500, scaleFactor = 0.85) => {
  // Convert to square meters
  const sqMeters = size * 0.092903;
  
  // Apply scale correction
  const adjustedSqMeters = sqMeters * scaleFactor;
  
  // Standard aspect ratio
  const aspectRatio = 1.5;
  
  // Calculate dimensions
  const width = Math.sqrt(adjustedSqMeters / aspectRatio);
  const length = width * aspectRatio;
  
  // Convert to degrees
  const feetPerDegreeLat = 364000;
  const latRadians = lat * (Math.PI / 180);
  const feetPerDegreeLng = feetPerDegreeLat * Math.cos(latRadians);
  
  const latOffset = (length / 2) / feetPerDegreeLat;
  const lngOffset = (width / 2) / feetPerDegreeLng;
  
  // Position adjustment - increased for better positioning
  const adjustedLat = lat + (latOffset * 0.25);
  
  // Create rectangle
  return [
    { lat: adjustedLat - latOffset, lng: lng - lngOffset },
    { lat: adjustedLat - latOffset, lng: lng + lngOffset },
    { lat: adjustedLat + latOffset, lng: lng + lngOffset },
    { lat: adjustedLat + latOffset, lng: lng - lngOffset }
  ];
};

/**
 * Calculate the actual roof size based on building characteristics - IMPROVED
 * @param {number} buildingSize - Building square footage
 * @param {Object} propertyData - Property data
 * @returns {number} - Estimated actual roof size
 */
export const calculateRoofSizeFromBuildingSize = (buildingSize, propertyData) => {
  if (!buildingSize) return null;
  
  // Extract key property data
  const stories = propertyData?.stories || 1;
  const propertyType = (propertyData?.propertyType || '').toLowerCase();
  const buildingSizeNum = parseFloat(buildingSize);
  
  // Calculate the ground floor footprint
  const footprint = Math.round(buildingSizeNum / stories);
  
  // Define base pitch factors based on building type
  let pitchFactor = 1.2; // Default moderate pitch
  let complexityFactor = 1.0; // Default complexity
  let overhangFactor = 1.05; // Default overhang factor (5%)
  
  // Adjust factors based on property type
  if (propertyType.includes('single') && propertyType.includes('family')) {
    // Single family home factors - adjust based on size and stories
    if (stories === 2) {
      pitchFactor = 1.25; // Two-story homes often have steeper main roofs
      overhangFactor = 1.08; // More substantial overhangs (8%)
    } else {
      pitchFactor = 1.2; // One-story homes have typical pitch
    }
    
    // Adjust for building size (larger homes have more complex roofs)
    if (buildingSizeNum >= 2500) {
      complexityFactor = 1.1; // 10% extra for large homes with complex roof lines
    } else if (buildingSizeNum >= 1800) {
      complexityFactor = 1.07; // 7% extra for medium-large homes
    } else {
      complexityFactor = 1.05; // 5% extra for smaller homes
    }
  } else if (propertyType.includes('condo') || propertyType.includes('apartment')) {
    // Condos and apartments often have flatter roofs
    pitchFactor = 1.1;
    complexityFactor = 1.0;
    overhangFactor = 1.03; // 3% for overhangs
  } else if (propertyType.includes('town')) {
    // Townhomes - adjust based on size
    pitchFactor = 1.2;
    complexityFactor = 1.03;
    overhangFactor = 1.05;
  } else if (propertyType.includes('commercial')) {
    // Commercial buildings often have flatter roofs
    pitchFactor = 1.08;
    complexityFactor = 1.0;
    overhangFactor = 1.02;
  }
  
  // Calculate total factor
  const totalFactor = pitchFactor * complexityFactor * overhangFactor;
  
  // Apply total factor to footprint
  const calculatedRoofSize = Math.round(footprint * totalFactor);
  
  // For the given example (2,990 sq ft, 2-story building):
  // - Footprint would be about 1,495 sq ft
  // - For single-family: ~1,495 * 1.25 * 1.1 * 1.08 = ~2,234 sq ft
  // - For other types: Will adjust based on the above factors
  
  // Ensure result is within reasonable bounds (never less than footprint)
  if (calculatedRoofSize < footprint) {
    return footprint;
  }
  
  return calculatedRoofSize;
};

/**
 * Fix the backend-provided polygon coordinates to display properly
 * @param {Array} polygonCoords - Original polygon coordinates from backend
 * @param {number} lat - Center latitude 
 * @param {number} lng - Center longitude
 * @param {number} size - Target roof size in sq ft
 * @returns {Array} - Fixed polygon coordinates
 */
export const fixProvidedPolygon = (polygonCoords, lat, lng, size) => {
  if (!polygonCoords || !Array.isArray(polygonCoords) || polygonCoords.length < 3) {
    return generateSizeBasedPolygon(lat, lng, size);
  }
  
  // Check if the coordinates need resizing
  try {
    // Calculate area of provided polygon
    const areaInSqMeters = calculatePolygonAreaInSquareMeters(polygonCoords);
    const areaInSqFeet = areaInSqMeters * 10.7639;
    
    console.log("Original polygon area:", areaInSqFeet, "sq ft");
    
    // If the area is reasonably close to the expected size, use as is
    if (areaInSqFeet > size * 0.7 && areaInSqFeet < size * 1.3) {
      return polygonCoords;
    }
    
    // Otherwise, we need to resize the polygon
    // Calculate the scale factor needed
    const scaleFactor = Math.sqrt(size / areaInSqFeet);
    console.log("Applied scale factor:", scaleFactor);
    
    // Compute the centroid
    const centroid = calculateCentroid(polygonCoords);
    
    // Resize the polygon around its centroid
    return polygonCoords.map(point => {
      const dLat = point.lat - centroid.lat;
      const dLng = point.lng - centroid.lng;
      
      return {
        lat: centroid.lat + dLat * scaleFactor,
        lng: centroid.lng + dLng * scaleFactor
      };
    });
  } catch (error) {
    console.error("Error fixing polygon:", error);
    return generateSizeBasedPolygon(lat, lng, size);
  }
};

// Helper to calculate area using shoelace formula
const calculatePolygonAreaInSquareMeters = (polygonCoords) => {
  // Convert lat/lng to meters with Mercator projection
  const earthRadius = 6378137; // meters
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
  
  return Math.abs(area / 2);
};

// Helper to calculate centroid of a polygon
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

export default {
  generatePropertyPolygon,
  generateSizeBasedPolygon,
  generateSimplePolygon,
  calculateRoofSizeFromBuildingSize,
  fixProvidedPolygon
};
