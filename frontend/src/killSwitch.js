// src/killSwitch.js
/**
 * Emergency kill switch for problematic features
 */
const killSwitch = {
  // Set to true to completely disable Google Maps
  googleMaps: false,
  
  // Set to true to enable detailed performance logging
  performanceMonitoring: false,
  
  // Set to true to enable debug mode (via URL param ?debug=true)
  debug: window.location.search.includes('debug=true'),
  
  // Set to true to use estimated roof size instead of calculated
  estimatedRoofSize: false
};

// Allow URL parameters to override settings
if (window.location.search.includes('disableMaps=true')) {
  killSwitch.googleMaps = true;
}

if (window.location.search.includes('performance=true')) {
  killSwitch.performanceMonitoring = true;
}

// Log kill switch configuration
console.log("Kill switch configuration:", killSwitch);

// Expose globally for debug access
window.APP_KILL_SWITCH = killSwitch;

export default killSwitch;
