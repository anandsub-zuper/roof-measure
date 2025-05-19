// src/components/map/LeafletMapContainer.js
import React, { useEffect, forwardRef, useImperativeHandle, useState, useRef } from 'react';
import propertyPolygonGenerator from '../../utils/propertyPolygonGenerator';

// We'll use the globally loaded Leaflet instead of the imported one
// This ensures consistent instances and reduces load issues
const L = window.L; // Use the globally loaded Leaflet

// Fix Leaflet icon issue if needed
let DefaultIcon;
if (L && !L.Icon.Default.imagePath) {
  DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
  });
  
  if (L.Marker && L.Marker.prototype) {
    L.Marker.prototype.options.icon = DefaultIcon;
  }
}

const LeafletMapContainer = forwardRef(({ 
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
  const [mapInstance, setMapInstance] = useState(null);
  const [drawControl, setDrawControl] = useState(null);
  const [measureControl, setMeasureControl] = useState(null);
  const [drawnPolygon, setDrawnPolygon] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('initializing');

  // Validate coordinates
  const validLat = parseFloat(lat);
  const validLng = parseFloat(lng);
  
  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      if (mapInstance) {
        mapInstance.zoomIn();
      }
    },
    zoomOut: () => {
      if (mapInstance) {
        mapInstance.zoomOut();
      }
    },
    getMapInstance: () => mapInstance,
    fitPolygon: () => {
      if (mapInstance && drawnPolygon) {
        mapInstance.fitBounds(drawnPolygon.getBounds());
      }
    },
    updatePolygon: (newPropertyData) => {
      if (!mapInstance) return;
      
      // Remove existing polygon
      if (drawnPolygon) {
        drawnPolygon.remove();
      }
      
      // Create new polygon with updated property data
      createRoofPolygon(newPropertyData);
    }
  }));

  // Calculate polygon area in square feet
  const calculatePolygonArea = (polygon) => {
    // Use property data if available
    if (propertyData && propertyData.buildingSize) {
      const calculatedRoofSize = propertyPolygonGenerator.calculateRoofSizeFromBuildingSize(
        propertyData.buildingSize,
        propertyData
      );
      
      if (calculatedRoofSize) {
        console.log("Using roof size calculated from verified building data:", calculatedRoofSize);
        return calculatedRoofSize;
      }
    }
    
    try {
      if (!L || !window.turf) {
        console.error("Leaflet or Turf libraries not loaded");
        return roofSize || 2500;
      }
      
      // Access the Leaflet layer
      if (polygon instanceof L.Polygon) {
        // Get the area in square meters
        if (L.GeometryUtil) {
          const areaInSquareMeters = L.GeometryUtil.geodesicArea(polygon.getLatLngs()[0]);
          // Convert to square feet (1 sq meter = 10.7639 sq feet)
          const areaInSquareFeet = Math.round(areaInSquareMeters * 10.7639);
          
          console.log("Calculated polygon area using GeometryUtil:", areaInSquareFeet, "sq ft");
          
          // Check if the area is reasonable
          if (areaInSquareFeet < 500 || areaInSquareFeet > 10000) {
            console.warn("Calculated area is outside reasonable range, using provided size instead");
            return roofSize || 2500;
          }
          
          return areaInSquareFeet;
        } else {
          console.warn("L.GeometryUtil not available, using Turf as fallback");
          // Extract coordinates for Turf
          const latlngs = polygon.getLatLngs()[0];
          const coords = latlngs.map(ll => [ll.lng, ll.lat]);
          
          // Add closing point if needed
          if (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1]) {
            coords.push(coords[0]);
          }
          
          // Calculate using Turf
          if (window.turf && window.turf.polygon && window.turf.area) {
            const turfPolygon = window.turf.polygon([coords]);
            const area = window.turf.area(turfPolygon);
            
            // Convert to square feet
            const areaInSquareFeet = Math.round(area * 10.7639);
            
            console.log("Calculated polygon area with Turf.js:", areaInSquareFeet, "sq ft");
            
            // Validate area
            if (areaInSquareFeet < 500 || areaInSquareFeet > 10000) {
              return roofSize || 2500;
            }
            
            return areaInSquareFeet;
          }
        }
      }
      // For GeoJSON or array of coordinates
      else if (Array.isArray(polygon)) {
        // Use Turf.js to calculate area
        if (window.turf && window.turf.polygon && window.turf.area) {
          const coords = polygon.map(p => [p.lng, p.lat]);
          if (coords.length >= 3) {
            // Close the polygon if not already closed
            if (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1]) {
              coords.push(coords[0]);
            }
            
            const turfPolygon = window.turf.polygon([coords]);
            const area = window.turf.area(turfPolygon);
            
            // Convert to square feet
            const areaInSquareFeet = Math.round(area * 10.7639);
            
            console.log("Calculated polygon area with Turf.js:", areaInSquareFeet, "sq ft");
            
            // Validate area
            if (areaInSquareFeet < 500 || areaInSquareFeet > 10000) {
              return roofSize || 2500;
            }
            
            return areaInSquareFeet;
          }
        }
      }
      
      console.warn("Could not calculate area, using provided roof size");
      return roofSize || 2500; // Fallback to provided roof size
    } catch (error) {
      console.error("Error calculating polygon area:", error);
      return roofSize || 2500; // Return the provided roof size as fallback
    }
  };

  // Create roof polygon on the map
  const createRoofPolygon = (customPropertyData = null) => {
    if (!mapInstance || !L) {
      console.error("Map instance or Leaflet not available");
      return null;
    }
    
    try {
      // Use provided or custom property data
      const dataToUse = customPropertyData || propertyData;
      
      let polygonCoords;
      
      // If we have polygon coordinates, use them
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
      
      // Create Leaflet polygon
      if (polygonCoords && polygonCoords.length >= 3) {
        const polygon = L.polygon(polygonCoords, {
          color: '#2563EB',
          weight: 3,
          opacity: 1,
          fillColor: '#2563EB',
          fillOpacity: 0.4
        }).addTo(mapInstance);
        
        setDrawnPolygon(polygon);
        
        // Calculate area
        const area = calculatePolygonArea(polygonCoords);
        
        // Fit map to polygon bounds
        mapInstance.fitBounds(polygon.getBounds());
        
        // Notify parent
        if (onPolygonCreated) {
          onPolygonCreated(polygon, area);
        }
        
        return polygon;
      }
      
      return null;
    } catch (error) {
      console.error("Error creating roof polygon:", error);
      return null;
    }
  };

  // Check if Leaflet is loaded
  const checkLeafletLoaded = () => {
    return typeof L !== 'undefined' && L && typeof L.map === 'function';
  };

  // Retry mechanism for Leaflet loading
  const waitForLeaflet = (maxAttempts = 5, interval = 1000) => {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      
      const check = () => {
        attempts++;
        setLoadingStatus(`Checking for Leaflet (attempt ${attempts}/${maxAttempts})`);
        
        if (checkLeafletLoaded()) {
          resolve(window.L);
        } else if (attempts >= maxAttempts) {
          reject(new Error(`Leaflet not loaded after ${maxAttempts} attempts`));
        } else {
          setTimeout(check, interval);
        }
      };
      
      check();
    });
  };

  // Initialize map when component mounts
  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    setIsLoading(true);
    setLoadingStatus('initializing');
    
    // Check for valid coordinates
    if (isNaN(validLat) || isNaN(validLng)) {
      setErrorMessage(`Invalid coordinates: ${lat}, ${lng}`);
      setIsLoading(false);
      if (onMapError) onMapError(`Invalid coordinates: ${lat}, ${lng}`);
      return;
    }
    
    // Attempt to initialize the map with retry logic
    const initializeMap = async () => {
      try {
        setLoadingStatus('checking for Leaflet');
        
        // Wait for Leaflet to be loaded if not available yet
        if (!checkLeafletLoaded()) {
          await waitForLeaflet();
        }
        
        if (!checkLeafletLoaded()) {
          throw new Error("Leaflet library not available");
        }
        
        setLoadingStatus('creating map');
        console.log("Creating Leaflet map with coordinates:", validLat, validLng);
        
        // Create map instance
        const map = L.map(mapContainerRef.current, {
          center: [validLat, validLng],
          zoom: 19
        });
        
        setLoadingStatus('adding tile layers');
        
        // Add tile layers
        const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        });
        
        const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        });
        
        // Add satellite layer to map
        satellite.addTo(map);
        
        setLoadingStatus('adding controls');
        
        // Add layer control
        const baseLayers = {
          "Satellite": satellite,
          "Streets": streets
        };
        
        L.control.layers(baseLayers).addTo(map);
        
        // Add scale control
        L.control.scale().addTo(map);
        
        // Add measurement control if available
        if (L.control.measure) {
          const measureOptions = {
            position: 'topright',
            primaryLengthUnit: 'feet',
            secondaryLengthUnit: 'miles',
            primaryAreaUnit: 'sqfeet',
            secondaryAreaUnit: 'acres',
            activeColor: '#2563EB',
            completedColor: '#1D4ED8'
          };
          
          const measureControl = L.control.measure(measureOptions);
          measureControl.addTo(map);
          setMeasureControl(measureControl);
        } else {
          console.warn("L.control.measure not available - measurement functionality limited");
        }
        
        // Add draw control if enabled and available
        if (enableDrawing && L.Control && L.Control.Draw) {
          setLoadingStatus('adding drawing tools');
          
          const featureGroup = new L.FeatureGroup();
          map.addLayer(featureGroup);
          
          const drawOptions = {
            position: 'topright',
            draw: {
              polyline: false,
              polygon: {
                allowIntersection: false,
                drawError: {
                  color: '#e1e7f0',
                  timeout: 1000
                },
                shapeOptions: {
                  color: '#2563EB',
                  weight: 3
                }
              },
              rectangle: false,
              circle: false,
              marker: false,
              circlemarker: false
            },
            edit: {
              featureGroup: featureGroup,
              remove: true
            }
          };
          
          const drawControl = new L.Control.Draw(drawOptions);
          map.addControl(drawControl);
          setDrawControl(drawControl);
          
          // Add draw event listeners
          map.on(L.Draw.Event.CREATED, (event) => {
            const layer = event.layer;
            
            // Mark as user created
            layer._userCreated = true;
            
            // Remove existing polygon if any
            if (drawnPolygon) {
              drawnPolygon.remove();
            }
            
            // Remove layers from feature group
            featureGroup.clearLayers();
            
            // Add the new polygon to the map and feature group
            layer.addTo(map);
            featureGroup.addLayer(layer);
            setDrawnPolygon(layer);
            
            // Calculate area
            const area = calculatePolygonArea(layer);
            
            // Notify parent
            if (onPolygonCreated) {
              onPolygonCreated(layer, area);
            }
          });
        } else if (enableDrawing) {
          console.warn("L.Control.Draw not available - drawing functionality disabled");
        }
        
        setLoadingStatus('adding marker');
        
        // Add marker for the property
        const marker = L.marker([validLat, validLng], {
          title: address || "Selected location"
        }).addTo(map);
        
        // Store map instance and notify parent
        setMapInstance(map);
        setIsLoading(false);
        
        if (onMapReady) {
          onMapReady(map);
        }
        
        setLoadingStatus('creating polygon');
        
        // Create initial polygon
        setTimeout(() => {
          createRoofPolygon();
        }, 500);
      } catch (error) {
        console.error("Error initializing map:", error);
        setErrorMessage(error.message || "Failed to initialize map");
        setIsLoading(false);
        setLoadingStatus('error');
        if (onMapError) onMapError(error.message || "Failed to initialize map");
      }
    };
    
    // Initialize the map
    initializeMap();
    
    // Cleanup function
    return () => {
      if (mapInstance) {
        mapInstance.remove();
      }
    };
  }, [lat, lng, address]); // Only reinitialize when these change

  // Error state
  if (errorMessage) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-red-600 p-4 text-center">
        <div>
          <p>Error loading map: {errorMessage}</p>
          <p className="text-sm mt-2 text-gray-600">
            Coordinates: {lat}, {lng}
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading map... ({loadingStatus})</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={mapContainerRef} 
      className="absolute inset-0 z-0" 
      style={{ width: '100%', height: '100%' }}
    />
  );
});

LeafletMapContainer.displayName = 'LeafletMapContainer';

export default LeafletMapContainer;
