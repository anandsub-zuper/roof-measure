// src/services/googleMapsService.js

// This is a frontend service for Google Maps integration
// It provides methods for client-side maps functionality

/**
 * Initializes Google Maps script
 * @returns {Promise} Resolves when Maps API is loaded
 */
export const loadGoogleMapsScript = () => {
  return new Promise((resolve, reject) => {
    // Check if script is already loaded
    if (window.google && window.google.maps) {
      resolve(window.google.maps);
      return;
    }
    
    // Create script element
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_PUBLIC_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => resolve(window.google.maps);
    script.onerror = (error) => reject(error);
    
    document.head.appendChild(script);
  });
};

/**
 * Initialize autocomplete for an input element
 * @param {HTMLElement} inputElement - The input element
 * @returns {Promise} - Resolves with autocomplete instance
 */
export const initAutocomplete = async (inputElement) => {
  if (!inputElement) return null;
  
  try {
    await loadGoogleMapsScript();
    
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
 * Initialize a map in the provided container
 * @param {HTMLElement} mapContainer - The map container element
 * @param {Object} options - Map options
 * @returns {Promise} - Resolves with map instance
 */
export const initMap = async (mapContainer, options = {}) => {
  if (!mapContainer) return null;
  
  try {
    await loadGoogleMapsScript();
    
    const defaultOptions = {
      zoom: 18,
      mapTypeId: 'satellite',
      tilt: 0,
      mapTypeControl: false,
      streetViewControl: false,
      rotateControl: false,
      fullscreenControl: true
    };
    
    const map = new window.google.maps.Map(
      mapContainer, 
      { ...defaultOptions, ...options }
    );
    
    return map;
  } catch (error) {
    console.error('Error initializing map:', error);
    return null;
  }
};

export default {
  loadGoogleMapsScript,
  initAutocomplete,
  initMap
};
