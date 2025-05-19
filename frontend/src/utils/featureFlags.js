// src/utils/featureFlags.js
const FEATURE_FLAGS = {
  useLeaflet: true,              // Master toggle for Leaflet functionality
  enableManualRoofEditing: true, // Allow manual editing of roof boundaries
  useTurfMeasurement: true,      // Use Turf.js for measurement calculations
  showMeasurementComparison: true // Show both measurement methods for comparison
};

// Check if specific URL parameters override feature flags
// Example: ?features=useLeaflet:false,useTurfMeasurement:true
const parseUrlFlags = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const featureParam = searchParams.get('features');
  
  if (featureParam) {
    featureParam.split(',').forEach(featureConfig => {
      const [key, value] = featureConfig.split(':');
      if (FEATURE_FLAGS.hasOwnProperty(key)) {
        FEATURE_FLAGS[key] = value.toLowerCase() === 'true';
      }
    });
  }
};

// Parse URL flags on load
if (typeof window !== 'undefined') {
  parseUrlFlags();
}

export default FEATURE_FLAGS;
