// src/components/map/LeafletMapContainer.js
import React, { useEffect, forwardRef, useImperativeHandle, useState, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-measure/dist/leaflet-measure.css';
import '@turf/turf';
import propertyPolygonGenerator from '../../utils/propertyPolygonGenerator';

// Fix Leaflet icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

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
      // Access the Leaflet layer
      if (polygon instanceof L.Polygon) {
        // Get the area in square meters
        const areaInSquareMeters = L.GeometryUtil.geodesicArea(polygon.getLatLngs()[0]);
        // Convert to square feet (1 sq meter = 10.7639 sq feet)
        const areaInSquareFeet = Math.round(areaInSquareMeters * 10.7639);
        
        console.log("Calculated polygon area:", areaInSquareFeet, "sq ft");
        
        // Check if the area is reasonable
        if (areaInSquareFeet < 500 || areaInSquareFeet > 10000) {
          console.warn("Calculated area is outside reasonable range, using provided size instead");
          return roofSize || 2500;
        }
        
        return areaInSquareFeet;
      }
      // For GeoJSON or array of coordinates
      else if (Array.isArray(polygon)) {
        // Use Turf.js to calculate area
        const coords = polygon.map(p => [p.lng, p.lat]);
        if (coords.length >= 3) {
          // Close the polygon if not already closed
          if (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1]) {
            coords.push(coords[0]);
          }
          
          const turfPolygon = turf.polygon([coords]);
          const area = turf.area(turfPolygon);
          
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
      
      return roofSize || 2500; // Fallback to provided roof size
    } catch (error) {
      console.error("Error calculating polygon area:", error);
      return roofSize || 2500; // Return the provided roof size as fallback
    }
  };

  // Create roof polygon on the map
  const createRoofPolygon = (customPropertyData = null) => {
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
  };

  // Initialize map when component mounts
  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    setIsLoading(true);
    
    try {
      // Check for valid coordinates
      if (isNaN(validLat) || isNaN(validLng)) {
        throw new Error(`Invalid coordinates: ${lat}, ${lng}`);
      }
      
      // Load required Leaflet plugins
      import('leaflet-draw').then(L => {
        import('leaflet-measure').then(() => {
          // Create map instance
          console.log("Creating Leaflet map with coordinates:", validLat, validLng);
          
          const map = L.map(mapContainerRef.current, {
            center: [validLat, validLng],
            zoom: 19
          });
          
          // Add tile layers
          const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          });
          
          const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
          });
          
          // Add satellite layer to map
          satellite.addTo(map);
          
          // Add layer control
          const baseLayers = {
            "Satellite": satellite,
            "Streets": streets
          };
          
          L.control.layers(baseLayers).addTo(map);
          
          // Add scale control
          L.control.scale().addTo(map);
          
          // Add measurement control
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
          
          // Add draw control if enabled
          if (enableDrawing) {
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
                featureGroup: new L.FeatureGroup(),
                remove: true
              }
            };
            
            const drawControl = new L.Control.Draw(drawOptions);
            map.addControl(drawControl);
            setDrawControl(drawControl);
            
            // Add draw event listeners
            map.on(L.Draw.Event.CREATED, (event) => {
              const layer = event.layer;
              
              // Remove existing polygon if any
              if (drawnPolygon) {
                drawnPolygon.remove();
              }
              
              // Add the new polygon to the map
              layer.addTo(map);
              setDrawnPolygon(layer);
              
              // Calculate area
              const area = calculatePolygonArea(layer);
              
              // Notify parent
              if (onPolygonCreated) {
                onPolygonCreated(layer, area);
              }
            });
          }
          
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
          
          // Create initial polygon
          setTimeout(() => {
            createRoofPolygon();
          }, 500);
        });
      }).catch(error => {
        console.error("Error loading Leaflet plugins:", error);
        setErrorMessage("Failed to load mapping libraries. Please refresh and try again.");
        setIsLoading(false);
        if (onMapError) onMapError(error.message);
      });
    } catch (error) {
      console.error("Error initializing map:", error);
      setErrorMessage(error.message || "Failed to initialize map");
      setIsLoading(false);
      if (onMapError) onMapError(error.message);
    }
    
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
          <p className="text-gray-600">Loading map...</p>
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
