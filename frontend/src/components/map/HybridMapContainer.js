// src/components/map/HybridMapContainer.js
import React, { useEffect, forwardRef, useImperativeHandle, useState, useRef } from 'react';
import propertyPolygonGenerator from '../../utils/propertyPolygonGenerator';
import config from '../../config';
import L from 'leaflet';

// Component that combines Google Maps for satellite imagery with Leaflet for drawing
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
  const leafletDrawLayer = useRef(null);
  const drawnPolygon = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showControls, setShowControls] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Parse coordinates
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
        const bounds = new window.google.maps.LatLngBounds();
        if (drawnPolygon.current.getPath) {
          // Google Polygon
          const path = drawnPolygon.current.getPath();
          path.forEach(point => bounds.extend(point));
        } else if (drawnPolygon.current.getLatLngs) {
          // Leaflet Polygon
          const latlngs = drawnPolygon.current.getLatLngs()[0];
          latlngs.forEach(point => bounds.extend(new window.google.maps.LatLng(point.lat, point.lng)));
        }
        googleMapInstance.current.fitBounds(bounds);
      }
    },
    updatePolygon: (newPropertyData) => {
      if (googleMapInstance.current) {
        // Remove existing polygon
        if (drawnPolygon.current) {
          if (drawnPolygon.current.setMap) {
            // Google Polygon
            drawnPolygon.current.setMap(null);
          } else if (drawnPolygon.current.remove) {
            // Leaflet Polygon
            drawnPolygon.current.remove();
          }
        }
        
        // Create new polygon with updated property data
        createRoofPolygon(newPropertyData);
      }
    }
  }));

  // Calculate area using Leaflet utilities or Turf.js
  const calculatePolygonArea = (polygon) => {
    try {
      // Use property data if available for precise calculation
      if (propertyData && propertyData.buildingSize) {
        const calculatedRoofSize = propertyPolygonGenerator.calculateRoofSizeFromBuildingSize(
          propertyData.buildingSize,
          propertyData
        );
        
        if (calculatedRoofSize) {
          console.log("Using roof size calculated from building data:", calculatedRoofSize);
          return calculatedRoofSize;
        }
      }
      
      // Check if we have a Leaflet polygon
      if (polygon && polygon.getLatLngs) {
        // Access the Leaflet layer
        const latlngs = polygon.getLatLngs()[0];
        
        // Calculate area using Leaflet.GeometryUtil if available
        if (L.GeometryUtil && L.GeometryUtil.geodesicArea) {
          const areaInSquareMeters = L.GeometryUtil.geodesicArea(latlngs);
          // Convert to square feet (1 sq meter = 10.7639 sq feet)
          const areaInSquareFeet = Math.round(areaInSquareMeters * 10.7639);
          
          console.log("Calculated polygon area using GeometryUtil:", areaInSquareFeet, "sq ft");
          
          // Check if area is reasonable
          if (areaInSquareFeet >= 500 && areaInSquareFeet <= 10000) {
            return areaInSquareFeet;
          }
        }
        
        // Fallback to Turf.js
        if (window.turf) {
          // Convert Leaflet LatLngs to Turf format [lng, lat]
          const coordinates = latlngs.map(point => [point.lng, point.lat]);
          
          // Close the polygon if needed
          if (coordinates.length > 0 && 
              (coordinates[0][0] !== coordinates[coordinates.length-1][0] || 
               coordinates[0][1] !== coordinates[coordinates.length-1][1])) {
            coordinates.push(coordinates[0]);
          }
          
          // Create a Turf polygon and calculate area
          const turfPolygon = window.turf.polygon([coordinates]);
          const area = window.turf.area(turfPolygon);
          
          // Convert to square feet
          const areaInSquareFeet = Math.round(area * 10.7639);
          
          console.log("Calculated polygon area with Turf.js:", areaInSquareFeet, "sq ft");
          
          // Check if area is reasonable
          if (areaInSquareFeet >= 500 && areaInSquareFeet <= 10000) {
            return areaInSquareFeet;
          }
        }
      }
      
      // For Google Maps polygons or arrays of coordinates
      else if (polygon && (polygon.getPath || Array.isArray(polygon))) {
        let coordinates = [];
        
        // Extract coordinates from Google Polygon
        if (polygon.getPath) {
          const path = polygon.getPath();
          for (let i = 0; i < path.getLength(); i++) {
            const point = path.getAt(i);
            coordinates.push({ lat: point.lat(), lng: point.lng() });
          }
        } 
        // Use array directly
        else if (Array.isArray(polygon)) {
          coordinates = polygon;
        }
        
        // Use Google Maps geometry library if available
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
        
        // Fallback to Turf.js
        if (window.turf) {
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
        }
      }
      
      // If we reach here, fallback to provided size or default
      console.log("Using fallback size calculation");
      return roofSize || 2500;
    } catch (error) {
      console.error("Error calculating polygon area:", error);
      return roofSize || 2500;
    }
  };

  // Create roof polygon
  const createRoofPolygon = (customPropertyData = null) => {
    try {
      if (!googleMapInstance.current) {
        console.error("Google Maps instance not available");
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
        
        drawnPolygon.current = gmPolygon;
        
        // Create equivalent Leaflet polygon if Leaflet drawing layer exists
        if (leafletDrawLayer.current) {
          // Convert to Leaflet format
          const leafletPolygon = L.polygon(polygonCoords, {
            color: '#2563EB',
            weight: 3,
            opacity: 1,
            fillColor: '#2563EB',
            fillOpacity: 0.4
          });
          
          // Add to Leaflet drawing layer
          leafletDrawLayer.current.addLayer(leafletPolygon);
        }
        
        // Calculate area
        const area = calculatePolygonArea(polygonCoords);
        
        // Fit map to polygon bounds
        const bounds = new window.google.maps.LatLngBounds();
        polygonCoords.forEach(point => bounds.extend(point));
        googleMapInstance.current.fitBounds(bounds);
        
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

  // Initialize hybrid map when component mounts
  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    setLoading(true);
    setLoadingProgress(10);
    
    // Check for valid coordinates
    if (isNaN(validLat) || isNaN(validLng)) {
      setError(`Invalid coordinates: ${lat}, ${lng}`);
      setLoading(false);
      if (onMapError) onMapError(`Invalid coordinates: ${lat}, ${lng}`);
      return;
    }
    
    // Progress simulation
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 500);
    
    // Initialize Google Maps
    const initGoogleMaps = () => {
      try {
        setLoadingProgress(30);
        console.log("Initializing Google Maps with coordinates:", validLat, validLng);
        
        // Create Google Map
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
        
        setLoadingProgress(50);
        
        // Add marker for property
        const marker = new window.google.maps.Marker({
          position: { lat: validLat, lng: validLng },
          map: map,
          title: address || "Selected location"
        });
        
        setLoadingProgress(60);
        
        // Initialize the Leaflet drawing overlay
        initLeafletDrawing();
        
        setLoadingProgress(90);
        
        // Create initial polygon if coordinates are provided
        setTimeout(() => {
          createRoofPolygon();
          
          // Set loading complete
          setLoading(false);
          setLoadingProgress(100);
          clearInterval(progressInterval);
          
          // Notify parent the map is ready
          if (onMapReady) {
            onMapReady(map);
          }
          
          // Show controls after a short delay
          setTimeout(() => {
            setShowControls(true);
          }, 500);
        }, 500);
      } catch (error) {
        console.error("Error initializing Google Maps:", error);
        setError(error.message || "Failed to initialize Google Maps");
        setLoading(false);
        clearInterval(progressInterval);
        if (onMapError) onMapError(error.message || "Failed to initialize Google Maps");
      }
    };
    
    // Initialize Leaflet drawing overlay
    const initLeafletDrawing = () => {
      try {
        console.log("Initializing Leaflet drawing overlay");
        
        // Create a wrapper for Leaflet drawing and measurement tools
        const drawingContainer = document.createElement('div');
        drawingContainer.style.position = 'absolute';
        drawingContainer.style.top = '10px';
        drawingContainer.style.right = '10px';
        drawingContainer.style.zIndex = '1000';
        drawingContainer.style.backgroundColor = 'white';
        drawingContainer.style.padding = '5px';
        drawingContainer.style.borderRadius = '4px';
        drawingContainer.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
        drawingContainer.style.display = showControls ? 'block' : 'none';
        drawingContainer.classList.add('leaflet-drawing-container');
        
        // Add controls to the container
        const drawButton = document.createElement('button');
        drawButton.innerHTML = 'Draw Roof';
        drawButton.style.padding = '5px 10px';
        drawButton.style.marginRight = '5px';
        drawButton.style.backgroundColor = '#2563EB';
        drawButton.style.color = 'white';
        drawButton.style.border = 'none';
        drawButton.style.borderRadius = '4px';
        drawButton.style.cursor = 'pointer';
        
        drawButton.onclick = () => {
          // Start drawing mode
          console.log("Starting drawing mode");
          
          // Create a temporary Google Maps drawing manager
          const drawingManager = new window.google.maps.drawing.DrawingManager({
            drawingMode: window.google.maps.drawing.OverlayType.POLYGON,
            drawingControl: false,
            polygonOptions: {
              editable: true,
              fillColor: '#2563EB',
              fillOpacity: 0.4,
              strokeColor: '#2563EB',
              strokeWeight: 3
            }
          });
          
          drawingManager.setMap(googleMapInstance.current);
          
          // Handle polygon completion
          window.google.maps.event.addListenerOnce(drawingManager, 'polygoncomplete', (polygon) => {
            // Remove drawing manager
            drawingManager.setMap(null);
            
            // Remove existing polygon
            if (drawnPolygon.current) {
              drawnPolygon.current.setMap(null);
            }
            
            // Store the new polygon
            drawnPolygon.current = polygon;
            
            // Get coordinates from the polygon
            const path = polygon.getPath();
            const coords = [];
            for (let i = 0; i < path.getLength(); i++) {
              const point = path.getAt(i);
              coords.push({ lat: point.lat(), lng: point.lng() });
            }
            
            // Calculate area
            const area = calculatePolygonArea(polygon);
            
            // Mark as user-created
            polygon._userCreated = true;
            
            // Notify parent
            if (onPolygonCreated) {
              onPolygonCreated(polygon, area);
            }
          });
        };
        
        const measureButton = document.createElement('button');
        measureButton.innerHTML = 'Measure';
        measureButton.style.padding = '5px 10px';
        measureButton.style.backgroundColor = '#2563EB';
        measureButton.style.color = 'white';
        measureButton.style.border = 'none';
        measureButton.style.borderRadius = '4px';
        measureButton.style.cursor = 'pointer';
        
        measureButton.onclick = () => {
          // Show measurement functionality
          console.log("Starting measurement mode");
          
          // If we have a polygon, measure it
          if (drawnPolygon.current) {
            const area = calculatePolygonArea(drawnPolygon.current);
            alert(`Measured Roof Area: ${area} square feet`);
          } else {
            alert("Please draw a roof outline first to measure it.");
          }
        };
        
        drawingContainer.appendChild(drawButton);
        drawingContainer.appendChild(measureButton);
        
        // Add the container to the map
        if (googleMapInstance.current.controls) {
          googleMapInstance.current.controls[window.google.maps.ControlPosition.TOP_RIGHT].push(drawingContainer);
        } else {
          mapContainerRef.current.appendChild(drawingContainer);
        }
        
        // Setup Leaflet drawing layer if needed
        leafletDrawLayer.current = new Map(); // Simple container for leaflet layers
        
      } catch (error) {
        console.error("Error initializing Leaflet drawing:", error);
      }
    };
    
    // Check for Google Maps API
    if (window.google && window.google.maps) {
      console.log("Google Maps already loaded");
      initGoogleMaps();
    } else {
      console.log("Loading Google Maps API...");
      
      // Load Google Maps API with drawing and geometry libraries
      const script = document.createElement('script');
      const apiKey = config.googleMapsApiKey;
      
      if (!apiKey) {
        setError("Google Maps API key is missing");
        setLoading(false);
        clearInterval(progressInterval);
        if (onMapError) onMapError("Google Maps API key is missing");
        return;
      }
      
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=drawing,geometry&callback=initGoogleMapsCallback`;
      script.async = true;
      script.defer = true;
      
      // Create a global callback
      window.initGoogleMapsCallback = () => {
        console.log("Google Maps API loaded successfully");
        initGoogleMaps();
        delete window.initGoogleMapsCallback;
      };
      
      script.onerror = (error) => {
        console.error("Error loading Google Maps API:", error);
        setError("Failed to load Google Maps API. Check your internet connection and API key.");
        setLoading(false);
        clearInterval(progressInterval);
        if (onMapError) onMapError("Failed to load Google Maps API");
      };
      
      // Add script to document
      document.head.appendChild(script);
    }
    
    // Cleanup function
    return () => {
      clearInterval(progressInterval);
      if (googleMapInstance.current && window.google && window.google.maps && window.google.maps.event) {
        // Clean up event listeners
        window.google.maps.event.clearInstanceListeners(googleMapInstance.current);
      }
      
      if (drawnPolygon.current) {
        if (drawnPolygon.current.setMap) {
          drawnPolygon.current.setMap(null);
        } else if (drawnPolygon.current.remove) {
          drawnPolygon.current.remove();
        }
      }
    };
  }, [lat, lng, address]); // Only reinitialize when these props change
  
  // Update showControls state when it changes
  useEffect(() => {
    if (mapContainerRef.current) {
      const container = mapContainerRef.current.querySelector('.leaflet-drawing-container');
      if (container) {
        container.style.display = showControls ? 'block' : 'none';
      }
    }
  }, [showControls]);

  // Error state
  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-red-600 p-4 text-center">
        <div>
          <p>Error loading map: {error}</p>
          <p className="text-sm mt-2 text-gray-600">
            Coordinates: {lat}, {lng}
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
          <p className="text-gray-600">Loading map...</p>
          
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
      className="absolute inset-0" 
      style={{ width: '100%', height: '100%' }}
    ></div>
  );
});

HybridMapContainer.displayName = 'HybridMapContainer';

export default HybridMapContainer;
