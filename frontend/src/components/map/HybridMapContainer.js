// src/components/map/HybridMapContainer.js - Improved with better error handling
import React, { useEffect, forwardRef, useImperativeHandle, useState, useRef } from 'react';
import propertyPolygonGenerator from '../../utils/propertyPolygonGenerator';
import config from '../../config';

// Component that combines Google Maps for satellite imagery with Leaflet tools for measurement
const HybridMapContainer = forwardRef(({ 
  lat, 
  lng, 
  address, 
  roofSize,
  roofPolygon,
  propertyData,
  enableDrawing = true,
  onMapReady, 
  onMapError, 
  onPolygonCreated 
}, ref) => {
  const mapContainerRef = useRef(null);
  const mapInstance = useRef(null);
  const googleMapInstance = useRef(null);
  const drawnPolygon = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState('initializing');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const mapLoadAttempted = useRef(false);
  
  // Validate coordinates
  const validLat = parseFloat(lat);
  const validLng = parseFloat(lng);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      if (googleMapInstance.current) {
        const currentZoom = googleMapInstance.current.getZoom();
        googleMapInstance.current.setZoom(currentZoom + 1);
      }
    },
    zoomOut: () => {
      if (googleMapInstance.current) {
        const currentZoom = googleMapInstance.current.getZoom();
        googleMapInstance.current.setZoom(currentZoom - 1);
      }
    },
    getMapInstance: () => googleMapInstance.current,
    fitPolygon: () => {
      if (googleMapInstance.current && drawnPolygon.current) {
        try {
          const bounds = new window.google.maps.LatLngBounds();
          if (drawnPolygon.current.getPath) {
            // Google Polygon
            const path = drawnPolygon.current.getPath();
            path.forEach(point => bounds.extend(point));
          } else if (Array.isArray(drawnPolygon.current)) {
            // Array of coordinates
            drawnPolygon.current.forEach(point => 
              bounds.extend({lat: point.lat, lng: point.lng})
            );
          }
          googleMapInstance.current.fitBounds(bounds);
        } catch (e) {
          console.warn("Error fitting polygon:", e);
        }
      }
    },
    updatePolygon: (newPropertyData) => {
      if (googleMapInstance.current) {
        // Remove existing polygon
        if (drawnPolygon.current) {
          if (drawnPolygon.current.setMap) {
            // Google Polygon
            drawnPolygon.current.setMap(null);
          }
        }
        
        // Create new polygon with updated property data
        createRoofPolygon(newPropertyData);
      }
    }
  }));

  // Calculate polygon area in square feet
  const calculatePolygonArea = (polygon) => {
    // Use property data if available for precise calculation
    if (propertyData && propertyData.buildingSize) {
      const stories = propertyData.stories || 1;
      const footprint = propertyData.buildingSize / stories;
      
      // Get pitch factor
      const pitchFactor = {
        'flat': 1.05,
        'low': 1.15,
        'moderate': 1.3,
        'steep': 1.5
      }[propertyData.roofPitch || 'moderate'] || 1.3;
      
      const calculatedRoofSize = Math.round(footprint * pitchFactor);
      
      console.log("Using roof size calculated from building data:", calculatedRoofSize);
      return calculatedRoofSize;
    }
    
    // For polygon provided from coordinates, use Google Maps geometry library
    try {
      let coordinates = [];
      
      // Extract coordinates
      if (polygon && polygon.getPath) {
        // Google Maps polygon
        const path = polygon.getPath();
        for (let i = 0; i < path.getLength(); i++) {
          const point = path.getAt(i);
          coordinates.push({ lat: point.lat(), lng: point.lng() });
        }
      } else if (Array.isArray(polygon)) {
        // Array of coordinates
        coordinates = polygon;
      } else {
        console.warn("Invalid polygon format for area calculation");
        return roofSize || 2500; // Use provided value as fallback
      }
      
      // Use Google Maps geometry if available
      if (window.google && window.google.maps && window.google.maps.geometry) {
        const googleLatLngs = coordinates.map(point => 
          new window.google.maps.LatLng(point.lat, point.lng)
        );
        
        const areaInSquareMeters = window.google.maps.geometry.spherical.computeArea(googleLatLngs);
        const areaInSquareFeet = Math.round(areaInSquareMeters * 10.7639);
        
        console.log("Calculated polygon area with Google Maps:", areaInSquareFeet, "sq ft");
        
        // Check if area is reasonable
        if (areaInSquareFeet >= 500 && areaInSquareFeet <= 10000) {
          return areaInSquareFeet;
        }
      }
      
      // Try window.turf as fallback
      if (window.turf) {
        try {
          // Convert to Turf format [lng, lat]
          const turfCoordinates = coordinates.map(point => [point.lng, point.lat]);
          
          // Close the polygon if needed
          if (turfCoordinates.length > 0 && 
              (turfCoordinates[0][0] !== turfCoordinates[turfCoordinates.length-1][0] || 
               turfCoordinates[0][1] !== turfCoordinates[turfCoordinates.length-1][1])) {
            turfCoordinates.push(turfCoordinates[0]);
          }
          
          // Create a Turf polygon and calculate area
          const turfPolygon = window.turf.polygon([turfCoordinates]);
          const area = window.turf.area(turfPolygon);
          
          // Convert to square feet
          const areaInSquareFeet = Math.round(area * 10.7639);
          
          console.log("Calculated polygon area with Turf.js:", areaInSquareFeet, "sq ft");
          
          // Check if area is reasonable
          if (areaInSquareFeet >= 500 && areaInSquareFeet <= 10000) {
            return areaInSquareFeet;
          }
        } catch (e) {
          console.warn("Turf.js area calculation failed:", e);
        }
      }
      
      // If all calculations failed or results were unreasonable, use original size
      console.log("Using fallback size calculation");
      return roofSize || 2500;
    } catch (error) {
      console.error("Error calculating polygon area:", error);
      return roofSize || 2500;
    }
  };

  // Create roof polygon on the map
  const createRoofPolygon = (customPropertyData = null) => {
    try {
      if (!googleMapInstance.current) {
        console.warn("Google Maps instance not available for polygon creation");
        return null;
      }
      
      // Use provided or custom property data
      const dataToUse = customPropertyData || propertyData;
      
      let polygonCoords;
      
      // Use provided polygon coordinates if available
      if (roofPolygon && Array.isArray(roofPolygon) && roofPolygon.length >= 3) {
        console.log("Using provided roof polygon coordinates");
        polygonCoords = roofPolygon;
      }
      // Otherwise generate based on property data
      else if (dataToUse) {
        console.log("Generating polygon based on property data");
        polygonCoords = propertyPolygonGenerator.generatePropertyPolygon(
          validLat, 
          validLng, 
          roofSize, 
          dataToUse
        );
      }
      // Fallback to size-based polygon
      else {
        console.log("Generating size-based polygon");
        polygonCoords = propertyPolygonGenerator.generateSizeBasedPolygon(validLat, validLng, roofSize);
      }
      
      // Create Google Maps polygon
      if (polygonCoords && polygonCoords.length >= 3) {
        // Create Google Maps polygon
        const gmPolygon = new window.google.maps.Polygon({
          paths: polygonCoords,
          strokeColor: '#2563EB',
          strokeOpacity: 1.0,
          strokeWeight: 3,
          fillColor: '#2563EB',
          fillOpacity: 0.4,
          map: googleMapInstance.current
        });
        
        // Store the polygon reference
        drawnPolygon.current = gmPolygon;
        
        // Calculate area
        const area = calculatePolygonArea(polygonCoords);
        
        // Fit map to polygon bounds
        try {
          const bounds = new window.google.maps.LatLngBounds();
          polygonCoords.forEach(point => bounds.extend(point));
          googleMapInstance.current.fitBounds(bounds);
        } catch (e) {
          console.warn("Error fitting bounds:", e);
        }
        
        // Add click handler to make polygon editable
        gmPolygon.addListener('click', () => {
          gmPolygon.setEditable(true);
          gmPolygon.setDraggable(true);
          
          // Create a button to save changes
          const saveButton = document.createElement('div');
          saveButton.style.position = 'absolute';
          saveButton.style.top = '70px';
          saveButton.style.right = '10px';
          saveButton.style.zIndex = '1000';
          saveButton.style.backgroundColor = '#2563EB';
          saveButton.style.color = 'white';
          saveButton.style.padding = '8px 12px';
          saveButton.style.borderRadius = '4px';
          saveButton.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
          saveButton.style.cursor = 'pointer';
          saveButton.innerHTML = 'Save Changes';
          
          saveButton.onclick = () => {
            gmPolygon.setEditable(false);
            gmPolygon.setDraggable(false);
            
            // Get updated coordinates
            const path = gmPolygon.getPath();
            const updatedCoords = [];
            for (let i = 0; i < path.getLength(); i++) {
              const point = path.getAt(i);
              updatedCoords.push({ lat: point.lat(), lng: point.lng() });
            }
            
            // Calculate new area
            const updatedArea = calculatePolygonArea(updatedCoords);
            
            // Notify parent component
            onPolygonCreated(gmPolygon, updatedArea);
            
            // Remove save button
            saveButton.remove();
          };
          
          mapContainerRef.current.appendChild(saveButton);
        });
        
        // Notify parent
        if (onPolygonCreated) {
          onPolygonCreated(gmPolygon, area);
        }
        
        return gmPolygon;
      }
      
      return null;
    } catch (error) {
      console.error("Error creating roof polygon:", error);
      return null;
    }
  };

  // Check if Google Maps API is available
  const isGoogleMapsLoaded = () => {
    return typeof window.google !== 'undefined' && 
           typeof window.google.maps !== 'undefined' &&
           typeof window.google.maps.Map === 'function';
  };

  // Add drawing controls to the map
  const addDrawingControls = () => {
    if (!googleMapInstance.current || !window.google?.maps?.drawing?.DrawingManager) {
      console.warn("Google Maps drawing library not available");
      return;
    }
    
    try {
      // Create a drawing manager
      const drawingManager = new window.google.maps.drawing.DrawingManager({
        drawingMode: null,
        drawingControl: true,
        drawingControlOptions: {
          position: window.google.maps.ControlPosition.TOP_CENTER,
          drawingModes: [
            window.google.maps.drawing.OverlayType.POLYGON
          ]
        },
        polygonOptions: {
          fillColor: '#2563EB',
          fillOpacity: 0.4,
          strokeWeight: 3,
          strokeColor: '#2563EB',
          clickable: true,
          editable: true,
          zIndex: 1
        }
      });
      
      drawingManager.setMap(googleMapInstance.current);
      
      // Listen for polygon completion
      window.google.maps.event.addListener(drawingManager, 'polygoncomplete', (polygon) => {
        // Remove existing polygon
        if (drawnPolygon.current) {
          drawnPolygon.current.setMap(null);
        }
        
        // Store the new polygon
        drawnPolygon.current = polygon;
        drawnPolygon.current._userCreated = true; // Mark as user-created
        
        // Calculate area
        const path = polygon.getPath();
        const coordinates = [];
        for (let i = 0; i < path.getLength(); i++) {
          const point = path.getAt(i);
          coordinates.push({ lat: point.lat(), lng: point.lng() });
        }
        
        const area = calculatePolygonArea(coordinates);
        
        // Switch drawing manager back to non-drawing mode
        drawingManager.setDrawingMode(null);
        
        // Notify parent
        if (onPolygonCreated) {
          onPolygonCreated(polygon, area);
        }
        
        // Add listener for polygon changes
        const updatePolygonArea = () => {
          const path = polygon.getPath();
          const coordinates = [];
          for (let i = 0; i < path.getLength(); i++) {
            const point = path.getAt(i);
            coordinates.push({ lat: point.lat(), lng: point.lng() });
          }
          
          const area = calculatePolygonArea(coordinates);
          
          // Notify parent
          if (onPolygonCreated) {
            onPolygonCreated(polygon, area);
          }
        };
        
        // Listen for changes to the polygon
        window.google.maps.event.addListener(polygon.getPath(), 'set_at', updatePolygonArea);
        window.google.maps.event.addListener(polygon.getPath(), 'insert_at', updatePolygonArea);
        window.google.maps.event.addListener(polygon.getPath(), 'remove_at', updatePolygonArea);
      });
    } catch (e) {
      console.error("Error adding drawing controls:", e);
    }
  };

  // Initialize map and polygon
  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    // Only attempt to load the map once
    if (mapLoadAttempted.current) return;
    mapLoadAttempted.current = true;
    
    setLoading(true);
    setLoadingProgress(10);
    setLoadingStatus('initializing');
    
    // Check for valid coordinates
    if (isNaN(validLat) || isNaN(validLng)) {
      setError(`Invalid coordinates: ${lat}, ${lng}`);
      setLoading(false);
      if (onMapError) onMapError(`Invalid coordinates: ${lat}, ${lng}`);
      return;
    }
    
    // Progress simulation for better user feedback
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => Math.min(prev + 5, 90));
    }, 500);
    
    console.log(`Initializing map with Google Maps API key present: ${!!config.googleMapsApiKey}`);
    
    // Initialize Google Maps
    const initMap = () => {
      try {
        setLoadingStatus('creating map');
        setLoadingProgress(50);
        console.log("Creating Google Maps instance");
        
        // Create map instance
        const mapOptions = {
          center: { lat: validLat, lng: validLng },
          zoom: 19,
          mapTypeId: 'satellite',
          tilt: 0,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true
        };
        
        const map = new window.google.maps.Map(mapContainerRef.current, mapOptions);
        googleMapInstance.current = map;
        
        setLoadingStatus('adding marker');
        setLoadingProgress(60);
        
        // Add marker for property location
        new window.google.maps.Marker({
          position: { lat: validLat, lng: validLng },
          map: map,
          title: address || "Selected location"
        });
        
        setLoadingStatus('adding controls');
        setLoadingProgress(70);
        
        // Add drawing controls if enabled
        if (enableDrawing && window.google.maps.drawing) {
          addDrawingControls();
        }
        
        // Add measure area button
        const measureDiv = document.createElement('div');
        measureDiv.style.backgroundColor = 'white';
        measureDiv.style.border = '2px solid #ccc';
        measureDiv.style.borderRadius = '3px';
        measureDiv.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
        measureDiv.style.cursor = 'pointer';
        measureDiv.style.marginBottom = '22px';
        measureDiv.style.textAlign = 'center';
        measureDiv.title = 'Measure roof area';
        measureDiv.innerHTML = `
          <div style="padding: 5px; font-family: Arial, sans-serif; font-size: 13px;">
            📏 Measure Area
          </div>
        `;
        
        measureDiv.addEventListener('click', () => {
          if (drawnPolygon.current) {
            // Calculate area
            const path = drawnPolygon.current.getPath();
            const coordinates = [];
            for (let i = 0; i < path.getLength(); i++) {
              const point = path.getAt(i);
              coordinates.push({ lat: point.lat(), lng: point.lng() });
            }
            
            const area = calculatePolygonArea(coordinates);
            
            // Show result
            alert(`Roof Area: ${area} square feet`);
          } else {
            alert("Please draw a roof outline first using the drawing tools.");
          }
        });
        
        map.controls[window.google.maps.ControlPosition.TOP_RIGHT].push(measureDiv);
        
        setLoadingStatus('creating polygon');
        setLoadingProgress(80);
        
        // Create roof polygon after a brief delay to ensure map is ready
        setTimeout(() => {
          createRoofPolygon();
          
          // Set loading complete
          setLoading(false);
          setLoadingProgress(100);
          clearInterval(progressInterval);
          
          // Notify parent
          if (onMapReady) {
            onMapReady(map);
          }
        }, 500);
      } catch (error) {
        console.error("Error initializing map:", error);
        setError(`Error initializing map: ${error.message}`);
        setLoading(false);
        clearInterval(progressInterval);
        if (onMapError) onMapError(`Error initializing map: ${error.message}`);
      }
    };
    
    // Try to load Google Maps
    const loadGoogleMaps = () => {
      // If Google Maps is already loaded, initialize map
      if (isGoogleMapsLoaded()) {
        console.log("Google Maps already loaded");
        initMap();
        return;
      }
      
      console.log("Loading Google Maps API...");
      setLoadingStatus('loading Google Maps API');
      
      // Get API key 
      const apiKey = config.googleMapsApiKey;
      
      if (!apiKey) {
        const errorMsg = "Google Maps API key is missing";
        console.error(errorMsg);
        setError(errorMsg);
        setLoading(false);
        clearInterval(progressInterval);
        if (onMapError) onMapError(errorMsg);
        return;
      }
      
      // Create global callback
      window.initGoogleMapsCallback = function() {
        console.log("Google Maps API loaded successfully");
        delete window.initGoogleMapsCallback;
        initMap();
      };
      
      // Create script element
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=drawing,geometry&callback=initGoogleMapsCallback`;
      script.async = true;
      script.defer = true;
      
      // Handle script errors
      script.onerror = (error) => {
        console.error("Error loading Google Maps API:", error);
        const errorMsg = "Failed to load Google Maps API. Check your network connection and API key.";
        setError(errorMsg);
        setLoading(false);
        clearInterval(progressInterval);
        if (onMapError) onMapError(errorMsg);
      };
      
      // Add timeout to avoid hanging
      const timeoutId = setTimeout(() => {
        if (!isGoogleMapsLoaded()) {
          const errorMsg = "Google Maps API loading timed out";
          console.error(errorMsg);
          setError(errorMsg);
          setLoading(false);
          clearInterval(progressInterval);
          if (onMapError) onMapError(errorMsg);
        }
      }, 15000); // 15 second timeout
      
      // Add to document
      document.head.appendChild(script);
      
      // Clean up timeout
      return () => clearTimeout(timeoutId);
    };
    
    // Start loading
    loadGoogleMaps();
    
    // Cleanup
    return () => {
      clearInterval(progressInterval);
      
      if (googleMapInstance.current && window.google?.maps?.event) {
        // Clean up event listeners
        window.google.maps.event.clearInstanceListeners(googleMapInstance.current);
      }
      
      if (drawnPolygon.current && drawnPolygon.current.setMap) {
        drawnPolygon.current.setMap(null);
      }
    };
  }, [lat, lng, address]); // Only reinitialize when coordinates or address change

  // Error state
  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-red-600 p-4 text-center">
        <div>
          <p>Error loading map: {error}</p>
          <p className="text-sm mt-2 text-gray-600">
            Try refreshing the page or check your internet connection.
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading satellite imagery... ({loadingStatus})</p>
          
          {/* Loading progress bar */}
          <div className="w-64 h-2 bg-gray-200 rounded-full mt-3 mb-3 mx-auto">
            <div 
              className="h-full bg-primary-600 rounded-full" 
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={mapContainerRef} 
      className="absolute inset-0 z-0" 
      style={{ width: '100%', height: '100%' }}
    >
      {/* Measurement instruction overlay */}
      <div className="absolute top-2 left-2 right-2 bg-white bg-opacity-80 text-xs p-2 rounded-md z-10 pointer-events-none text-gray-700">
        Use the drawing tools to outline your roof for an accurate measurement
      </div>
    </div>
  );
});

HybridMapContainer.displayName = 'HybridMapContainer';

export default HybridMapContainer;
