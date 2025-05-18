// src/config.js
const config = {
  apiUrl: process.env.REACT_APP_API_URL || 'https://roof-measure-5164a9a88417.herokuapp.com',
  googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_PUBLIC_KEY || '',
  isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
};

// Debug environment variables in console
console.log('Config loaded:', {
  apiUrl: config.apiUrl,
  googleMapsApiKey: config.googleMapsApiKey ? 'Present (length: ' + config.googleMapsApiKey.length + ')' : 'Missing',
  env: process.env.NODE_ENV,
  hostname: window.location.hostname
});

// Handle missing API key
if (!config.googleMapsApiKey && process.env.NODE_ENV === 'production') {
  console.error('Google Maps API key is missing! Map functionality will be disabled.');
  // Set a flag we can check elsewhere
  window.googleMapsDisabled = true;
}

export default config;
