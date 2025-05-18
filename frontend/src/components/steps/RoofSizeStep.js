// src/components/steps/RoofSizeStep.js
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Ruler, Camera, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatNumber } from '../../utils/formatters';
import GoogleMapContainer from '../map/GoogleMapContainer';
import config from '../../config';
import killSwitch from '../../killSwitch';
import { debounce } from '../../utils/debounce'; // Make sure this path is correct
import performanceMonitor from '../../utils/performance'; // Make sure this path is correct

const RoofSizeStep = ({ formData, updateFormData, nextStep, prevStep }) => {
  const renderTime = performance.now();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [skipMap, setSkipMap] = useState(false);
  const [mapDisabled, setMapDisabled] = useState(false);
  const [localRoofSize, setLocalRoofSize] = useState(formData.roofSize || '');
  const mapContainerRef = useRef(null);
  const prevSizeRef = useRef(formData.roofSize);
  
  // Debug logging
  useEffect(() => {
    console.log("RoofSizeStep rendering with formData:", {
      lat: formData.lat,
      lng: formData.lng,
      roofSize: formData.roofSize
    });
    
    // Track component performance
    if (performanceMonitor && performanceMonitor.trackComponent) {
      performanceMonitor.trackComponent('RoofSizeStep', performance.now() - renderTime);
    }
    
    // Check memory usage occasionally
    if (performanceMonitor && performanceMonitor.checkMemory) {
      performanceMonitor.checkMemory();
    }
  }, [formData.lat, formData.lng, formData.roofSize, renderTime]);

  // Create a debounced update function for roof size
  const debouncedUpdateRoofSize = useCallback(
    debounce ? debounce((value) => {
      updateFormData('roofSize', value);
    }, 300) : (value) => updateFormData('roofSize', value),
    [updateFormData]
  );

  // Check if Google Maps is disabled due to missing API key
  useEffect(() => {
    // Check for the flag set in config.js
    if (window.googleMapsDisabled || (killSwitch && killSwitch.googleMaps)) {
      console.log("Maps disabled, skipping map view");
      setMapDisabled(true);
      setLoading(false);
      
      // Set a default roof size if needed
      if (!formData.roofSize) {
        setLocalRoofSize(3000);
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
          setLocalRoofSize(3000);
          updateFormData('roofSize', 3000);
        }
      }
    }, 15000);
    
    return () => clearTimeout(timeoutId);
  }, [formData.roofSize, loading, updateFormData]);

  // Sync local state with form data
  useEffect(() => {
    if (formData.roofSize !== prevSizeRef.current) {
      setLocalRoofSize(formData.roofSize);
      prevSizeRef.current = formData.roofSize;
    }
  }, [formData.roofSize]);

  // Handle map events - optimized with useCallback
  const handleMapReady = useCallback(() => {
    console.log("Map ready event received");
    setLoading(false);
  }, []);

  const handleMapError = useCallback((errorMessage) => {
    console.error("Map error:", errorMessage);
    setError(errorMessage);
    setLoading(false);
    
    // If we get a map error, set a reasonable default roof size if none exists
    if (!formData.roofSize) {
      setLocalRoofSize(3000);
      updateFormData('roofSize', 3000);
    }
  }, [formData.roofSize, updateFormData]);

  // Handle polygon creation with fallback - optimized with useCallback
  const handlePolygonCreated = useCallback((polygon, area) => {
    if (performanceMonitor && performanceMonitor.start) {
      performanceMonitor.start('polygonAreaCalc');
    }
    
    console.log("Polygon created with area:", area);
    
    if (formData.roofSizeAuto) {
      const areaValue = area || formData.roofSize || 2500;
      console.log("Updating roof size to:", areaValue);
      setLocalRoofSize(areaValue);
      debouncedUpdateRoofSize(areaValue);
    }
    
    if (performanceMonitor && performanceMonitor.end) {
      performanceMonitor.end('polygonAreaCalc');
    }
  }, [formData.roofSize, formData.roofSizeAuto, debouncedUpdateRoofSize]);

  // Toggle automatic/manual size - optimized with useCallback
  const handleToggleAutoSize = useCallback((e) => {
    const isAuto = e.target.checked;
    updateFormData('roofSizeAuto', isAuto);
  }, [updateFormData]);

  // Handle manual roof size input - optimized with useCallback and local state
  const handleManualSizeChange = useCallback((e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0) {
      setLocalRoofSize(value);
      
      if (!formData.roofSizeAuto) {
        debouncedUpdateRoofSize(value);
      }
    } else {
      setLocalRoofSize(e.target.value);
    }
  }, [formData.roofSizeAuto, debouncedUpdateRoofSize]);

  // Check if we have valid coordinates - optimized with useCallback
  const hasValidCoordinates = useCallback(() => {
    try {
      const lat = parseFloat(formData.lat);
      const lng = parseFloat(formData.lng);
      return !isNaN(lat) && !isNaN(lng);
    } catch (e) {
      console.error("Error parsing coordinates:", e);
      return false;
    }
  }, [formData.lat, formData.lng]);

  const handleSkipMap = useCallback(() => {
    console.log("User manually skipped map view");
    setSkipMap(true);
    
    // Set a default roof size if none exists
    if (!formData.roofSize) {
      setLocalRoofSize(3000);
      updateFormData('roofSize', 3000);
    }
    
    setLoading(false);
  }, [formData.roofSize, updateFormData]);

  // Debug function for environment variables
  const debugEnvironment = useCallback(() => {
    console.log("Environment check:", {
      googleMapsKey: config.googleMapsApiKey ? "Present (first 4 chars: " + config.googleMapsApiKey.substring(0,4) + "...)" : "Missing",
      apiUrl: config.apiUrl,
      mapDisabled: mapDisabled,
      skipMap: skipMap,
      formDataRoofSize: formData.roofSize,
      localRoofSize: localRoofSize
    });
  }, [mapDisabled, skipMap, formData.roofSize, localRoofSize]);

  // Memoize coordinates for map
  const coordinates = useMemo(() => {
    if (hasValidCoordinates()) {
      return {
        lat: parseFloat(formData.lat),
        lng: parseFloat(formData.lng)
      };
    }
    return null;
  }, [formData.lat, formData.lng, hasValidCoordinates]);

  // Determine which map component to render - wrapped in useMemo
  const mapComponent = useMemo(() => {
    if (!coordinates) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100">
          <Camera size={40} className="mb-2 text-gray-400" />
          <p className="text-gray-500">No coordinates available</p>
          <p className="text-xs text-gray-400 mt-2">
            {JSON.stringify({lat: formData.lat, lng: formData.lng})}
          </p>
        </div>
      );
    }
    
    if (skipMap || mapDisabled || (killSwitch && killSwitch.googleMaps)) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100">
          <Camera size={40} className="mb-2 text-gray-400" />
          <p className="text-gray-500">
            {mapDisabled ? "Map view disabled" : "Map view skipped"}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Using estimated roof size
          </p>
        </div>
      );
    }
    
    return (
      <GoogleMapContainer
        ref={mapContainerRef}
        lat={coordinates.lat}
        lng={coordinates.lng}
        address={formData.address}
        roofSize={formData.roofSize} // CRITICAL: Pass the backend roof size
        onMapReady={handleMapReady}
        onMapError={handleMapError}
        onPolygonCreated={handlePolygonCreated}
      />
    );
  }, [
    coordinates, skipMap, mapDisabled, formData.address, formData.roofSize,
    handleMapReady, handleMapError, handlePolygonCreated, killSwitch
  ]);

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
      
      {/* Map Container with Satellite View */}
      <div className="w-full h-64 bg-gray-200 rounded-lg mb-6 relative overflow-hidden">
        {/* Render the memoized map component */}
        {mapComponent}
        
        {/* Loading overlay */}
        {coordinates && loading && !error && !skipMap && !mapDisabled && !(killSwitch && killSwitch.googleMaps) && (
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

        {/* Zoom controls - only show when map is loaded and visible */}
        {coordinates && !loading && !skipMap && !mapDisabled && !error && !(killSwitch && killSwitch.googleMaps) && (
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

        {coordinates && !loading && !skipMap && !mapDisabled && !error && !(killSwitch && killSwitch.googleMaps) && (
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
          <span className="text-lg font-bold">{formatNumber(localRoofSize || 0)} sq ft</span>
        </div>
        
        <p className="text-sm text-gray-600 mb-3">
          {skipMap || error || mapDisabled || (killSwitch && killSwitch.googleMaps) ? 
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
            Use {skipMap || error || mapDisabled || (killSwitch && killSwitch.googleMaps) ? "estimated" : "AI-calculated"} size (recommended)
          </label>
        </div>

        {/* Manual Size Entry (always visible) */}
        <div className="mt-3">
          <label className="block text-sm font-medium mb-1">Enter roof size manually</label>
          <input
            type="number"
            value={localRoofSize}
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

// Prevent unnecessary re-renders
export default React.memo(RoofSizeStep);
