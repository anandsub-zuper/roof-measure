// src/killSwitch.js
// Emergency kill switch for problematic features
const killSwitch = {
  googleMaps: true,  // Set to true to completely disable Google Maps
  debug: window.location.search.includes('debug=true')
};

console.log("Kill switch configuration:", killSwitch);

// Expose globally for debug access
window.APP_KILL_SWITCH = killSwitch;

export default killSwitch;
