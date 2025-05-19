// src/utils/coordinateConverters.js
/**
 * Utility functions to convert between different coordinate formats
 */

/**
 * Convert Google Maps LatLng objects to simple {lat, lng} format
 * @param {google.maps.LatLng} googleLatLng - Google Maps LatLng object
 * @returns {Object} - Simple {lat, lng} object
 */
export const googleToSimple = (googleLatLng) => {
  if (!googleLatLng) return null;
  return {
    lat: googleLatLng.lat(),
    lng: googleLatLng.lng()
  };
};

/**
 * Convert Google Maps polygon path to array of {lat, lng} points
 * @param {google.maps.MVCArray} path - Google Maps polygon path
 * @returns {Array} - Array of {lat, lng} points
 */
export const googlePathToArray = (path) => {
  if (!path) return [];
  
  const points = [];
  for (let i = 0; i < path.getLength(); i++) {
    points.push(googleToSimple(path.getAt(i)));
  }
  return points;
};

/**
 * Convert simple {lat, lng} format to Leaflet LatLng object
 * @param {Object} point - Simple {lat, lng} object
 * @returns {L.LatLng} - Leaflet LatLng object
 */
export const simpleToLeaflet = (point) => {
  if (!point || !window.L) return null;
  return new L.LatLng(point.lat, point.lng);
};

/**
 * Convert array of simple points to Leaflet format for polygons
 * @param {Array} points - Array of {lat, lng} points
 * @returns {Array} - Array of [lat, lng] arrays for Leaflet
 */
export const simpleArrayToLeafletFormat = (points) => {
  if (!points || !Array.isArray(points)) return [];
  return points.map(point => [point.lat, point.lng]);
};

/**
 * Convert Leaflet LatLng to simple {lat, lng} format
 * @param {L.LatLng} leafletLatLng - Leaflet LatLng object
 * @returns {Object} - Simple {lat, lng} object
 */
export const leafletToSimple = (leafletLatLng) => {
  if (!leafletLatLng) return null;
  return {
    lat: leafletLatLng.lat,
    lng: leafletLatLng.lng
  };
};

export default {
  googleToSimple,
  googlePathToArray,
  simpleToLeaflet,
  simpleArrayToLeafletFormat,
  leafletToSimple
};
