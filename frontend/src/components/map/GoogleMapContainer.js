// src/components/map/GoogleMapContainer.js
import React, { useEffect, forwardRef, useImperativeHandle, useState, useRef } from 'react';

const GoogleMapContainer = forwardRef(({ 
  lat, 
  lng, 
  address, 
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
  
  console.log("GoogleMapContainer rendering with props:", { lat, lng, address });
  
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
    getMapInstance: () => mapInstance
  }));
  
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
          
          const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_PUBLIC_KEY;
          
          if (!API_KEY) {
            console.error("Google Maps API key is missing in environment variables");
            reject(new Error("Google Maps API key is missing. Check your environment variables."));
            return;
          }
          
          console.log("Google Maps API Key:", API_KEY ? "Present (first 4 chars: " + API_KEY.substring(0,4) + "...)" : "MISSING");
          
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
          
          // Create a simple square polygon around the address
          const polygonCoords = [
            { lat: validLat - 0.0003, lng: validLng - 0.0003 },
            { lat: validLat - 0.0003, lng: validLng + 0.0003 },
            { lat: validLat + 0.0003, lng: validLng + 0.0003 },
            { lat: validLat + 0.0003, lng: validLng - 0.0003 }
          ];
          
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
          
          // Calculate area (simple formula for demonstration)
          const calculateArea = () => {
            if (window.google && window.google.maps && window.google.maps.geometry) {
              // Use Google's geometry library to calculate area
              const path = polygon.getPath();
              const googleLatLngs = [];
              for (let i = 0; i < path.getLength(); i++) {
                googleLatLngs.push(path.getAt(i));
              }
              
              // Calculate area in square meters
              const areaInSqMeters = window.google.maps.geometry.spherical.computeArea(googleLatLngs);
              // Convert to square feet (1 sq meter = 10.7639 sq feet)
              return Math.round(areaInSqMeters * 10.7639);
            }
            return 2500; // Default fallback
          };
          
          const area = calculateArea();
          console.log("Calculated area:", area, "sq ft");
          
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
  }, [lat, lng, address, onMapReady, onMapError, onPolygonCreated]);

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
