// src/components/steps/RoofSizeStep.js
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Ruler, Camera, ChevronLeft, ChevronRight, Building, Info } from 'lucide-react';
import { formatNumber } from '../../utils/formatters';
import EnhancedGoogleMapContainer from '../map/EnhancedGoogleMapContainer';
import config from '../../config';
import killSwitch from '../../killSwitch';
import { debounce } from '../../utils/debounce';
import polygonDebugTool from '../../utils/polygonDebugTool';
import performanceMonitor from '../../utils/performance';
import { logMeasurementDiscrepancy } from '../../utils/metricsLogger';

const RoofSizeStep = ({ formData, updateFormData, nextStep, prevStep }) => {
  const renderTime = performance.now();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [skipMap, setSkipMap] = useState(false);
  const [mapDisabled, setMapDisabled] = useState(false);
  const [localRoofSize, setLocalRoofSize] = useState(formData.roofSize || '');
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);
  const mapContainerRef = useRef(null);
  const prevSizeRef = useRef(formData.roofSize);
  
  // Calculate estimated roof size based on property data (as a reference point)
  const estimatedSizeFromProperty = useMemo(() => {
    if (formData.propertyData && formData.propertyData.buildingSize && formData.propertyData.stories) {
      const footprint = formData.propertyData.buildingSize / formData.propertyData.stories;
      
      // Apply pitch factor based on estimated pitch or default
      const pitchFactor = {
        'flat': 1.05,
        'low': 1.15,
        'moderate': 1.3,
        'steep': 1.5
      }[formData.roofPitch || 'moderate'] || 1.3;
      
      return Math.round(footprint * pitchFactor);
    }
    return null;
  }, [formData.propertyData, formData.roofPitch]);
  
  // Extract property data for display
  const hasPropertyData = !!formData.propertyData;
  const propertyType = formData.propertyData?.propertyType || 'Unknown';
  const buildingSize = formData.propertyData?.buildingSize || null;
  const stories = formData.propertyData?.stories || null;
  
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
      roofPitch: formData.roofPitch,
      roofShape: formData.roofShape,
      roofAnalysisMethod: formData.roofAnalysisMethod
    });
    
    // Track component performance
    if (performanceMonitor && performanceMonitor.trackComponent) {
      performanceMonitor.trackComponent('RoofSizeStep', performance.now() - renderTime);
    }
  }, [formData.lat, formData.lng, formData.roofSize, formData.initialRoofSize, 
      formData.roofPolygon, formData.propertyData, renderTime, formData.roofPitch,
      formData.roofShape, formData.roofAnalysisMethod]);

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

  // FIXED: Handle polygon creation with improved logic to handle discrepancies
  const handlePolygonCreated = useCallback((polygon, area) => {
    console.log("Polygon created with area:", area, "Backend area:", formData.initialRoofSize);
    
    // Always store the polygon-calculated area separately
    updateFormData('polygonArea', area);
    
    // Compare with backend calculation if available
    const backendSize = formData.initialRoofSize;
    
    if (backendSize) {
      const polygonSize = area || 0;
      const sizeRatio = polygonSize / backendSize;
      
      // Log the discrepancy for monitoring
      if (formData.address && window.logMeasurementDiscrepancy) {
        logMeasurementDiscrepancy(backendSize, polygonSize, formData.address);
      }
      
      // Significant discrepancy - use backend value as it's more reliable
      if (!area || sizeRatio < 0.7 || sizeRatio > 1.3) {
        console.log("Large discrepancy detected, using backend size:", backendSize);
        updateFormData('roofSize', backendSize);
        setLocalRoofSize(backendSize);
        updateFormData('sizingMethod', 'backend_override');
        updateFormData('sizingNotes', `Polygon calculation (${area} sq ft) differed from backend (${backendSize} sq ft)`);
        return;
      }
    }
    
    // Use polygon area when it's reasonable or we don't have backend data
    if (area && area > 500 && area < 10000) {
      console.log("Using polygon-calculated area:", area);
      updateFormData('roofSize', area);
      setLocalRoofSize(area);
      updateFormData('sizingMethod', 'polygon_calculated');
    } else if (estimatedSizeFromProperty) {
      // Fall back to property-based estimation
      console.log("Using property-based estimation:", estimatedSizeFromProperty);
      updateFormData('roofSize', estimatedSizeFromProperty);
      setLocalRoofSize(estimatedSizeFromProperty);
      updateFormData('sizingMethod', 'property_estimated');
    } else if (formData.initialRoofSize) {
      // Last resort, use initial backend value
      updateFormData('roofSize', formData.initialRoofSize);
      setLocalRoofSize(formData.initialRoofSize);
      updateFormData('sizingMethod', 'backend_initial');
    }
  }, [formData.initialRoofSize, formData.address, estimatedSizeFromProperty, updateFormData]);

  // Toggle automatic/manual size
  const handleToggleAutoSize = useCallback((e) => {
    const isAuto = e.target.checked;
    updateFormData('roofSizeAuto', isAuto);
    
    // Restore roof size based on different sources when returning to auto
    if (isAuto) {
      // Priority: 
      // 1. Use backend-calculated area if available
      // 2. Use polygon-calculated area if valid
      // 3. Use property-based calculation if available
      // 4. Fall back to initial size
      
      if (formData.initialRoofSize) {
        console.log("Restoring backend-calculated roof size");
        updateFormData('roofSize', formData.initialRoofSize);
        setLocalRoofSize(formData.initialRoofSize);
      } else if (formData.polygonArea && formData.polygonArea > 500) {
        console.log("Restoring polygon-calculated area");
        updateFormData('roofSize', formData.polygonArea);
        setLocalRoofSize(formData.polygonArea);
      } else if (estimatedSizeFromProperty) {
        console.log("Restoring property-based estimation");
        updateFormData('roofSize', estimatedSizeFromProperty);
        setLocalRoofSize(estimatedSizeFromProperty);
      }
    }
  }, [formData.polygonArea, formData.initialRoofSize, estimatedSizeFromProperty, updateFormData]);

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
    
    // Set a default roof size if none exists
    if (!formData.roofSize) {
      setLocalRoofSize(3000);
      updateFormData('roofSize', 3000);
    }
    
    setLoading(false);
  }, [formData.roofSize, updateFormData]);

  // Display info about the analysis method
  const handleToggleInfoTooltip = useCallback(() => {
    setShowInfoTooltip(prev => !prev);
  }, []);

  // Debug function for environment variables
  const debugEnvironment = useCallback(() => {
    console.log("Environment check:", {
      googleMapsKey: config.googleMapsApiKey ? "Present (first 4 chars: " + config.googleMapsApiKey.substring(0,4) + "...)" : "Missing",
      apiUrl: config.apiUrl,
      mapDisabled: mapDisabled,
      skipMap: skipMap,
      formDataRoofSize: formData.roofSize,
      initialRoofSize: formData.initialRoofSize,
      localRoofSize: localRoofSize,
      hasRoofPolygon: !!formData.roofPolygon,
      hasPropertyData: hasPropertyData,
      propertyType: propertyType,
      buildingSize: buildingSize,
      stories: stories,
      estimatedFromProperty: estimatedSizeFromProperty,
      roofShape: formData.roofShape,
      roofPitch: formData.roofPitch,
      analysisMethod: formData.roofAnalysisMethod
    });
    
    if (formData.roofPolygon) {
      polygonDebugTool.debugPolygon(formData.roofPolygon, formData.roofSize || 0);
    }
  }, [mapDisabled, skipMap, formData.roofSize, formData.initialRoofSize,
      formData.roofPolygon, hasPropertyData, propertyType, buildingSize, stories,
      estimatedSizeFromProperty, localRoofSize, formData.roofShape, formData.roofPitch,
      formData.roofAnalysisMethod]);

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
            Using estimated roof size
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

  const getMethodDescription = () => {
    if (!formData.roofAnalysisMethod) return "";
    
    switch (formData.roofAnalysisMethod) {
      case "openai_vision":
        return "AI analysis of satellite imagery";
      case "property_data_calculation":
        return "Calculated from property records";
      case "property_data_fallback":
        return "Calculated from property records (fallback)";
      case "satellite_imagery":
        return "Satellite imagery analysis";
      default:
        return formData.roofAnalysisMethod.replace(/_/g, ' ');
    }
  };

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
          {hasPropertyData ? 
            "Based on property records and satellite imagery." : 
            (skipMap || error || mapDisabled || (killSwitch && killSwitch.googleMaps) ? 
              "Using estimated roof size based on property data." : 
              "Our AI analyzed your roof using satellite imagery.")}
          {" You can also enter the size manually."}
        </p>

        {/* Roof Characteristics if available */}
        {(formData.roofShape || formData.roofPitch) && (
          <div className="mt-2 mb-3 flex flex-wrap gap-2">
            {formData.roofShape && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                {formData.roofShape === 'simple' ? 'Simple roof' : 'Complex roof'}
              </span>
            )}
            {formData.roofPitch && (
              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                {formData.roofPitch === 'flat' ? 'Flat roof' : 
                formData.roofPitch === 'low' ? 'Low pitch' :
                formData.roofPitch === 'moderate' ? 'Moderate pitch' :
                formData.roofPitch === 'steep' ? 'Steep pitch' : 'Unknown pitch'}
              </span>
            )}
          </div>
        )}

        {/* Analysis Method if available */}
        {formData.roofAnalysisMethod && (
          <div className="mb-3 flex items-center">
            <span className="text-xs text-gray-500 flex items-center">
              Analysis method: {getMethodDescription()}
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
                <p className="font-semibold mb-1">About This Analysis</p>
                <p>
                  {formData.roofAnalysisMethod === "openai_vision" ? 
                    "Our AI analyzed satellite imagery of your roof to determine its size, shape, and pitch." :
                    formData.roofAnalysisMethod === "property_data_calculation" ?
                    "This estimate is calculated from property records, including the building size and number of stories." :
                    "This estimate is based on multiple sources of data combined to give you the most accurate measurement."}
                </p>
                {formData.roofAnalysisNotes && (
                  <p className="mt-1 italic">{formData.roofAnalysisNotes}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Auto/Manual Toggle */}
        <div className="mt-2">
          <label className="flex items-center text-sm text-gray-700">
            <input
              type="checkbox"
              checked={formData.roofSizeAuto}
              onChange={handleToggleAutoSize}
              className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            Use {hasPropertyData ? "property-based" : (skipMap || error || mapDisabled || (killSwitch && killSwitch.googleMaps) ? "estimated" : "AI-calculated")} size (recommended)
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
