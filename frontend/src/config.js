// src/config.js
const config = {
  // Get API URL from environment variables
  apiUrl: process.env.REACT_APP_API_URL || 
         'https://roof-measure-5164a9a88417.herokuapp.com',
         
  // Get Google Maps API key from environment variables
  googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_PUBLIC_KEY || '',
                    
  isLocalhost: window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1',
               
  // Feature flags
  useLeaflet: process.env.REACT_APP_ENABLE_LEAFLET === 'true' || true
};

// Debug environment variables in console
console.log('Config loaded:', {
  apiUrl: config.apiUrl,
  googleMapsApiKey: config.googleMapsApiKey ? 
    `Present (length: ${config.googleMapsApiKey.length})` : 'Missing',
  env: process.env.NODE_ENV,
  hostname: window.location.hostname,
  useLeaflet: config.useLeaflet
});

// Handle missing API key
if (!config.googleMapsApiKey) {
  console.warn('Google Maps API key is missing - attempting to use Leaflet instead');
  // Don't set window.googleMapsDisabled here, we'll let the components decide based on config.useLeaflet
}

export default config;
