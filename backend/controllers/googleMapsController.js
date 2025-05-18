// controllers/googleMapsController.js
const googleMapsService = require('../services/googleMapsService');
const apiResponse = require('../utils/apiResponse');

/**
 * Geocode an address to get coordinates
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.geocodeAddress = async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return apiResponse.send(res, 
        apiResponse.validationError('Address is required')
      );
    }
    
    // Call Google Maps service to geocode address
    const geocodeResult = await googleMapsService.geocodeAddress(address);
    
    apiResponse.send(res, 
      apiResponse.success('Address geocoded successfully', geocodeResult)
    );
  } catch (error) {
    console.error('Error geocoding address:', error);
    apiResponse.send(res, 
      apiResponse.error('Error geocoding address', error)
    );
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
    
    if (!lat || !lng) {
      return apiResponse.send(res, 
        apiResponse.validationError('Latitude and longitude are required')
      );
    }
    
    // Parse as numbers and validate
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      return apiResponse.send(res, 
        apiResponse.validationError('Invalid latitude or longitude')
      );
    }
    
    // Call service to estimate roof size
    const roofSizeResult = await googleMapsService.estimateRoofSize(latitude, longitude);
    
    apiResponse.send(res, 
      apiResponse.success('Roof size estimated successfully', roofSizeResult)
    );
  } catch (error) {
    console.error('Error estimating roof size:', error);
    apiResponse.send(res, 
      apiResponse.error('Error estimating roof size', error)
    );
  }
};
