// src/components/map/LeafletMeasurementOverlay.js
import React, { useEffect, useRef, useState } from 'react';

const LeafletMeasurementOverlay = ({ 
  googleMapInstance, 
  googlePolygon, 
  coordinates, 
  roofSize,
  onAreaMeasured,
  debugMode = false
}) => {
  const leafletContainerRef = useRef(null);
  const [leafletMap, setLeafletMap] = useState(null);
  const [leafletPolygon, setLeafletPolygon] = useState(null);
  const [area, setArea] = useState(0);
  
  // Initialize Leaflet map
  useEffect(() => {
    if (!leafletContainerRef.current || !window.L) return;
    
    console.log("Initializing Leaflet overlay...");
    
    // Create the Leaflet map with transparent background
    const map = window.L.map(leafletContainerRef.current, {
      center: [coordinates.lat, coordinates.lng],
      zoom: 19,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      dragging: false,
      keyboard: false,
    });
    
    // Create transparent pane
    map.createPane('overlayPane');
    map.getPane('overlayPane').style.background = 'transparent';
    map.getPane('overlayPane').style.pointerEvents = 'none';
    
    // Store the map reference
    setLeafletMap(map);
    
    // Cleanup on unmount
    return () => {
      if (map) {
        map.remove();
      }
    };
  }, [leafletContainerRef, coordinates]);
  
  // Sync with Google Maps position and zoom
  useEffect(() => {
    if (!leafletMap || !googleMapInstance) return;
    
    const syncWithGoogle = () => {
      try {
        const center = googleMapInstance.getCenter();
        const zoom = googleMapInstance.getZoom();
        
        leafletMap.setView([center.lat(), center.lng()], zoom, {
          animate: false
        });
      } catch (err) {
        console.warn("Failed to sync Leaflet with Google Maps:", err);
      }
    };
    
    // Initial sync
    syncWithGoogle();
    
    // Listen for Google Maps events
    const boundsListener = googleMapInstance.addListener('bounds_changed', syncWithGoogle);
    const zoomListener = googleMapInstance.addListener('zoom_changed', syncWithGoogle);
    
    // Cleanup listeners
    return () => {
      window.google.maps.event.removeListener(boundsListener);
      window.google.maps.event.removeListener(zoomListener);
    };
  }, [leafletMap, googleMapInstance]);
  
  // Create/update polygon when Google polygon changes
  useEffect(() => {
    if (!leafletMap || !googlePolygon) return;
    
    console.log("Creating/updating Leaflet polygon...");
    
    // Convert Google polygon to Leaflet coordinates
    const googlePath = googlePolygon.getPath();
    const leafletCoords = [];
    
    for (let i = 0; i < googlePath.getLength(); i++) {
      const point = googlePath.getAt(i);
      leafletCoords.push([point.lat(), point.lng()]);
    }
    
    // Remove existing polygon
    if (leafletPolygon) {
      leafletPolygon.remove();
    }
    
    // Create new polygon with different styling
    const polygon = window.L.polygon(leafletCoords, {
      color: '#FF4500', // Orange-red (different from Google's blue)
      weight: 4,        // Slightly thicker 
      opacity: 0.9,
      fillColor: '#FF4500',
      fillOpacity: debugMode ? 0.3 : 0.0, // No fill in normal mode for comparison
      dashArray: '5, 5', // Dashed line to differentiate 
      pane: 'overlayPane'
    }).addTo(leafletMap);
    
    // Store reference
    setLeafletPolygon(polygon);
    
    // Calculate area with Turf.js if available
    if (window.turf) {
      try {
        // Convert to Turf format ([lng, lat] order)
        const turfCoords = leafletCoords.map(point => [point[1], point[0]]);
        
        // Close the polygon if needed
        if (turfCoords[0][0] !== turfCoords[turfCoords.length-1][0] || 
            turfCoords[0][1] !== turfCoords[turfCoords.length-1][1]) {
          turfCoords.push(turfCoords[0]);
        }
        
        // Create Turf polygon and calculate base area
        const turfPolygon = window.turf.polygon([turfCoords]);
        const areaInSquareMeters = window.turf.area(turfPolygon);
        
        // Determine pitch factor based on property type and other characteristics
        const propertyTypeString = localStorage.getItem('propertyType') || '';
        const storiesString = localStorage.getItem('stories') || '1';
        const stories = parseInt(storiesString, 10) || 1;
        
        // Default higher pitch factor for 2-story single family homes
        let pitchFactor = 1.3; // Default
        
        // Adjust factor based on property type and stories
        if (propertyTypeString.toLowerCase().includes('single') && stories >= 2) {
          pitchFactor = 2.0; // Higher pitch factor for 2-story single family
        } else if (stories >= 2) {
          pitchFactor = 1.8; // Other 2+ story buildings
        } else if (propertyTypeString.toLowerCase().includes('single')) {
          pitchFactor = 1.7; // Single story single family
        }
        
        console.log(`Using pitch factor: ${pitchFactor} for ${propertyTypeString}, ${stories} stories`);
        
        // Convert to square feet with pitch factor
        const areaInSquareFeet = Math.round(areaInSquareMeters * 10.7639 * pitchFactor);
        
        // Store and notify
        setArea(areaInSquareFeet);
        if (onAreaMeasured) {
          onAreaMeasured(areaInSquareFeet);
        }
        
        console.log("Leaflet+Turf area calculation:", {
          baseAreaSqM: areaInSquareMeters.toFixed(2),
          baseAreaSqFt: (areaInSquareMeters * 10.7639).toFixed(2),
          pitchFactor,
          adjustedAreaSqFt: areaInSquareFeet
        });
      } catch (err) {
        console.error("Error calculating area with Turf:", err);
      }
    }
  }, [leafletMap, googlePolygon, debugMode, onAreaMeasured]);
  
  return (
    <>
      <div 
        ref={leafletContainerRef}
        className="absolute inset-0 z-10 pointer-events-none"
        style={{ background: 'transparent' }}
      ></div>
      
      {debugMode && (
        <div className="absolute bottom-2 left-2 bg-white px-2 py-1 rounded text-xs z-20">
          Leaflet area: {area.toLocaleString()} sq ft
        </div>
      )}
    </>
  );
};

export default LeafletMeasurementOverlay;
