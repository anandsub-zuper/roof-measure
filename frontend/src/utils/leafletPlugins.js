// src/utils/leafletPlugins.js
/**
 * Helper file to load Leaflet plugins when the CDN approach is used
 */

// Check if window and L are available (browser environment)
if (typeof window !== 'undefined' && window.L) {
  // Load Leaflet Draw dynamically if not already loaded
  if (!window.L.Control.Draw) {
    console.log('Loading Leaflet Draw plugin from CDN...');
    const drawScript = document.createElement('script');
    drawScript.src = 'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js';
    drawScript.async = true;
    document.head.appendChild(drawScript);
  }
  
  // Load Leaflet Measure dynamically if not already loaded
  if (!window.L.Control.Measure) {
    console.log('Loading Leaflet Measure plugin from CDN...');
    const measureScript = document.createElement('script');
    measureScript.src = 'https://cdn.jsdelivr.net/npm/leaflet-measure@3.1.0/dist/leaflet-measure.min.js';
    measureScript.async = true;
    document.head.appendChild(measureScript);
  }
}

// Export placeholder functions to use while waiting for plugins to load
export const initLeafletDraw = (map, options = {}) => {
  return new Promise((resolve) => {
    // Check if Leaflet Draw is already loaded
    if (window.L && window.L.Control.Draw) {
      resolve(window.L.Control.Draw);
      return;
    }
    
    // Wait for Leaflet Draw to load
    const checkInterval = setInterval(() => {
      if (window.L && window.L.Control.Draw) {
        clearInterval(checkInterval);
        resolve(window.L.Control.Draw);
      }
    }, 100);
    
    // Set a timeout to prevent infinite waiting
    setTimeout(() => {
      clearInterval(checkInterval);
      console.warn('Leaflet Draw failed to load in time');
      resolve(null);
    }, 5000);
  });
};

export const initLeafletMeasure = (map, options = {}) => {
  return new Promise((resolve) => {
    // Check if Leaflet Measure is already loaded
    if (window.L && window.L.Control.Measure) {
      resolve(window.L.Control.Measure);
      return;
    }
    
    // Wait for Leaflet Measure to load
    const checkInterval = setInterval(() => {
      if (window.L && window.L.Control.Measure) {
        clearInterval(checkInterval);
        resolve(window.L.Control.Measure);
      }
    }, 100);
    
    // Set a timeout to prevent infinite waiting
    setTimeout(() => {
      clearInterval(checkInterval);
      console.warn('Leaflet Measure failed to load in time');
      resolve(null);
    }, 5000);
  });
};

export default {
  initLeafletDraw,
  initLeafletMeasure
};
