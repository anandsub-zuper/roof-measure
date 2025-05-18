// src/components/map/GoogleMapContainer.js
import React, { useEffect, forwardRef, useImperativeHandle, useState, useRef } from 'react';
import config from '../../config'; // Make sure this path is correct

const GoogleMapContainer = forwardRef(({ 
  lat, 
  lng, 
  address, 
  roofSize,
  roofPolygon, // New prop to receive polygon coordinates from backend
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
  
  console.log("GoogleMapContainer rendering with props:", { lat, lng, address, roofSize });
  
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
    fitPolygon: () => {
      if (mapInstance && polygonInstance) {
        const bounds = new window.google.maps.LatLngBounds();
        const path = polygonInstance.getPath();
        for (let i = 0; i < path.getLength(); i++) {
          bounds.extend(path.getAt(i));
        }
        mapInstance.fitBounds(bounds);
      }
    }
  }));
  
  // Function to create accurate polygon based on roof size or provided coords
  const createRoofPolygon = (validLat, validLng, size, providedPolygon = null) => {
    // If we have polygon coordinates from the backend, use them
    if (providedPolygon && Array.isArray(providedPolygon) && providedPolygon.length >= 3) {
      console.log("Using provided roof polygon coordinates");
      return providedPolygon;
    }
    
    // Otherwise, create a better estimate using the house footprint approach
    console.log("Creating estimated roof polygon");
    const roofSizeSqFt = size || 2500;
    
    // Calculate aspect ratio based on typical house layouts
    // Most homes have aspect ratios between 1:1 and 1:2
    const aspectRatio = 1.5;
    
    // Calculate dimensions based on roof size and aspect ratio
    const area = roofSizeSqFt;
    const width = Math.sqrt(area / aspectRatio);
    const length = width * aspectRatio;
    
    // Convert to degrees
    const feetPerDegreeLat = 364000;
    const latRadians = validLat * (Math.PI / 180);
    const feetPerDegreeLng = feetPerDegreeLat * Math.cos(latRadians);
    
    const latOffset = (length / 2) / feetPerDegreeLat;
    const lngOffset = (width / 2) / feetPerDegreeLng;
    
    // Adjust the polygon to be better aligned with typical property layout
    // Moving it slightly back from the road (most address markers are near the street)
    const adjustedLat = validLat + (latOffset * 0.3); // Slight adjustment toward back of property
    
    // Create polygon using adjusted center point
    return [
      { lat: adjustedLat - latOffset, lng: validLng - lngOffset },
      { lat: adjustedLat - latOffset, lng: validLng + lngOffset },
      { lat: adjustedLat + latOffset, lng: validLng + lngOffset },
      { lat: adjustedLat + latOffset, lng: validLng - lngOffset }
    ];
  };
  
  // Calculate polygon area in square feet
  const calculatePolygonArea = (polygon) => {
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
      
      // Calculate area in square meters
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
      const validLat = parseFloat(lat);
      const validLng = parseFloat(lng);
      
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
      
      // Simple function to load Google Maps API
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
          
          // Create polygon using roof coordinates or estimate
          const polygonCoords = createRoofPolygon(validLat, validLng, roofSize, roofPolygon);
          
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
          // But IMPORTANT: We'll respect the provided roofSize rather than overwriting it
          // This preserves the backend's more accurate measurement
          const area = roofSize || calculatePolygonArea(polygonCoords);
          
          // Fit map bounds to show the polygon
          const bounds = new window.google.maps.LatLngBounds();
          polygonCoords.forEach(coord => {
            bounds.extend(coord);
          });
          map.fitBounds(bounds);
          
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

GoogleMapContainer.displayName = 'GoogleMapContainer';

export default GoogleMapContainer;
