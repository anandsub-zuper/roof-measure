// src/services/mapsService.js
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
    const API_KEY = (typeof window !== 'undefined' && window.googleMapsApiKey) || 
                  process.env.REACT_APP_GOOGLE_MAPS_PUBLIC_KEY;
    
    
  if (!API_KEY) {
    console.error("Google Maps API key is missing in environment variables and window object.");
    console.log("Env variables available:", Object.keys(process.env).filter(key => key.startsWith('REACT_APP_')));
    console.log("Window API key:", typeof window !== 'undefined' ? (window.googleMapsApiKey ? "Present" : "Missing") : "Window not available");
    reject(new Error("Google Maps API key is missing. Check your environment variables or index.html."));
    return;
  }

    console.log("Google Maps API Key:", API_KEY ? "Present (first 4 chars: " + API_KEY.substring(0,4) + "...)" : "MISSING");

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
    
    // Add timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      if (!window.google || !window.google.maps) {
        console.error("Google Maps API loading timed out");
        loadingPromise = null;
        reject(new Error("Google Maps API loading timed out after 10 seconds"));
      }
    }, 10000);
    
    // Add script to document
    document.head.appendChild(script);
    
    // Clean up timeout when loaded
    script.onload = () => {
      clearTimeout(timeoutId);
      // Note: we don't resolve here - we wait for the callback
    };
  });

  return loadingPromise;
}

/**
 * Initialize Places Autocomplete
 * @param {HTMLInputElement} inputElement - The input field for address
 * @returns {Promise<google.maps.places.Autocomplete>} - Autocomplete instance
 */
export const initAutocomplete = async (inputElement) => {
  if (!inputElement) {
    console.error("No input element provided for autocomplete");
    return null;
  }
  
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

// Rest of mapsService.js remains the same
// Keep all other functions from the original file
