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
    fitMapToAddress: () => {
      if (mapInstance && validLat && validLng) {
        mapInstance.setCenter({ lat: validLat, lng: validLng });
        mapInstance.setZoom(19); // Close zoom to show the property
      }
    }
  }));
  
  // Parse coordinates
  const validLat = parseFloat(lat);
  const validLng = parseFloat(lng);
  
  // Calculate roof size (without using polygon)
  const calculateRoofSize = (currentPropertyData = null) => {
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
    
    // Return the provided roof size as fallback
    return roofSize || 2500;
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
          
          // Calculate roof size without creating polygon
          const calculatedSize = calculateRoofSize(propertyData);
          
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
          
          // Notify about the calculated size without creating a polygon
          onPolygonCreated && onPolygonCreated(null, calculatedSize);
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
  }, [lat, lng, address, roofSize, onMapReady, onMapError, onPolygonCreated]);

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
