// src/utils/propertyPolygonGenerator.js

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
    return generateSimplePolygon(lat, lng, 2500, 1.8);
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
  let scaleFactor = 1.8; // Default
  let aspectRatio = 1.5; // Default
  
  // Adjust scaling based on building type
  if (typeInfo.isSingleFamily) {
    // Single family homes
    scaleFactor = 1.8;
    aspectRatio = 1.4;
  } else if (typeInfo.isTownhouse) {
    // Townhouses are narrower and longer
    scaleFactor = 1.75;
    aspectRatio = 2.2;
  } else if (typeInfo.isMultiFamily || typeInfo.isApartment) {
    // Multi-family buildings often have complex shapes
    // Use a slightly larger scale factor
    scaleFactor = 1.9;
    aspectRatio = 1.6;
  } else if (typeInfo.isCommercial || typeInfo.isIndustrial) {
    // Commercial buildings tend to be larger and more square
    scaleFactor = 1.6;
    aspectRatio = 1.2;
  } else if (typeInfo.isWarehouse || typeInfo.isStorage) {
    // Warehouses are very rectangular
    scaleFactor = 1.5;
    aspectRatio = 2.5;
  }
  
  // Adjust for multi-story buildings
  // Typically, higher buildings have smaller footprints relative to total square footage
  if (stories > 1) {
    // Reduce the size per story, but not linearly
    // A 3-story building doesn't have 1/3 the footprint
    const adjustedSize = size / Math.sqrt(stories);
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
    const posAdjustment = 0.15;
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
  const posAdjustment = 0.15;
  const adjustedLat = lat + (latOffset * posAdjustment);
  
  // Create complex polygons for certain building types
  if ((typeInfo.isMultiFamily || typeInfo.isApartment) && size > 3000) {
    // Multi-family large buildings often have L shapes
    // Use a deterministic approach to decide shape orientation based on coordinates
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
  
  // Apply a scale factor for visual representation
  let scaleFactor = 1.8; // Default
  
  // Adjust scaling based on size categories 
  if (size < 1200) {
    scaleFactor = 2.0; // Small buildings need more relative scaling
  } else if (size >= 1200 && size < 3000) {
    scaleFactor = 1.9; // Medium buildings
  } else if (size >= 3000 && size < 5000) {
    scaleFactor = 1.8; // Large buildings
  } else {
    scaleFactor = 1.7; // Very large buildings
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
  
  // Position adjustment
  const posAdjustment = 0.15;
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
export const generateSimplePolygon = (lat, lng, size = 2500, scaleFactor = 1.8) => {
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
  
  // Position adjustment
  const adjustedLat = lat + (latOffset * 0.15);
  
  // Create rectangle
  return [
    { lat: adjustedLat - latOffset, lng: lng - lngOffset },
    { lat: adjustedLat - latOffset, lng: lng + lngOffset },
    { lat: adjustedLat + latOffset, lng: lng + lngOffset },
    { lat: adjustedLat + latOffset, lng: lng - lngOffset }
  ];
};

/**
 * Calculate the actual roof size based on building characteristics
 * @param {number} buildingSize - Building square footage
 * @param {Object} propertyData - Property data
 * @returns {number} - Estimated actual roof size
 */
export const calculateRoofSizeFromBuildingSize = (buildingSize, propertyData) => {
  if (!buildingSize) return null;
  
  let stories = 1;
  let roofType = 'unknown';
  
  if (propertyData) {
    stories = propertyData.stories || 1;
    roofType = (propertyData.roofType || 'unknown').toLowerCase();
  }
  
  // Adjust building size by stories to get footprint
  let footprint = buildingSize / stories;
  
  // Include some overlap for multi-story buildings
  if (stories > 1) {
    // Add 5% per additional story for stairwells, multi-level spaces, etc.
    footprint *= (1 + ((stories - 1) * 0.05));
  }
  
  // Adjust based on roof type
  const roofFactors = {
    'flat': 1.05,      // 5% more than footprint for drainage
    'gable': 1.15,     // 15% more than footprint due to pitch
    'hip': 1.18,       // 18% more than footprint due to multiple slopes
    'mansard': 1.35,   // 35% more due to steep double slopes
    'gambrel': 1.20,   // 20% more for barn-style
    'shed': 1.08,      // 8% more for single slope
    'unknown': 1.12    // Default assumed pitch adjustment
  };
  
  const roofFactor = roofFactors[roofType] || roofFactors.unknown;
  
  // Calculate final roof size
  return Math.round(footprint * roofFactor);
};

export default {
  generatePropertyPolygon,
  generateSizeBasedPolygon,
  generateSimplePolygon,
  calculateRoofSizeFromBuildingSize
};
