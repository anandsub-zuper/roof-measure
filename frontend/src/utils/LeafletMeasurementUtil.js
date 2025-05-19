// src/utils/LeafletMeasurementUtil.js
import * as turf from '@turf/turf';

/**
 * Utility class for accurate measurement calculations using Turf.js
 */
class LeafletMeasurementUtil {
  /**
   * Calculate polygon area in square feet with adjustments for roof pitch
   * @param {Array} coordinates - Array of {lat, lng} coordinates
   * @param {string} pitch - Roof pitch (flat, low, moderate, steep)
   * @param {string} roofType - Type of roof (simple, complex)
   * @returns {number} - Area in square feet
   */
  static calculateRoofArea(coordinates, pitch = 'moderate', roofType = 'simple') {
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 3) {
      console.warn("Invalid coordinates for area calculation");
      return 0;
    }
    
    try {
      // Convert to GeoJSON format - Turf expects [lng, lat] order
      let polygonCoords = coordinates.map(coord => [coord.lng, coord.lat]);
      
      // Check if polygon is closed
      const firstPoint = polygonCoords[0];
      const lastPoint = polygonCoords[polygonCoords.length - 1];
      
      if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
        // Close the polygon
        polygonCoords.push(firstPoint);
      }
      
      // Create Turf.js polygon
      const polygon = turf.polygon([polygonCoords]);
      
      // Calculate area in square meters
      const areaInSquareMeters = turf.area(polygon);
      
      // Convert to square feet (1 sq meter = 10.7639 sq feet)
      let areaInSquareFeet = areaInSquareMeters * 10.7639;
      
      // Apply pitch factor
      const pitchFactors = {
        'flat': 1.05,
        'low': 1.15,
        'moderate': 1.35,
        'steep': 1.6
      };
      
      // Apply complexity factor
      const complexityFactors = {
        'simple': 1.0,
        'complex': 1.15
      };
      
      // Apply pitch adjustment
      const pitchFactor = pitchFactors[pitch] || pitchFactors.moderate;
      const complexityFactor = complexityFactors[roofType] || complexityFactors.simple;
      
      // Calculate adjusted area
      const adjustedArea = Math.round(areaInSquareFeet * pitchFactor * complexityFactor);
      
      console.log("Roof area calculation:", {
        baseAreaSqFt: Math.round(areaInSquareFeet),
        pitchFactor,
        complexityFactor,
        adjustedArea
      });
      
      return adjustedArea;
    } catch (error) {
      console.error("Error calculating roof area:", error);
      return 0;
    }
  }
  
  /**
   * Generate polygon coordinates for a roof of specified size
   * @param {number} lat - Center latitude
   * @param {number} lng - Center longitude
   * @param {number} targetArea - Target roof area in sq ft
   * @param {number} aspectRatio - Rectangle aspect ratio (width:length)
   * @returns {Array} - Array of {lat, lng} coordinates
   */
  static generateRoofPolygon(lat, lng, targetArea, aspectRatio = 1.5) {
    // Convert sq ft to sq meters
    const targetAreaSqM = targetArea / 10.7639;
    
    // Calculate width and length
    const width = Math.sqrt(targetAreaSqM / aspectRatio);
    const length = width * aspectRatio;
    
    // Create a rectangular polygon
    const polygonFeature = turf.polygon([[
      [lng - width/2, lat - length/2],
      [lng + width/2, lat - length/2],
      [lng + width/2, lat + length/2],
      [lng - width/2, lat + length/2],
      [lng - width/2, lat - length/2]
    ]]);
    
    // Scale to match target area (turf.transformScale not working as expected for exact areas)
    const actualArea = turf.area(polygonFeature);
    const scaleFactor = Math.sqrt(targetAreaSqM / actualArea);
    
    // Apply scaling using turf.transformScale
    const scaledPolygon = turf.transformScale(polygonFeature, scaleFactor);
    
    // Convert back to {lat, lng} format
    const coordinates = scaledPolygon.geometry.coordinates[0].map(coord => ({
      lng: coord[0],
      lat: coord[1]
    }));
    
    // Remove the last coordinate (which closes the polygon)
    return coordinates.slice(0, -1);
  }
  
  /**
   * Adjust a polygon to match a target area
   * @param {Array} coordinates - Array of {lat, lng} coordinates
   * @param {number} targetArea - Target area in sq ft
   * @returns {Array} - Adjusted array of {lat, lng} coordinates
   */
  static adjustPolygonToArea(coordinates, targetArea) {
    if (!coordinates || coordinates.length < 3 || !targetArea) {
      return coordinates;
    }
    
    try {
      // Convert to GeoJSON format
      const polygonCoords = coordinates.map(coord => [coord.lng, coord.lat]);
      
      // Create a closed polygon
      if (polygonCoords[0][0] !== polygonCoords[polygonCoords.length-1][0] || 
          polygonCoords[0][1] !== polygonCoords[polygonCoords.length-1][1]) {
        polygonCoords.push(polygonCoords[0]);
      }
      
      // Create Turf.js polygon
      const polygon = turf.polygon([polygonCoords]);
      
      // Calculate current area in square meters
      const currentArea = turf.area(polygon);
      const targetAreaSqM = targetArea / 10.7639;
      
      // Calculate scale factor
      const scaleFactor = Math.sqrt(targetAreaSqM / currentArea);
      
      // Apply scaling
      const scaledPolygon = turf.transformScale(polygon, scaleFactor);
      
      // Convert back to {lat, lng} format
      return scaledPolygon.geometry.coordinates[0].slice(0, -1).map(coord => ({
        lng: coord[0],
        lat: coord[1]
      }));
    } catch (error) {
      console.error("Error adjusting polygon:", error);
      return coordinates;
    }
  }
  
  /**
   * Calculate the center point of a polygon
   * @param {Array} coordinates - Array of {lat, lng} coordinates
   * @returns {Object} - {lat, lng} center point
   */
  static calculatePolygonCenter(coordinates) {
    if (!coordinates || coordinates.length < 3) {
      return null;
    }
    
    try {
      // Convert to GeoJSON format
      const polygonCoords = coordinates.map(coord => [coord.lng, coord.lat]);
      
      // Create a closed polygon
      if (polygonCoords[0][0] !== polygonCoords[polygonCoords.length-1][0] || 
          polygonCoords[0][1] !== polygonCoords[polygonCoords.length-1][1]) {
        polygonCoords.push(polygonCoords[0]);
      }
      
      // Create Turf.js polygon
      const polygon = turf.polygon([polygonCoords]);
      
      // Calculate centroid
      const centroid = turf.centroid(polygon);
      
      // Return as {lat, lng}
      return {
        lat: centroid.geometry.coordinates[1],
        lng: centroid.geometry.coordinates[0]
      };
    } catch (error) {
      console.error("Error calculating polygon center:", error);
      
      // Fallback to simple average
      let latSum = 0, lngSum = 0;
      coordinates.forEach(coord => {
        latSum += coord.lat;
        lngSum += coord.lng;
      });
      
      return {
        lat: latSum / coordinates.length,
        lng: lngSum / coordinates.length
      };
    }
  }
}

export default LeafletMeasurementUtil;
