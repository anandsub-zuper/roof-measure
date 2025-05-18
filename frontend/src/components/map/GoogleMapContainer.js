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
    try {
      // Ensure we have valid coordinates
      const validLat = parseFloat(lat);
      const validLng = parseFloat(lng);
      
      if (isNaN(validLat) || isNaN(validLng)) {
        const errorMsg = `Invalid coordinates: ${lat}, ${lng}`;
        console.error(errorMsg);
        setErrorMessage(errorMsg);
        onMapError && onMapError(errorMsg);
        return () => {}; // Return empty cleanup function
      }

      if (!mapContainerRef.current) {
        const errorMsg = "Map container element not found";
        console.error(errorMsg);
        setErrorMessage(errorMsg);
        onMapError && onMapError(errorMsg);
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
            reject(new Error("Google Maps API key is missing"));
            return;
          }
          
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
            reject(error);
          };
          
          // Add script to document
          document.head.appendChild(script);
        });
      };
      
      // Function to create the map
      const initMap = async () => {
        try {
          // Load Google Maps API
          await loadGoogleMapsApi();
          
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
          const area = 2500; // Default area estimate
          
          // Notify parent components
          onMapReady && onMapReady(map);
          onPolygonCreated && onPolygonCreated(polygon, area);
        } catch (error) {
          console.error("Error initializing map:", error);
          setErrorMessage(error.message);
          onMapError && onMapError(error.message);
        }
      };
      
      // Initialize the map
      initMap();
      
      // Cleanup function
      return () => {
        if (polygonInstance) polygonInstance.setMap(null);
        if (markerInstance) markerInstance.setMap(null);
        if (mapInstance && window.google?.maps?.event) {
          window.google.maps.event.clearInstanceListeners(mapInstance);
        }
      };
    } catch (error) {
      console.error("Critical error in map component:", error);
      setErrorMessage(error.message);
      onMapError && onMapError(error.message);
      return () => {};
    }
  }, [lat, lng, address, onMapReady, onMapError, onPolygonCreated]);

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
