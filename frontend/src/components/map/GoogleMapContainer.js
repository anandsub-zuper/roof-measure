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
    if (!lat || !lng) {
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
        // Initialize the map
        const map = await mapsService.initMap(containerElement, {
          center: { lat: parseFloat(lat), lng: parseFloat(lng) },
          zoom: 19
        });
        
        // Save the map instance
        setMapInstance(map);
        
        // Create marker at center
        const marker = new window.google.maps.Marker({
          position: { lat: parseFloat(lat), lng: parseFloat(lng) },
          map: map,
          title: address
        });
        setMarkerInstance(marker);
        
        // Create a default estimated polygon
        const estimatedCoords = mapsService.createEstimatedPolygon(parseFloat(lat), parseFloat(lng));
        const polygon = mapsService.createPolygon(map, estimatedCoords);
        setPolygonInstance(polygon);
        
        // Calculate estimated area
        const area = mapsService.calculatePolygonArea(estimatedCoords);
        
        // Notify parent that map is ready
        onMapReady && onMapReady(map);

        // Notify parent of the estimated polygon
        onPolygonCreated && onPolygonCreated(polygon, area);
        
        // If drawing is enabled, setup drawing tools
        if (enableDrawing) {
          mapsService.setupDrawingTools(map, (polygon, area) => {
            // Save the user-drawn polygon
            setPolygonInstance(polygon);
            
            // Notify parent
            onPolygonCreated && onPolygonCreated(polygon, area);
          });
        }
        
        // Setup cleanup function
        mapCleanup = () => {
          if (polygon) polygon.setMap(null);
          if (marker) marker.setMap(null);
          window.google?.maps?.event.clearInstanceListeners(map);
        };
      } catch (error) {
        console.error("Error initializing map:", error);
        onMapError && onMapError("Error initializing map");
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

export default GoogleMapContainer;
