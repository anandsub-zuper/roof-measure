// src/components/steps/RoofSizeStep.js
import React, { useState, useRef, useEffect } from 'react';
import { Ruler, Camera, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatNumber } from '../../utils/formatters';
import GoogleMapContainer from '../map/GoogleMapContainer';

const RoofSizeStep = ({ formData, updateFormData, nextStep, prevStep }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [calculatedArea, setCalculatedArea] = useState(null);
  const [showManualEntry, setShowManualEntry] = useState(!formData.roofSizeAuto);
  const mapContainerRef = useRef(null);

  // Debug: Log prop changes
  useEffect(() => {
    console.log("RoofSizeStep formData:", {
      lat: formData.lat,
      lng: formData.lng,
      roofSize: formData.roofSize,
      address: formData.address
    });
  }, [formData]);

  // Update roof size with calculated value if auto is enabled
  useEffect(() => {
    if (calculatedArea && formData.roofSizeAuto) {
      updateFormData('roofSize', calculatedArea);
    }
  }, [calculatedArea, formData.roofSizeAuto, updateFormData]);

  // Handle map events
  const handleMapReady = (mapInstance) => {
    console.log("Map ready:", !!mapInstance);
    setLoading(false);
  };

  const handleMapError = (errorMessage) => {
    console.error("Map error:", errorMessage);
    setError(errorMessage);
    setLoading(false);
  };

  // Handle polygon creation and area calculation
  const handlePolygonCreated = (polygon, area) => {
    console.log("Polygon created with area:", area);
    if (area && !isNaN(area)) {
      setCalculatedArea(area);
      if (formData.roofSizeAuto) {
        updateFormData('roofSize', area);
      }
    }
  };

  // Toggle automatic vs manual size
  const handleToggleAutoSize = (e) => {
    const isAuto = e.target.checked;
    updateFormData('roofSizeAuto', isAuto);
    setShowManualEntry(!isAuto);
    
    // If turning on auto calculation and we have a calculated area, use it
    if (isAuto && calculatedArea) {
      updateFormData('roofSize', calculatedArea);
    }
  };

  // Handle manual roof size input
  const handleManualSizeChange = (e) => {
    const value = parseInt(e.target.value, 10);
    updateFormData('roofSize', isNaN(value) ? '' : value);
  };

  // Check if coordinates are valid
  const hasValidCoordinates = () => {
    const lat = parseFloat(formData.lat);
    const lng = parseFloat(formData.lng);
    return !isNaN(lat) && !isNaN(lng);
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-2">Your Roof Details</h2>
      <p className="text-sm text-gray-600 mb-4">{formData.address}</p>
      
      {/* Map Container with Satellite View */}
      <div className="w-full h-64 bg-gray-200 rounded-lg mb-6 relative overflow-hidden">
        {/* Only render the map if we have valid coordinates */}
        {hasValidCoordinates() ? (
          <GoogleMapContainer
            ref={mapContainerRef}
            lat={parseFloat(formData.lat)}
            lng={parseFloat(formData.lng)}
            address={formData.address}
            enableDrawing={true}
            onMapReady={handleMapReady}
            onMapError={handleMapError}
            onPolygonCreated={handlePolygonCreated}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100">
            <Camera size={40} className="mb-2 text-gray-400" />
            <p className="text-gray-500">No coordinates available</p>
            <p className="text-xs text-gray-400 mt-2">
              Coordinates: {JSON.stringify({lat: formData.lat, lng: formData.lng})}
            </p>
          </div>
        )}
        
        {/* Loading or error overlay */}
        {hasValidCoordinates() && (loading || error) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 z-10 bg-white bg-opacity-70">
            {error ? (
              <>
                <Camera size={40} className="mb-2" />
                <p className="text-sm text-red-500">{error}</p>
                <p className="text-xs mt-1">Using estimated roof size</p>
              </>
            ) : (
              <>
                <Camera size={40} className="mb-2" />
                <p className="text-sm">Loading satellite imagery...</p>
              </>
            )}
          </div>
        )}

        {/* Zoom controls */}
        {hasValidCoordinates() && (
          <div className="absolute top-2 right-2 flex flex-col z-20">
            <button
              type="button"
              onClick={() => mapContainerRef.current?.zoomIn?.()}
              className="bg-white w-8 h-8 rounded shadow flex items-center justify-center mb-1"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => mapContainerRef.current?.zoomOut?.()}
              className="bg-white w-8 h-8 rounded shadow flex items-center justify-center"
            >
              -
            </button>
          </div>
        )}

        {hasValidCoordinates() && (
          <div className="absolute bottom-2 left-2 bg-white px-3 py-1 rounded-full text-sm font-medium flex items-center z-20">
            <Ruler size={16} className="mr-1" /> Estimated roof outline
          </div>
        )}
      </div>

      {/* Roof Size Information */}
      <div className="w-full bg-blue-50 p-4 rounded-lg mb-6">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center">
            <Ruler className="text-primary-600 mr-2" size={20} />
            <span className="font-medium">Estimated Roof Size</span>
          </div>
          <span className="text-lg font-bold">{formatNumber(formData.roofSize || 0)} sq ft</span>
        </div>
        
        <p className="text-sm text-gray-600 mb-3">
          Our AI analyzed your roof using satellite imagery. You can also draw your roof outline manually for better accuracy.
        </p>

        {/* Auto/Manual Toggle */}
        <div className="mt-2">
          <label className="flex items-center text-sm text-gray-700">
            <input
              type="checkbox"
              checked={formData.roofSizeAuto}
              onChange={handleToggleAutoSize}
              className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            Use AI-calculated size (recommended)
          </label>
        </div>

        {/* Manual Size Entry */}
        {showManualEntry && (
          <div className="mt-3">
            <label className="block text-sm font-medium mb-1">Manually enter roof size</label>
            <input
              type="number"
              value={formData.roofSize || ''}
              onChange={handleManualSizeChange}
              placeholder="Size in square feet"
              min="500"
              max="10000"
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-300 focus:border-primary-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex w-full justify-between">
        <button
          onClick={prevStep}
          className="bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 flex items-center transition-colors"
        >
          <ChevronLeft size={16} className="mr-1" /> Back
        </button>
        <button
          onClick={nextStep}
          className="bg-primary-600 text-white py-2 px-8 rounded-lg hover:bg-primary-700 flex items-center transition-colors"
        >
          Continue <ChevronRight size={16} className="ml-1" />
        </button>
      </div>
    </div>
  );
};

export default RoofSizeStep;
