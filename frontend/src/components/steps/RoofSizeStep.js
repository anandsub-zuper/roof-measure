// src/components/steps/RoofSizeStep.js
import React, { useState, useRef, useEffect } from 'react';
import { Ruler, Camera, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatNumber } from '../../utils/formatters';
import GoogleMapContainer from '../map/GoogleMapContainer';
import config from '../../config'; // Import the config file

const RoofSizeStep = ({ formData, updateFormData, nextStep, prevStep }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [skipMap, setSkipMap] = useState(false);
  const [mapDisabled, setMapDisabled] = useState(false);
  const mapContainerRef = useRef(null);
  
  console.log("RoofSizeStep rendering with formData:", {
    lat: formData.lat,
    lng: formData.lng,
    roofSize: formData.roofSize
  });

  // Check if Google Maps is disabled due to missing API key
  useEffect(() => {
    // Check for the flag set in config.js
    if (window.googleMapsDisabled) {
      console.log("Maps disabled due to missing API key, skipping map view");
      setMapDisabled(true);
      setLoading(false);
      
      // Set a default roof size if needed
      if (!formData.roofSize) {
        updateFormData('roofSize', 3000);
      }
    }
    
    // Fallback timeout - if loading doesn't complete in 15 seconds, force skip
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.log("Map loading timeout reached, skipping map");
        setSkipMap(true);
        setLoading(false);
        
        // Set a default roof size if needed
        if (!formData.roofSize) {
          updateFormData('roofSize', 3000);
        }
      }
    }, 15000);
    
    return () => clearTimeout(timeoutId);
  }, [formData.roofSize, loading, updateFormData]);

  // Handle map events
  const handleMapReady = () => {
    console.log("Map ready event received");
    setLoading(false);
  };

  const handleMapError = (errorMessage) => {
    console.error("Map error:", errorMessage);
    setError(errorMessage);
    setLoading(false);
    
    // If we get a map error, set a reasonable default roof size if none exists
    if (!formData.roofSize || formData.roofSize === '') {
      updateFormData('roofSize', 3000);
    }
  };

  // Handle polygon creation with fallback
  const handlePolygonCreated = (polygon, area) => {
    console.log("Polygon created with area:", area);
    
    if (formData.roofSizeAuto) {
      const areaValue = area || formData.roofSize || 2500;
      console.log("Updating roof size to:", areaValue);
      updateFormData('roofSize', areaValue);
    }
  };

  // Toggle automatic/manual size
  const handleToggleAutoSize = (e) => {
    const isAuto = e.target.checked;
    updateFormData('roofSizeAuto', isAuto);
  };

  // Handle manual roof size input
  const handleManualSizeChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0) {
      updateFormData('roofSize', value);
    }
  };

  // Check if we have valid coordinates
  const hasValidCoordinates = () => {
    try {
      const lat = parseFloat(formData.lat);
      const lng = parseFloat(formData.lng);
      return !isNaN(lat) && !isNaN(lng);
    } catch (e) {
      console.error("Error parsing coordinates:", e);
      return false;
    }
  };

  const handleSkipMap = () => {
    console.log("User manually skipped map view");
    setSkipMap(true);
    
    // Set a default roof size if none exists
    if (!formData.roofSize || formData.roofSize === '') {
      updateFormData('roofSize', 3000);
    }
    
    setLoading(false);
  };

  // Debug function for environment variables  
  const debugEnvironment = () => {
    console.log("Environment check:", {
      googleMapsKey: config.googleMapsApiKey ? "Present (first 4 chars: " + config.googleMapsApiKey.substring(0,4) + "...)" : "Missing",
      apiUrl: config.apiUrl,
      mapDisabled: mapDisabled,
      skipMap: skipMap,
      formDataRoofSize: formData.roofSize
    });
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-2">Your Roof Details</h2>
      <p className="text-sm text-gray-600 mb-4">{formData.address}</p>
      
      {/* Debug button - only in development */}
      {process.env.NODE_ENV === 'development' && (
        <button 
          onClick={debugEnvironment}
          className="mb-2 text-xs text-gray-400 hover:text-gray-600"
        >
          Debug Environment
        </button>
      )}
    <div className="w-full h-64 bg-gray-200 rounded-lg mb-6 relative overflow-hidden">
  {hasValidCoordinates() && !skipMap && !mapDisabled && !killSwitch.googleMaps ? (
    <GoogleMapContainer
      ref={mapContainerRef}
      lat={formData.lat}
      lng={formData.lng}
      address={formData.address}
      onMapReady={handleMapReady}
      onMapError={handleMapError}
      onPolygonCreated={handlePolygonCreated}
    />
  ) : hasValidCoordinates() ? (
    <DummyMapContainer
      ref={mapContainerRef}
      lat={parseFloat(formData.lat)}
      lng={parseFloat(formData.lng)}
      address={formData.address}
      onMapReady={handleMapReady}
      onPolygonCreated={handlePolygonCreated}
    />
  ) : (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100">
      <Camera size={40} className="mb-2 text-gray-400" />
      <p className="text-gray-500">No coordinates available</p>
    </div>
  )}
        
        {/* Loading overlay */}
        {hasValidCoordinates() && loading && !error && !skipMap && !mapDisabled && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 z-10 bg-white bg-opacity-70">
            <Camera size={40} className="mb-2" />
            <p className="text-sm">Loading satellite imagery...</p>
            <button 
              onClick={handleSkipMap} 
              className="mt-4 text-xs text-blue-500 hover:text-blue-700 underline"
            >
              Skip map view
            </button>
          </div>
        )}
        
        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500 z-10 bg-white bg-opacity-70">
            <Camera size={40} className="mb-2" />
            <p className="text-sm">Error: {error}</p>
            <p className="text-xs mt-1">Using estimated roof size</p>
          </div>
        )}

        {/* Zoom controls */}
        {hasValidCoordinates() && !loading && !skipMap && !mapDisabled && !error && (
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

        {hasValidCoordinates() && !loading && !skipMap && !mapDisabled && !error && (
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
          {skipMap || error || mapDisabled ? 
            "Using estimated roof size based on property data." : 
            "Our AI analyzed your roof using satellite imagery."}
          {" You can also enter the size manually."}
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
            Use {skipMap || error || mapDisabled ? "estimated" : "AI-calculated"} size (recommended)
          </label>
        </div>

        {/* Manual Size Entry (always visible) */}
        <div className="mt-3">
          <label className="block text-sm font-medium mb-1">Enter roof size manually</label>
          <input
            type="number"
            value={formData.roofSize || ''}
            onChange={handleManualSizeChange}
            disabled={formData.roofSizeAuto}
            placeholder="Size in square feet"
            min="500"
            max="10000"
            className={`w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-300 focus:border-primary-500 focus:outline-none ${formData.roofSizeAuto ? 'bg-gray-100' : ''}`}
          />
        </div>
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
