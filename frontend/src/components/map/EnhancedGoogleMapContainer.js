// frontend/src/components/map/EnhancedGoogleMapContainer.js
import React, { useEffect, forwardRef, useImperativeHandle, useState, useRef } from 'react';
import config from '../../config';
import propertyPolygonGenerator from '../../utils/propertyPolygonGenerator';
import polygonDebugTool from '../../utils/polygonDebugTool';

const EnhancedGoogleMapContainer = forwardRef(({ 
  lat, 
  lng, 
  address, 
  roofSize,
  roofPolygon,
  propertyData, // Property data from Rentcast API
  enableDrawing = false,
  onMapReady, 
  onMapError, 
  onPolygonCreated 
}, ref) => {
  const mapContainerRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [polygonInstance, setPolygonInstance] = useState(null);
  const [markerInstance, setMarkerInstance] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [loadingTimeout, setLoadingTimeout] = useState(null);
  
  console.log("EnhancedGoogleMapContainer rendering with props:", { 
    lat, lng, address, roofSize,
    hasRoofPolygon: !!roofPolygon && Array.isArray(roofPolygon),
    hasPropertyData: !!propertyData,
    propertyType: propertyData?.propertyType || 'unknown'
  });
  
  // Exposed methods
  useImperativeHandle(ref, () => ({ 
    zoomIn: () => {
      if (mapInstance) {
        const currentZoom = mapInstance.getZoom() || 19;
        mapInstance.setZoom(currentZoom + 1);
      }
    },
    zoomOut: () => {
      if (mapInstance) {
        const currentZoom = mapInstance.getZoom() || 19;
        mapInstance.setZoom(Math.max(currentZoom - 1, 1));
      }
    },
    getMapInstance: () => mapInstance,
    getPolygonInstance: () => polygonInstance,
    fitPolygon: () => {
      if (mapInstance && polygonInstance) {
        const bounds = new window.google.maps.LatLngBounds();
        const path = polygonInstance.getPath();
        for (let i = 0; i < path.getLength(); i++) {
          bounds.extend(path.getAt(i));
        }
        mapInstance.fitBounds(bounds);
      }
    },
    updatePolygon: (newPropertyData) => {
      if (!mapInstance || !validLat || !validLng) return;
      
      // Remove existing polygon
      if (polygonInstance) {
        polygonInstance.setMap(null);
      }
      
      // Create new polygon with updated property data
      const polygonCoords = createRoofPolygon(validLat, validLng, roofSize, roofPolygon, newPropertyData);
      
      // Create the polygon on the map
      const polygon = new window.google.maps.Polygon({
        paths: polygonCoords,
        strokeColor: '#2563EB',
        strokeOpacity: 1.0,
        strokeWeight: 3,
        fillColor: '#2563EB',
        fillOpacity: 0.4,
        map: mapInstance
      });
      setPolygonInstance(polygon);
      
      // Calculate area from the polygon
      const area = calculatePolygonArea(polygonCoords, newPropertyData);
      
      // Fit map bounds to show the polygon
      const bounds = new window.google.maps.LatLngBounds();
      polygonCoords.forEach(coord => {
        bounds.extend(coord);
      });
      mapInstance.fitBounds(bounds);
      
      // Notify parent
      onPolygonCreated && onPolygonCreated(polygon, area);
    }
  }));
  
  // Parse coordinates
  const validLat = parseFloat(lat);
  const validLng = parseFloat(lng);
  
  // Helper function to calculate centroid of a polygon
  const calculateCentroid = (polygonCoords) => {
    let latSum = 0;
    let lngSum = 0;
    
    polygonCoords.forEach(point => {
      latSum += point.lat;
      lngSum += point.lng;
    });
    
    return {
      lat: latSum / polygonCoords.length,
      lng: lngSum / polygonCoords.length
    };
  };
  
  // CRITICAL FIX: Function to create accurate polygon based on roof size and center it correctly
  const createRoofPolygon = (validLat, validLng, size, providedPolygon = null, currentPropertyData = null) => {
    console.log("Creating roof polygon with:", {
      lat: validLat,
      lng: validLng,
      size,
      hasProvidedPolygon: !!providedPolygon && Array.isArray(providedPolygon),
      hasPropertyData: !!(currentPropertyData || propertyData)
    });
    
    // If we have polygon coordinates from the backend, use them but fix scaling issues
    if (providedPolygon && Array.isArray(providedPolygon) && providedPolygon.length >= 3) {
      console.log("Using provided roof polygon coordinates");
      
      // Fix 1: Center the provided polygon on the exact marker location
      const providedCentroid = calculateCentroid(providedPolygon);
      
      // Calculate offset from current marker position
      const latOffset = validLat - providedCentroid.lat;
      const lngOffset = validLng - providedCentroid.lng;
      
      // Reposition polygon to be centered on marker
      const repositionedPolygon = providedPolygon.map(point => ({
        lat: point.lat + latOffset,
        lng: point.lng + lngOffset
      }));
      
      // Fix 2: Now scale the repositioned polygon to match the desired size
      const fixedPolygon = polygonDebugTool.fixPolygonScaling(repositionedPolygon, size);
      
      return fixedPolygon;
    }
    
    // Use property data for better polygon generation (use passed data or component prop)
    const dataToUse = currentPropertyData || propertyData;
    
    if (dataToUse) {
      console.log("Using property data for enhanced polygon generation:", dataToUse.propertyType);
      
      // Generate property-specific polygon directly centered on marker
      const propertyPolygon = propertyPolygonGenerator.generatePropertyPolygon(
        validLat, 
        validLng, 
        size, 
        dataToUse
      );
      
      return propertyPolygon;
    }
    
    // Fallback to size-based polygon generation centered on marker
    console.log("Using size-based polygon generation");
    const sizeBasedPolygon = propertyPolygonGenerator.generateSizeBasedPolygon(validLat, validLng, size);
    
    return sizeBasedPolygon;
  };
  
  // Calculate polygon area in square feet
  const calculatePolygonArea = (polygon, currentPropertyData = null) => {
    // Use passed property data or the component prop
    const dataToUse = currentPropertyData || propertyData;
    
    // If we have verified building size from property data, use that
    if (dataToUse && dataToUse.buildingSize) {
      // Calculate roof size from building size if property data available
      const calculatedRoofSize = propertyPolygonGenerator.calculateRoofSizeFromBuildingSize(
        dataToUse.buildingSize,
        dataToUse
      );
      
      if (calculatedRoofSize) {
        console.log("Using roof size calculated from verified building data:", calculatedRoofSize);
        return calculatedRoofSize;
      }
    }
    
    if (!window.google || !window.google.maps || !window.google.maps.geometry) {
      console.warn("Google Maps geometry library not available for area calculation");
      return roofSize || 2500; // Return the provided roof size as fallback
    }
    
    try {
      // Convert to Google LatLng objects if needed
      const googleLatLngs = [];
      
      // Handle both polygon objects and coordinate arrays
      if (polygon.getPath) {
        // It's a Google Maps Polygon object
        const path = polygon.getPath();
        for (let i = 0; i < path.getLength(); i++) {
          googleLatLngs.push(path.getAt(i));
        }
      } else {
        // It's an array of coordinates
        for (let i = 0; i < polygon.length; i++) {
          googleLatLngs.push(new window.google.maps.LatLng(
            polygon[i].lat,
            polygon[i].lng
          ));
        }
      }
      
      // Calculate area using Google Maps geometry library
      const areaInSquareMeters = window.google.maps.geometry.spherical.computeArea(googleLatLngs);
      // Convert to square feet (1 sq meter = 10.7639 sq feet)
      const areaInSquareFeet = Math.round(areaInSquareMeters * 10.7639);
      
      console.log("Calculated polygon area:", areaInSquareFeet, "sq ft");
      
      // Check if calculated area is reasonable
      const minReasonableSize = 500;
      const maxReasonableSize = 10000;
      
      if (areaInSquareFeet < minReasonableSize || areaInSquareFeet > maxReasonableSize) {
        console.warn("Calculated area is outside reasonable range, using provided size instead");
        return roofSize || 2500;
      }
      
      return areaInSquareFeet;
    } catch (error) {
      console.error("Error calculating polygon area:", error);
      return roofSize || 2500; // Return the provided roof size as fallback
    }
  };
  
  // Update polygon when roof size changes
  const updatePolygonForSize = (size) => {
    if (!mapInstance || !validLat || !validLng) return;
    
    // Remove existing polygon
    if (polygonInstance) {
      polygonInstance.setMap(null);
    }
    
    // Create new polygon with updated size
    const polygonCoords = createRoofPolygon(validLat, validLng, size, null, propertyData);
    
    // Create the polygon on the map
    const polygon = new window.google.maps.Polygon({
      paths: polygonCoords,
      strokeColor: '#2563EB',
      strokeOpacity: 1.0,
      strokeWeight: 3,
      fillColor: '#2563EB',
      fillOpacity: 0.4,
      map: mapInstance
    });
    setPolygonInstance(polygon);
    
    // Calculate area from the polygon
    const area = calculatePolygonArea(polygonCoords, propertyData);
    
    // Fit map bounds to show the polygon
    const bounds = new window.google.maps.LatLngBounds();
    polygonCoords.forEach(coord => {
      bounds.extend(coord);
    });
    mapInstance.fitBounds(bounds);
    
    // Notify parent
    onPolygonCreated && onPolygonCreated(polygon, area);
  };
  
  // Initialize map when component mounts
  useEffect(() => {
    // Create a timeout to handle potential freezes
    const timeoutId = setTimeout(() => {
      const errorMsg = "Map initialization timed out after 15 seconds";
      console.error(errorMsg);
      setErrorMessage(errorMsg);
      onMapError && onMapError(errorMsg);
    }, 15000);
    
    setLoadingTimeout(timeoutId);
    
    try {
      // Ensure we have valid coordinates
      if (isNaN(validLat) || isNaN(validLng)) {
        const errorMsg = `Invalid coordinates: ${lat}, ${lng}`;
        console.error(errorMsg);
        setErrorMessage(errorMsg);
        onMapError && onMapError(errorMsg);
        clearTimeout(timeoutId);
        return () => {};
      }

      if (!mapContainerRef.current) {
        const errorMsg = "Map container element not found";
        console.error(errorMsg);
        setErrorMessage(errorMsg);
        onMapError && onMapError(errorMsg);
        clearTimeout(timeoutId);
        return () => {};
      }
      
      console.log("Loading Google Maps API...");
      
      // Load Google Maps API
      const loadGoogleMapsApi = () => {
        return new Promise((resolve, reject) => {
          if (window.google && window.google.maps) {
            console.log("Google Maps already loaded");
            resolve(window.google.maps);
            return;
          }
          
          const API_KEY = config.googleMapsApiKey;
          
          if (!API_KEY) {
            console.error("Google Maps API key is missing in environment variables");
            reject(new Error("Google Maps API key is missing. Check your environment variables."));
            return;
          }
          
          console.log("Google Maps API Key:", API_KEY ? "Present" : "MISSING");
          
          // Create callback function
          window.initGoogleMapsCallback = () => {
            console.log("Google Maps loaded via callback");
            resolve(window.google.maps);
            delete window.initGoogleMapsCallback;
          };
          
          // Create script element
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places,geometry,drawing&callback=initGoogleMapsCallback`;
          script.async = true;
          script.defer = true;
          
          script.onerror = (error) => {
            console.error("Error loading Google Maps API:", error);
            reject(new Error("Failed to load Google Maps API. Check your internet connection and API key."));
          };
          
          // Add script to document
          document.head.appendChild(script);
          
          // Add extra timeout just for the script loading
          setTimeout(() => {
            if (!window.google || !window.google.maps) {
              reject(new Error("Google Maps API loading timed out"));
            }
          }, 10000);
        });
      };
      
      // Function to create the map
      const initMap = async () => {
        try {
          // Load Google Maps API
          await loadGoogleMapsApi();
          
          // Clear the timeout since API loaded successfully
          clearTimeout(timeoutId);
          
          console.log("Creating map with coordinates:", validLat, validLng);
          
          // Create map instance
          const map = new window.google.maps.Map(mapContainerRef.current, {
            center: { lat: validLat, lng: validLng },
            zoom: 19,
            mapTypeId: 'satellite',
            tilt: 0,
            mapTypeControl: false,
            streetViewControl: false,
            rotateControl: false,
            fullscreenControl: true
          });
          
          console.log("Map created successfully");
          setMapInstance(map);
          
          // Create marker
          const marker = new window.google.maps.Marker({
            position: { lat: validLat, lng: validLng },
            map: map,
            title: address || "Selected location"
          });
          setMarkerInstance(marker);
          
          // Run test code to verify polygon debug tool works
          if (process.env.NODE_ENV === 'development') {
            console.group("🔍 DEBUG: Polygon Debug Tool Test");
            const testPolygon = polygonDebugTool.generateTestPolygon(validLat, validLng, roofSize);
            console.log("Test polygon generated for", roofSize, "sq ft:");
            polygonDebugTool.debugPolygon(testPolygon, roofSize);
              
            // Scale it improperly to simulate the issue
            const scaledDown = testPolygon.map(point => {
              return {
                lat: validLat + (point.lat - validLat) * 0.1,
                lng: validLng + (point.lng - validLng) * 0.1
              };
            });
            console.log("Scaled down polygon (simulating issue):");
            polygonDebugTool.debugPolygon(scaledDown, roofSize);
              
            // Fix it using the tool
            const fixed = polygonDebugTool.fixPolygonScaling(scaledDown, roofSize);
            console.log("Fixed polygon:");
            polygonDebugTool.debugPolygon(fixed, roofSize);
            console.groupEnd();
          }
          
          // CRITICAL FIX: Create polygon precisely centered on the marker position
          const polygonCoords = createRoofPolygon(validLat, validLng, roofSize, roofPolygon);
          
          // Debug the final polygon coordinates
          console.log("Final polygon coordinates for map display:", JSON.stringify(polygonCoords));
          
          // Create the polygon on the map
          const polygon = new window.google.maps.Polygon({
            paths: polygonCoords,
            strokeColor: '#2563EB',
            strokeOpacity: 1.0,
            strokeWeight: 3,
            fillColor: '#2563EB',
            fillOpacity: 0.4,
            map: map
          });
          setPolygonInstance(polygon);
          
          // Calculate area from the polygon
          const area = calculatePolygonArea(polygonCoords);
          
          // Fit map bounds to show the polygon
          const bounds = new window.google.maps.LatLngBounds();
          polygonCoords.forEach(coord => {
            bounds.extend(coord);
          });
          map.fitBounds(bounds);
          
          // Add zoom control buttons above Google's built-in zoom control
          const zoomControlDiv = document.createElement('div');
          zoomControlDiv.style.marginBottom = '10px';
          
          // Create zoom in button
          const zoomInButton = document.createElement('button');
          zoomInButton.innerHTML = '+';
          zoomInButton.style.width = '30px';
          zoomInButton.style.height = '30px';
          zoomInButton.style.marginBottom = '5px';
          zoomInButton.style.border = 'none';
          zoomInButton.style.borderRadius = '2px';
          zoomInButton.style.backgroundColor = 'white';
          zoomInButton.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)';
          zoomInButton.style.cursor = 'pointer';
          zoomInButton.onclick = () => {
            map.setZoom(map.getZoom() + 1);
          };
          
          // Create zoom out button
          const zoomOutButton = document.createElement('button');
          zoomOutButton.innerHTML = '–';
          zoomOutButton.style.width = '30px';
          zoomOutButton.style.height = '30px';
          zoomOutButton.style.border = 'none';
          zoomOutButton.style.borderRadius = '2px';
          zoomOutButton.style.backgroundColor = 'white';
          zoomOutButton.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)';
          zoomOutButton.style.cursor = 'pointer';
          zoomOutButton.onclick = () => {
            map.setZoom(map.getZoom() - 1);
          };
          
          // Add buttons to the div
          zoomControlDiv.appendChild(zoomInButton);
          zoomControlDiv.appendChild(document.createElement('br'));
          zoomControlDiv.appendChild(zoomOutButton);
          
          // Add the div to the top right of the map
          map.controls[window.google.maps.ControlPosition.TOP_RIGHT].push(zoomControlDiv);
          
          // Notify parent components
          onMapReady && onMapReady(map);
          onPolygonCreated && onPolygonCreated(polygon, area);
        } catch (error) {
          console.error("Error initializing map:", error);
          setErrorMessage(error.message || "Failed to initialize Google Maps");
          onMapError && onMapError(error.message || "Failed to initialize Google Maps");
          clearTimeout(timeoutId);
        }
      };
      
      // Initialize the map
      initMap();
      
      // Cleanup function
      return () => {
        clearTimeout(timeoutId);
        if (polygonInstance) polygonInstance.setMap(null);
        if (markerInstance) markerInstance.setMap(null);
        if (mapInstance && window.google?.maps?.event) {
          window.google.maps.event.clearInstanceListeners(mapInstance);
        }
      };
    } catch (error) {
      console.error("Critical error in map component:", error);
      setErrorMessage(error.message || "Unknown map error");
      onMapError && onMapError(error.message || "Unknown map error");
      clearTimeout(timeoutId);
      return () => {};
    }
  }, [lat, lng, address, roofSize, roofPolygon, onMapReady, onMapError, onPolygonCreated]);

  // Watch for roof size changes and update polygon accordingly
  useEffect(() => {
    if (mapInstance && polygonInstance && roofSize) {
      console.log("Roof size changed, updating polygon:", roofSize);
      updatePolygonForSize(roofSize);
    }
  }, [roofSize, mapInstance]);

  // Update polygon when property data changes
  useEffect(() => {
    if (mapInstance && polygonInstance && propertyData) {
      console.log("Property data updated, updating polygon");
      
      // Remove existing polygon
      polygonInstance.setMap(null);
      
      // Create new polygon with updated property data
      const polygonCoords = createRoofPolygon(validLat, validLng, roofSize, roofPolygon);
      
      // Create the polygon on the map
      const polygon = new window.google.maps.Polygon({
        paths: polygonCoords,
        strokeColor: '#2563EB',
        strokeOpacity: 1.0,
        strokeWeight: 3,
        fillColor: '#2563EB',
        fillOpacity: 0.4,
        map: mapInstance
      });
      setPolygonInstance(polygon);
      
      // Calculate area from the polygon
      const area = calculatePolygonArea(polygonCoords);
      
      // Fit map bounds to show the polygon
      const bounds = new window.google.maps.LatLngBounds();
      polygonCoords.forEach(coord => {
        bounds.extend(coord);
      });
      mapInstance.fitBounds(bounds);
      
      // Notify parent
      onPolygonCreated && onPolygonCreated(polygon, area);
    }
  }, [propertyData]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
    };
  }, [loadingTimeout]);

  // Simple error display
  if (errorMessage) {
    return (
      <div style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f8f8f8',
        color: '#e53e3e',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div>
          <p>Error loading map: {errorMessage}</p>
          <p style={{ fontSize: '14px', marginTop: '10px' }}>
            Coordinates: {lat}, {lng}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
    ></div>
  );
});

EnhancedGoogleMapContainer.displayName = 'EnhancedGoogleMapContainer';

export default EnhancedGoogleMapContainer;
