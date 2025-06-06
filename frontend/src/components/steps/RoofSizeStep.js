// src/components/steps/RoofSizeStep.js
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Ruler, Camera, ChevronLeft, ChevronRight, Building, Info } from 'lucide-react';
import { formatNumber } from '../../utils/formatters';
import EnhancedGoogleMapContainer from '../map/EnhancedGoogleMapContainer';
import config from '../../config';
import killSwitch from '../../killSwitch';
import { debounce } from '../../utils/debounce';
import propertyPolygonGenerator from '../../utils/propertyPolygonGenerator';

const RoofSizeStep = ({ formData, updateFormData, nextStep, prevStep }) => {
  // Removed performance monitoring references
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [skipMap, setSkipMap] = useState(false);
  const [mapDisabled, setMapDisabled] = useState(false);
  const [localRoofSize, setLocalRoofSize] = useState(formData.roofSize || '');
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);
  const mapContainerRef = useRef(null);
  const prevSizeRef = useRef(formData.roofSize);
  
  // Display property information and provide a better sizing description
  const hasPropertyData = !!formData.propertyData;
  const propertyType = formData.propertyData?.propertyType || 'Unknown';
  const buildingSize = formData.propertyData?.buildingSize || null;
  const stories = formData.propertyData?.stories || null;
  const sizingMethod = formData.sizingMethod || 'unknown';
  
  // Debug logging
  useEffect(() => {
    console.log("RoofSizeStep rendering with formData:", {
      lat: formData.lat,
      lng: formData.lng,
      roofSize: formData.roofSize,
      initialRoofSize: formData.initialRoofSize,
      roofPolygon: formData.roofPolygon ? "Present" : "None",
      propertyData: formData.propertyData ? {
        propertyType: formData.propertyData.propertyType,
        buildingSize: formData.propertyData.buildingSize,
        stories: formData.propertyData.stories
      } : "None",
      sizingMethod: formData.sizingMethod || "unknown"
    });
  }, [formData.lat, formData.lng, formData.roofSize, formData.initialRoofSize, 
      formData.roofPolygon, formData.propertyData, formData.sizingMethod]);

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
    
    // If we get a map error, use property-based calculation
    if (formData.propertyData && formData.propertyData.buildingSize) {
      const calculatedSize = propertyPolygonGenerator.calculateRoofSizeFromBuildingSize(
        formData.propertyData.buildingSize,
        formData.propertyData
      );
      
      if (calculatedSize) {
        console.log("Using property-based calculation after map error:", calculatedSize);
        updateFormData('roofSize', calculatedSize);
        setLocalRoofSize(calculatedSize);
        return;
      }
    }
    
    // Fallback if property calculation fails
    if (!formData.roofSize) {
      setLocalRoofSize(3000);
      updateFormData('roofSize', 3000);
    }
  }, [formData.propertyData, formData.roofSize, updateFormData]);

  // Modified polygon handler that doesn't change the existing roof size
  // This keeps the more accurate property-based calculation
  const handlePolygonCreated = useCallback((polygon, area) => {
    console.log("Polygon visualization created with area:", area);
    
    // Store the polygon area for reference but don't overwrite roofSize
    updateFormData('polygonArea', area);
    
    // Only update if we don't already have a property-based calculation
    if (!formData.sizingMethod || formData.sizingMethod === 'unknown') {
      if (area && area > 500 && area < 10000) {
        updateFormData('roofSize', area);
        setLocalRoofSize(area);
        updateFormData('sizingMethod', 'polygon_measurement');
      } else if (formData.initialRoofSize) {
        // Use initial backend value as fallback
        updateFormData('roofSize', formData.initialRoofSize);
        setLocalRoofSize(formData.initialRoofSize);
      }
    }
  }, [formData.initialRoofSize, formData.sizingMethod, updateFormData]);

  // Toggle automatic/manual size
  const handleToggleAutoSize = useCallback((e) => {
    const isAuto = e.target.checked;
    updateFormData('roofSizeAuto', isAuto);
    
    // Restore roof size based on different sources when returning to auto
    if (isAuto) {
      // Priority order for automatic size
      if (formData.propertyData && formData.propertyData.buildingSize) {
        // Use property-based calculation (most accurate)
        const calculatedSize = propertyPolygonGenerator.calculateRoofSizeFromBuildingSize(
          formData.propertyData.buildingSize,
          formData.propertyData
        );
        
        if (calculatedSize) {
          console.log("Restoring property-based roof size calculation");
          updateFormData('roofSize', calculatedSize);
          setLocalRoofSize(calculatedSize);
          updateFormData('sizingMethod', 'property_calculation');
          return;
        }
      }
      
      // Fallback options if property calculation not available
      if (formData.initialRoofSize) {
        console.log("Restoring initial roof size");
        updateFormData('roofSize', formData.initialRoofSize);
        setLocalRoofSize(formData.initialRoofSize);
      } else if (formData.polygonArea && formData.polygonArea > 500) {
        console.log("Restoring polygon-calculated area");
        updateFormData('roofSize', formData.polygonArea);
        setLocalRoofSize(formData.polygonArea);
      }
    }
  }, [formData.propertyData, formData.initialRoofSize, formData.polygonArea, updateFormData]);

  // Handle manual roof size input
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

  // Check if we have valid coordinates
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
    
    // Use property-based calculation if available
    if (formData.propertyData && formData.propertyData.buildingSize) {
      const calculatedSize = propertyPolygonGenerator.calculateRoofSizeFromBuildingSize(
        formData.propertyData.buildingSize,
        formData.propertyData
      );
      
      if (calculatedSize) {
        updateFormData('roofSize', calculatedSize);
        setLocalRoofSize(calculatedSize);
        updateFormData('sizingMethod', 'property_calculation');
        setLoading(false);
        return;
      }
    }
    
    // Set a default roof size if none exists and property calculation failed
    if (!formData.roofSize) {
      setLocalRoofSize(3000);
      updateFormData('roofSize', 3000);
    }
    
    setLoading(false);
  }, [formData.propertyData, formData.roofSize, updateFormData]);

  // Display info about the analysis method
  const handleToggleInfoTooltip = useCallback(() => {
    setShowInfoTooltip(prev => !prev);
  }, []);

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

  // Get information about the sizing method to display to user
  const getSizingMethodDescription = () => {
    if (!formData.sizingMethod) return "AI-calculated estimate";
    
    switch (formData.sizingMethod) {
      case 'property_calculation':
        return "Based on property records";
      case 'api_calculation':
        return "AI-calculated from satellite imagery";
      case 'polygon_measurement':
        return "Measured from satellite imagery";
      case 'default_fallback':
        return "Estimated standard size";
      default:
        return "AI-calculated estimate";
    }
  };

  // Determine which map component to render
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
            Using property-based roof size estimate
          </p>
        </div>
      );
    }
    
    return (
      <EnhancedGoogleMapContainer
        ref={mapContainerRef}
        lat={coordinates.lat}
        lng={coordinates.lng}
        address={formData.address}
        roofSize={formData.roofSize || formData.initialRoofSize}
        roofPolygon={formData.roofPolygon}
        propertyData={formData.propertyData}
        onMapReady={handleMapReady}
        onMapError={handleMapError}
        onPolygonCreated={handlePolygonCreated}
      />
    );
  }, [
    coordinates, skipMap, mapDisabled, formData.address, formData.roofSize, 
    formData.initialRoofSize, formData.roofPolygon, formData.propertyData, 
    handleMapReady, handleMapError, handlePolygonCreated, killSwitch
  ]);

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-2">Your Roof Details</h2>
      <p className="text-sm text-gray-600 mb-4">{formData.address}</p>
      
      {/* Property Data Badge - Show if available */}
      {hasPropertyData && (
        <div className="mb-4 bg-green-50 text-green-800 px-3 py-1 rounded-full text-xs flex items-center">
          <Building size={14} className="mr-1" />
          {propertyType} {stories && `• ${stories} ${stories === 1 ? 'story' : 'stories'}`}
          {buildingSize && ` • ${formatNumber(buildingSize)} sq ft building`}
        </div>
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
            <p className="text-xs mt-1">Using property-based roof size</p>
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
          {getSizingMethodDescription()}
          {". You can also enter the size manually."}
        </p>

        {/* Analysis Method */}
        <div className="mb-3 flex items-center">
          <span className="text-xs text-gray-500 flex items-center">
            Calculation method: {getSizingMethodDescription()}
            <button 
              onClick={handleToggleInfoTooltip}
              className="ml-1 text-gray-400 hover:text-gray-600"
              aria-label="More information"
            >
              <Info size={14} />
            </button>
          </span>
          
          {showInfoTooltip && (
            <div className="absolute bg-white p-3 rounded-lg shadow-lg text-xs text-gray-700 z-20 max-w-xs mt-1">
              <p className="font-semibold mb-1">About This Measurement</p>
              <p>
                {sizingMethod === "property_calculation" ? 
                  "This estimate is calculated from property records using industry standard factors for your roof type and home size." :
                  sizingMethod === "api_calculation" ?
                  "This estimate was calculated using satellite imagery and AI analysis." :
                  "This estimate is based on multiple sources of data combined to give you the most accurate measurement."}
              </p>
              <p className="mt-1">
                For a {stories}-story {propertyType.toLowerCase()} of {formatNumber(buildingSize || 0)} sq ft, 
                industry standards suggest a roof size between {formatNumber(Math.round((buildingSize || 2000)/stories * 1.2))} and 
                {formatNumber(Math.round((buildingSize || 2000)/stories * 1.5))} sq ft.
              </p>
            </div>
          )}
        </div>

        {/* Auto/Manual Toggle */}
        <div className="mt-2">
          <label className="flex items-center text-sm text-gray-700">
            <input
              type="checkbox"
              checked={formData.roofSizeAuto}
              onChange={handleToggleAutoSize}
              className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            Use {hasPropertyData ? "property-based" : (skipMap || error || mapDisabled || (killSwitch && killSwitch.googleMaps) ? "estimated" : "calculated")} size (recommended)
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

export default React.memo(RoofSizeStep);
