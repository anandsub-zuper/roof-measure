// controllers/googleMapsController.js
const googleMapsService = require('../services/googleMapsService');
const { logInfo, logError } = require('../utils/logger');

/**
 * Geocode an address to get coordinates
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.geocodeAddress = async (req, res) => {
  try {
    const { address } = req.body;
    
    // Log the incoming request
    logInfo('Geocoding address request', { address });
    
    // Validate required fields
    if (!address) {
      logError('Missing address in geocode request');
      return res.status(400).json({
        success: false,
        message: 'Address is required'
      });
    }
    
    // Call Google Maps service to geocode address
    const geocodeResult = await googleMapsService.geocodeAddress(address);
    
    // Log success
    logInfo('Address geocoded successfully', { 
      address, 
      lat: geocodeResult.lat, 
      lng: geocodeResult.lng 
    });
    
    // Return consistent response format
    return res.json({
      success: true,
      lat: geocodeResult.lat,
      lng: geocodeResult.lng,
      formattedAddress: geocodeResult.formattedAddress,
      city: geocodeResult.city || '',
      state: geocodeResult.state || '',
      zipCode: geocodeResult.zipCode || ''
    });
  } catch (error) {
    // Log the error
    logError('Error geocoding address', { address: req.body.address, error: error.message });
    
    // Return error response with consistent format
    return res.status(500).json({
      success: false,
      message: 'Error geocoding address',
      error: error.message
    });
  }
};

/**
 * Estimate roof size from coordinates
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.estimateRoofSize = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    
    // Log the incoming request
    logInfo('Estimating roof size request', { lat, lng });
    
    // Validate required fields
    if (!lat || !lng) {
      logError('Missing coordinates in roof size request');
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }
    
    // Parse and validate lat/lng as numbers
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      logError('Invalid latitude or longitude', { lat, lng });
      return res.status(400).json({
        success: false,
        message: 'Invalid latitude or longitude format'
      });
    }
    
    // Call service to estimate roof size
    const roofSizeResult = await googleMapsService.estimateRoofSize(latitude, longitude);
    
    // Log success
    logInfo('Roof size estimated successfully', { 
      lat: latitude, 
      lng: longitude, 
      size: roofSizeResult.size 
    });
    
    // Return consistent response format
    return res.json({
      success: true,
      size: roofSizeResult.size,
      accuracy: roofSizeResult.accuracy || 'medium',
      method: roofSizeResult.method || 'satellite',
      roofPolygon: roofSizeResult.roofPolygon || []
    });
  } catch (error) {
    // Log the error
    logError('Error estimating roof size', { 
      lat: req.body.lat, 
      lng: req.body.lng, 
      error: error.message 
    });
    
    // Return error response with consistent format
    return res.status(500).json({
      success: false,
      message: 'Error estimating roof size',
      error: error.message,
      // Always include a fallback size even in error cases
      size: 3000,
      accuracy: 'low',
      method: 'fallback'
    });
  }
};
