const googleMapsService = require('../services/googleMapsService');

// Geocode an address to get coordinates
exports.geocodeAddress = async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({
        success: false,
        message: 'Address is required'
      });
    }
    
    // Call Google Maps service to geocode address
    const geocodeResult = await googleMapsService.geocodeAddress(address);
    
    res.json({
      success: true,
      ...geocodeResult
    });
  } catch (error) {
    console.error('Error geocoding address:', error);
    res.status(500).json({
      success: false,
      message: 'Error geocoding address',
      error: error.message
    });
  }
};

// Estimate roof size from coordinates
exports.estimateRoofSize = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }
    
    // Call service to estimate roof size
    const roofSizeResult = await googleMapsService.estimateRoofSize(lat, lng);
    
    res.json({
      success: true,
      ...roofSizeResult
    });
  } catch (error) {
    console.error('Error estimating roof size:', error);
    res.status(500).json({
      success: false,
      message: 'Error estimating roof size',
      error: error.message
    });
  }
};
