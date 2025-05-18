// src/services/mapsService.js
// This centralizes all Google Maps functionality

// Global loading state to prevent duplicate loading
let mapsLoaded = false;
let loadingPromise = null;

/**
 * Load Google Maps API once and reuse
 * @returns {Promise} Promise that resolves with the Google Maps object
 */
export function loadGoogleMapsApi() {
  if (mapsLoaded) return Promise.resolve(window.google.maps);
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_PUBLIC_KEY;
    
    if (!API_KEY) {
      console.error("Google Maps API key is missing");
      reject(new Error("Google Maps API key is missing"));
      return;
    }

    // Create script element
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places,geometry,drawing`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      console.log("Google Maps API loaded successfully");
      mapsLoaded = true;
      resolve(window.google.maps);
    };
    
    script.onerror = (error) => {
      console.error("Error loading Google Maps API:", error);
      loadingPromise = null;
      reject(error);
    };
    
    document.head.appendChild(script);
  });

  return loadingPromise;
}

/**
 * Initialize a map in the provided container
 * @param {HTMLElement} container - The map container element
 * @param {Object} options - Map options
 * @returns {Promise} - Resolves with map instance
 */
export const initMap = async (container, options = {}) => {
  if (!container) return null;
  
  try {
    const maps = await loadGoogleMapsApi();
    
    const defaultOptions = {
      zoom: 19,
      mapTypeId: 'satellite',
      tilt: 0,
      mapTypeControl: false,
      streetViewControl: false,
      rotateControl: false,
      fullscreenControl: true,
      zoomControlOptions: {
        position: window.google.maps.ControlPosition.RIGHT_TOP
      }
    };
    
    const map = new maps.Map(
      container, 
      { ...defaultOptions, ...options }
    );
    
    return map;
  } catch (error) {
    console.error('Error initializing map:', error);
    throw error;
  }
};

/**
 * Initialize Places Autocomplete
 * @param {HTMLInputElement} inputElement - The input field for address
 * @returns {Promise<google.maps.places.Autocomplete>} - Autocomplete instance
 */
export const initAutocomplete = async (inputElement) => {
  if (!inputElement) return null;
  
  try {
    await loadGoogleMapsApi();
    
    const autocomplete = new window.google.maps.places.Autocomplete(inputElement, {
      types: ['address'],
      componentRestrictions: { country: 'us' }
    });
    
    return autocomplete;
  } catch (error) {
    console.error('Error initializing autocomplete:', error);
    return null;
  }
};

/**
 * Create a polygon on a map
 * @param {google.maps.Map} map - The map instance
 * @param {Array} coordinates - Array of {lat, lng} coordinates
 * @param {Object} options - Polygon options
 * @returns {google.maps.Polygon} The created polygon
 */
export const createPolygon = (map, coordinates, options = {}) => {
  if (!map || !coordinates || coordinates.length < 3) return null;
  
  // Convert coordinates to LatLng objects if they're not already
  const latLngCoords = coordinates.map(coord => {
    if (typeof coord.lat === 'function') {
      return coord; // Already a LatLng object
    }
    return new window.google.maps.LatLng(coord.lat, coord.lng);
  });
  
  const defaultOptions = {
    strokeColor: '#2563EB',
    strokeOpacity: 1.0,
    strokeWeight: 3,
    fillColor: '#2563EB',
    fillOpacity: 0.4,
    zIndex: 100,
    editable: false
  };
  
  const polygon = new window.google.maps.Polygon({
    paths: latLngCoords,
    ...defaultOptions,
    ...options,
    map: map
  });
  
  return polygon;
};

/**
 * Calculate area of a polygon in square feet
 * @param {Array} coordinates - Array of coordinates or google.maps.LatLng objects
 * @returns {number} Area in square feet
 */
export const calculatePolygonArea = (coordinates) => {
  if (!coordinates || coordinates.length < 3 || !window.google?.maps?.geometry?.spherical) {
    return 3000; // Default fallback
  }
  
  try {
    // Convert to LatLng objects if needed
    const latLngCoords = coordinates.map(coord => {
      if (typeof coord.lat === 'function') {
        return coord; // Already a LatLng object
      }
      return new window.google.maps.LatLng(coord.lat, coord.lng);
    });
    
    // Calculate area in square meters
    const areaInSquareMeters = window.google.maps.geometry.spherical.computeArea(latLngCoords);
    
    // Convert to square feet (1 sq meter = 10.7639 sq feet)
    const areaInSquareFeet = Math.round(areaInSquareMeters * 10.7639);
    
    // Validate calculated area
    if (areaInSquareFeet < 500 || areaInSquareFeet > 10000) {
      return 3000; // Return reasonable default for suspicious values
    }
    
    return areaInSquareFeet;
  } catch (error) {
    console.error("Error calculating polygon area:", error);
    return 3000; // Default fallback
  }
};

/**
 * Create estimated polygon based on coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Array} Array of coordinate objects
 */
export const createEstimatedPolygon = (lat, lng) => {
  if (!lat || !lng) return null;
  
  // Convert meters to degrees at the given latitude
  const metersToDegrees = (meters) => {
    const latRad = lat * (Math.PI / 180);
    const latDeg = 111132.92 - 559.82 * Math.cos(2 * latRad) + 1.175 * Math.cos(4 * latRad);
    const lngDeg = 111412.84 * Math.cos(latRad) - 93.5 * Math.cos(3 * latRad);
    return {
      lat: meters / latDeg,
      lng: meters / lngDeg
    };
  };

  // Create an average sized house polygon (about 15-20 meters)
  const conversion = metersToDegrees(18);
  return [
    { lat: lat - conversion.lat * 0.6, lng: lng - conversion.lng * 0.8 }, // SW
    { lat: lat - conversion.lat * 0.6, lng: lng + conversion.lng * 0.8 }, // SE
    { lat: lat + conversion.lat * 0.6, lng: lng + conversion.lng * 0.8 }, // NE
    { lat: lat + conversion.lat * 0.6, lng: lng - conversion.lng * 0.8 }  // NW
  ];
};

/**
 * Setup drawing tools for manual roof outlining
 * @param {google.maps.Map} map - The map instance
 * @param {Function} onComplete - Callback when polygon is completed
 * @returns {google.maps.drawing.DrawingManager} The drawing manager
 */
export const setupDrawingTools = (map, onComplete) => {
  if (!map || !window.google?.maps?.drawing) return null;
  
  const drawingManager = new window.google.maps.drawing.DrawingManager({
    drawingMode: window.google.maps.drawing.OverlayType.POLYGON,
    drawingControl: true,
    drawingControlOptions: {
      position: window.google.maps.ControlPosition.TOP_CENTER,
      drawingModes: [window.google.maps.drawing.OverlayType.POLYGON]
    },
    polygonOptions: {
      fillColor: '#2563EB',
      strokeColor: '#2563EB',
      fillOpacity: 0.4,
      strokeWeight: 3,
      editable: true,
      zIndex: 100
    }
  });

  drawingManager.setMap(map);

  // Listen for polygon complete event
  if (onComplete && typeof onComplete === 'function') {
    window.google.maps.event.addListener(drawingManager, 'polygoncomplete', function(polygon) {
      // Get path array
      const path = polygon.getPath().getArray();
      
      // Calculate area
      const area = calculatePolygonArea(path);
      
      // Call the callback with polygon and area
      onComplete(polygon, area);
      
      // Switch back to non-drawing mode
      drawingManager.setDrawingMode(null);
    });
  }
  
  return drawingManager;
};

export default {
  loadGoogleMapsApi,
  initMap,
  initAutocomplete,
  createPolygon,
  calculatePolygonArea,
  createEstimatedPolygon,
  setupDrawingTools
};
