const express = require('express');
const router = express.Router();
const mapsController = require('../controllers/googleMapsController');

// Geocode an address to coordinates
router.post('/geocode', mapsController.geocodeAddress);

// Estimate roof size from coordinates
router.post('/roof-size', mapsController.estimateRoofSize);

module.exports = router;
