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
  if (mapsLoaded && window.google && window.google.maps) {
    console.log("Google Maps already loaded, reusing");
    return Promise.resolve(window.google.maps);
  }
  
  if (loadingPromise) {
    console.log("Google Maps API loading in progress, waiting");
    return loadingPromise;
  }

  console.log("Starting to load Google Maps API");
  loadingPromise = new Promise((resolve, reject) => {
    const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_PUBLIC_KEY;
    
    if (!API_KEY) {
      console.error("Google Maps API key is missing");
      reject(new Error("Google Maps API key is missing"));
      return;
    }

    // Create script element
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places,geometry,drawing&callback=initGoogleMapsCallback`;
    script.async = true;
    script.defer = true;
    
    // Create global callback
    window.initGoogleMapsCallback = function() {
      console.log("Google Maps API loaded successfully via callback");
      mapsLoaded = true;
      resolve(window.google.maps);
      delete window.initGoogleMapsCallback;
    };
    
    script.onerror = (error) => {
      console.error("Error loading Google Maps API:", error);
      loadingPromise = null;
      reject(error);
    };
    
    // Add script to document
    document.head.appendChild(script);
  });

  return loadingPromise;
}

/**
 * Initialize Places Autocomplete
 * @param {HTMLInputElement} inputElement - The input field for address
 * @returns {Promise<google.maps.places.Autocomplete>} - Autocomplete instance
 */
export const initAutocomplete = async (inputElement) => {
  if (!inputElement) return null;
  
  try {
    await loadGoogleMapsApi();
    
    if (!window.google?.maps?.places) {
      console.error("Google Maps Places library not available");
      return null;
    }
    
    console.log("Initializing Places Autocomplete");
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
 * Calculate area of a polygon in square feet
 * @param {Array} coordinates - Array of coordinates or google.maps.LatLng objects
 * @returns {number} Area in square feet
 */
export const calculatePolygonArea = (coordinates) => {
  if (!coordinates || coordinates.length < 3 || !window.google?.maps?.geometry?.spherical) {
    console.warn("Cannot calculate area - no coordinates or Geometry library missing");
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
    
    console.log("Calculated area:", areaInSquareFeet, "sq ft");
    
    // Validate calculated area
    if (areaInSquareFeet < 500 || areaInSquareFeet > 10000) {
      console.warn("Suspicious area calculation:", areaInSquareFeet, "using default");
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
  if (isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) {
    console.error("Invalid coordinates for polygon creation:", { lat, lng });
    return null;
  }
  
  // Parse coordinates to ensure they're numbers
  const validLat = parseFloat(lat);
  const validLng = parseFloat(lng);
  
  // Convert meters to degrees at the given latitude
  const metersToDegrees = (meters) => {
    const latRad = validLat * (Math.PI / 180);
    const latDeg = 111132.92 - 559.82 * Math.cos(2 * latRad) + 1.175 * Math.cos(4 * latRad);
    const lngDeg = 111412.84 * Math.cos(latRad) - 93.5 * Math.cos(3 * latRad);
    return {
      lat: meters / latDeg,
      lng: meters / lngDeg
    };
  };

  // Create an average sized house polygon (about 15-20 meters)
  const conversion = metersToDegrees(18);
  
  // Create polygon with slight irregularities for realism
  return [
    { lat: validLat - conversion.lat * 0.6, lng: validLng - conversion.lng * 0.8 }, // SW
    { lat: validLat - conversion.lat * 0.6, lng: validLng + conversion.lng * 0.8 }, // SE
    { lat: validLat + conversion.lat * 0.6, lng: validLng + conversion.lng * 0.8 }, // NE
    { lat: validLat + conversion.lat * 0.6, lng: validLng - conversion.lng * 0.8 }  // NW
  ];
};

/**
 * Create a polygon on a map
 * @param {google.maps.Map} map - The map instance
 * @param {Array} coordinates - Array of {lat, lng} coordinates
 * @param {Object} options - Polygon options
 * @returns {google.maps.Polygon} The created polygon
 */
export const createPolygon = (map, coordinates, options = {}) => {
  if (!map || !coordinates || coordinates.length < 3) {
    console.error("Cannot create polygon - missing map or coordinates");
    return null;
  }
  
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

export default {
  loadGoogleMapsApi,
  initAutocomplete,
  calculatePolygonArea,
  createEstimatedPolygon,
  createPolygon
};
