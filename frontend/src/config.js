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
  useLeaflet: true,
  useGoogleMaps: true,
  
  // Timeouts
  mapLoadingTimeout: 60000 // 60 seconds
};

// Debug output for troubleshooting
console.log('Config loaded:', {
  apiUrl: config.apiUrl,
  googleMapsApiKey: config.googleMapsApiKey ? 
    `Present (length: ${config.googleMapsApiKey.length})` : 'Missing',
  env: process.env.NODE_ENV,
  hostname: window.location.hostname,
  useLeaflet: config.useLeaflet,
  useGoogleMaps: config.useGoogleMaps
});

// Dynamic library check
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    console.log("Window loaded, checking for mapping libraries:", {
      googleMaps: typeof window.google?.maps !== 'undefined',
      leaflet: typeof window.L !== 'undefined'
    });
  });
}

export default config;
