// src/components/map/GoogleMapContainer.js
import React, { useEffect, forwardRef, useImperativeHandle, useState } from 'react';
import * as mapsService from '../../services/mapsService';

const GoogleMapContainer = forwardRef(({ 
  lat, 
  lng, 
  address, 
  enableDrawing = false,
  onMapReady, 
  onMapError, 
  onPolygonCreated 
}, ref) => {
  const [mapInstance, setMapInstance] = useState(null);
  const [polygonInstance, setPolygonInstance] = useState(null);
  const [markerInstance, setMarkerInstance] = useState(null);
  
  // Debug: verify props
  useEffect(() => {
    console.log("GoogleMapContainer props:", {
      lat: typeof lat === 'number' ? lat : parseFloat(lat),
      lng: typeof lng === 'number' ? lng : parseFloat(lng), 
      isLatValid: !isNaN(parseFloat(lat)),
      isLngValid: !isNaN(parseFloat(lng)),
      address
    });
  }, [lat, lng, address]);
  
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
    // Add a method to create a new polygon manually
    createPolygon: (coordinates) => {
      // First, clear existing polygon
      if (polygonInstance) {
        polygonInstance.setMap(null);
      }
      
      // Create new polygon
      const newPolygon = mapsService.createPolygon(mapInstance, coordinates);
      setPolygonInstance(newPolygon);
      
      // Calculate area
      const area = mapsService.calculatePolygonArea(coordinates);
      
      // Notify parent
      if (onPolygonCreated) {
        onPolygonCreated(newPolygon, area);
      }
      
      return newPolygon;
    }
  }));
  
  // Initialize map when component mounts
  useEffect(() => {
    // Ensure we have valid coordinates
    const validLat = parseFloat(lat);
    const validLng = parseFloat(lng);
    
    if (isNaN(validLat) || isNaN(validLng)) {
      console.error("Invalid coordinates:", { lat, lng });
      onMapError && onMapError("Invalid coordinates");
      return;
    }

    const containerElement = document.getElementById('map-container');
    if (!containerElement) {
      console.error("Map container element not found");
      return;
    }
    
    let mapCleanup = null;
    
    const initializeMap = async () => {
      try {
        console.log("Initializing map with coordinates:", { lat: validLat, lng: validLng });
        
        // Load Google Maps API
        await mapsService.loadGoogleMapsApi();
        
        // Initialize the map
        const map = new window.google.maps.Map(containerElement, {
          center: { lat: validLat, lng: validLng },
          zoom: 19,
          mapTypeId: 'satellite',
          tilt: 0,
          mapTypeControl: false,
          streetViewControl: false,
          rotateControl: false,
          fullscreenControl: true,
          zoomControlOptions: {
            position: window.google.maps.ControlPosition.RIGHT_TOP
          }
        });
        
        console.log("Map initialized successfully");
        
        // Save the map instance
        setMapInstance(map);
        
        // Create marker at center
        const marker = new window.google.maps.Marker({
          position: { lat: validLat, lng: validLng },
          map: map,
          title: address || "Selected location",
          animation: window.google.maps.Animation.DROP
        });
        setMarkerInstance(marker);
        
        // Create a default estimated polygon
        const estimatedCoords = mapsService.createEstimatedPolygon(validLat, validLng);
        console.log("Creating estimated polygon with coordinates:", estimatedCoords);
        
        const polygon = new window.google.maps.Polygon({
          paths: estimatedCoords,
          strokeColor: '#2563EB',
          strokeOpacity: 1.0,
          strokeWeight: 3,
          fillColor: '#2563EB',
          fillOpacity: 0.4,
          map: map
        });
        setPolygonInstance(polygon);
        
        // Calculate estimated area
        const area = mapsService.calculatePolygonArea(estimatedCoords);
        console.log("Calculated area:", area);
        
        // Notify parent that map is ready
        onMapReady && onMapReady(map);

        // Notify parent of the estimated polygon
        onPolygonCreated && onPolygonCreated(polygon, area);
        
        // If drawing is enabled, setup drawing tools
        if (enableDrawing && window.google?.maps?.drawing) {
          const drawingManager = new window.google.maps.drawing.DrawingManager({
            drawingMode: null, // Start with drawing disabled
            drawingControl: true,
            drawingControlOptions: {
              position: window.google.maps.ControlPosition.TOP_CENTER,
              drawingModes: [window.google.maps.drawing.OverlayType.POLYGON]
            },
            polygonOptions: {
              fillColor: '#2563EB',
              strokeColor: '#2563EB',
              fillOpacity: 0.4,
              strokeWeight: 3,
              editable: true,
              zIndex: 100
            }
          });
          
          drawingManager.setMap(map);
          
          // Add listener for polygon complete
          window.google.maps.event.addListener(drawingManager, 'polygoncomplete', function(newPolygon) {
            // Remove the old polygon
            if (polygon) polygon.setMap(null);
            
            // Save the new polygon
            setPolygonInstance(newPolygon);
            
            // Calculate area
            const path = newPolygon.getPath().getArray();
            const newArea = mapsService.calculatePolygonArea(path);
            
            // Notify parent
            onPolygonCreated && onPolygonCreated(newPolygon, newArea);
            
            // Switch back to non-drawing mode
            drawingManager.setDrawingMode(null);
          });
        }
        
        // Setup cleanup function
        mapCleanup = () => {
          if (polygon) polygon.setMap(null);
          if (marker) marker.setMap(null);
          if (window.google?.maps?.event) {
            window.google.maps.event.clearInstanceListeners(map);
          }
        };
      } catch (error) {
        console.error("Error initializing map:", error);
        onMapError && onMapError("Error initializing map: " + error.message);
      }
    };
    
    initializeMap();
    
    // Cleanup function
    return () => {
      if (mapCleanup) mapCleanup();
    };
  }, [lat, lng, address, enableDrawing, onMapReady, onMapError, onPolygonCreated]);

  return (
    <div 
      id="map-container" 
      style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
    ></div>
  );
});

GoogleMapContainer.displayName = 'GoogleMapContainer';

export default GoogleMapContainer;
