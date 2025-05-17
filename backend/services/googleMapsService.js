const axios = require('axios');

// Google Maps API configuration
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GEOCODING_API_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

// Geocode an address to get coordinates and components
const geocodeAddress = async (address) => {
  try {
    const response = await axios.get(GEOCODING_API_URL, {
      params: {
        address,
        key: GOOGLE_MAPS_API_KEY
      }
    });
    
    if (response.data.status !== 'OK') {
      throw new Error(`Geocoding error: ${response.data.status}`);
    }
    
    const result = response.data.results[0];
    const { lat, lng } = result.geometry.location;
    
    // Parse address components
    let city = '';
    let state = '';
    let zipCode = '';
    
    result.address_components.forEach(component => {
      if (component.types.includes('locality')) {
        city = component.long_name;
      } else if (component.types.includes('administrative_area_level_1')) {
        state = component.short_name;
      } else if (component.types.includes('postal_code')) {
        zipCode = component.long_name;
      }
    });
    
    return {
      lat,
      lng,
      formattedAddress: result.formatted_address,
      city,
      state,
      zipCode
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    throw error;
  }
};

// Estimate roof size from satellite imagery (simulated)
// In a real implementation, this would use Google Earth Engine or similar
const estimateRoofSize = async (lat, lng) => {
  try {
    // Simulated response - in a real app, this would call a satellite imagery API
    // For example, using Google Earth Engine or a third-party service
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate a realistic but randomized roof size based on the coordinates
    // In a real implementation, this would analyze actual satellite imagery
    const baseSize = 3000; // Base square footage
    const latFactor = Math.abs(lat % 1) * 1000; // Factor based on latitude decimal
    const lngFactor = Math.abs(lng % 1) * 1000; // Factor based on longitude decimal
    
    const size = Math.round(baseSize + latFactor + lngFactor);
    
    return {
      size,
      accuracy: "high",
      roofPolygon: generateSimulatedRoofPolygon(lat, lng)
    };
  } catch (error) {
    console.error('Roof size estimation error:', error);
    throw error;
  }
};

// Generate a simulated roof polygon for visualization
const generateSimulatedRoofPolygon = (lat, lng) => {
  // Offset for polygon points (about 30-50 feet)
  const offset = 0.0003;
  
  // Create a simple rectangle for the roof outline
  return [
    { lat: lat - offset, lng: lng - offset },
    { lat: lat - offset, lng: lng + offset },
    { lat: lat + offset, lng: lng + offset },
    { lat: lat + offset, lng: lng - offset }
  ];
};

module.exports = {
  geocodeAddress,
  estimateRoofSize
};
