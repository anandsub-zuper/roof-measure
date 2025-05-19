// src/components/map/LeafletMeasurementOverlay.js
import React, { useEffect, useRef } from 'react';
import * as turfUtils from '../../utils/turfUtils';

const LeafletMeasurementOverlay = ({ 
  googleMapInstance, 
  roofPolygon, 
  coordinates, 
  roofSize,
  onPolygonUpdated, 
  onAreaMeasured
}) => {
  const leafletContainerRef = useRef(null);
  const leafletMapRef = useRef(null);
  const polygonLayerRef = useRef(null);
  
  // Initialize Leaflet map and sync with Google Maps
  useEffect(() => {
    if (!leafletContainerRef.current || !googleMapInstance || !window.L) return;
    
    // Create container that overlays exactly on Google Maps
    const container = leafletContainerRef.current;
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.right = '0';
    container.style.bottom = '0';
    container.style.zIndex = '10';
    container.style.pointerEvents = 'none'; // Pass mouse events through to Google Maps
    
    // Initialize Leaflet map with transparent background
    const leafletMap = L.map(container, {
      center: [coordinates.lat, coordinates.lng],
      zoom: 19,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      dragging: false,
      keyboard: false,
    });
    
    // Set transparent pane for overlay
    leafletMap.createPane('overlayPane');
    leafletMap.getPane('overlayPane').style.zIndex = 499; // Above tiles, below markers
    leafletMap.getPane('overlayPane').style.pointerEvents = 'all'; // Can interact with this layer
    
    // Store reference to map
    leafletMapRef.current = leafletMap;
    
    // Sync Leaflet with Google Maps
    function syncLeafletWithGoogle() {
      if (!googleMapInstance || !leafletMap) return;
      
      const center = googleMapInstance.getCenter();
      const zoom = googleMapInstance.getZoom();
      
      leafletMap.setView([center.lat(), center.lng()], zoom, { animate: false });
    }
    
    // Listen for Google Maps events to sync
    const listeners = [
      googleMapInstance.addListener('bounds_changed', syncLeafletWithGoogle),
      googleMapInstance.addListener('zoom_changed', syncLeafletWithGoogle)
    ];
    
    // Initial sync
    syncLeafletWithGoogle();
    
    // Initialize draw controls for manual refinement
    const drawControl = new L.Control.Draw({
      draw: {
        polyline: false,
        circle: false,
        rectangle: false,
        marker: false,
        circlemarker: false,
        polygon: {
          allowIntersection: false,
          showArea: true,
          drawError: {
            color: '#e1e100',
            message: '<strong>Oh snap!</strong> You can\'t draw that!'
          },
          shapeOptions: {
            color: '#2563EB',
            fillColor: '#2563EB',
            fillOpacity: 0.4
          }
        }
      },
      edit: {
        featureGroup: new L.FeatureGroup(),
        remove: true
      }
    });
    
    leafletMap.addControl(drawControl);
    
    // Make draw controls visible only when Edit button is clicked
    document.querySelectorAll('.leaflet-draw').forEach(el => {
      el.style.display = 'none';
      el.style.pointerEvents = 'all';
    });
    
    // Cleanup on unmount
    return () => {
      listeners.forEach(listener => 
        window.google.maps.event.removeListener(listener)
      );
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [googleMapInstance, coordinates]);
  
  // Draw the roof polygon in Leaflet
  useEffect(() => {
    if (!leafletMapRef.current || !roofPolygon || !roofPolygon.length) return;
    
    // Clear existing polygon
    if (polygonLayerRef.current) {
      leafletMapRef.current.removeLayer(polygonLayerRef.current);
    }
    
    // Convert Google polygon to Leaflet format
    const leafletPolygon = roofPolygon.map(point => [point.lat, point.lng]);
    
    // Create polygon with style
    const polygon = L.polygon(leafletPolygon, {
      color: '#2563EB',
      weight: 3,
      opacity: 0.8,
      fillColor: '#2563EB',
      fillOpacity: 0.3,
      pane: 'overlayPane'
    });
    
    // Add to map
    polygon.addTo(leafletMapRef.current);
    polygonLayerRef.current = polygon;
    
    // Calculate area with Turf
    const area = turfUtils.calculatePolygonArea(roofPolygon);
    if (area && area > 0) {
      onAreaMeasured && onAreaMeasured(area);
    }
    
    // Set up edit events to capture changes
    leafletMapRef.current.on('draw:edited', (e) => {
      const layers = e.layers;
      let newPolygon = null;
      
      layers.eachLayer((layer) => {
        if (layer instanceof L.Polygon) {
          const latLngs = layer.getLatLngs()[0];
          newPolygon = latLngs.map(latLng => ({
            lat: latLng.lat,
            lng: latLng.lng
          }));
        }
      });
      
      if (newPolygon) {
        onPolygonUpdated && onPolygonUpdated(newPolygon);
        
        // Recalculate area
        const newArea = turfUtils.calculatePolygonArea(newPolygon);
        if (newArea && newArea > 0) {
          onAreaMeasured && onAreaMeasured(newArea);
        }
      }
    });
    
    // Set up event for completed drawings
    leafletMapRef.current.on('draw:created', (e) => {
      const layer = e.layer;
      
      if (layer instanceof L.Polygon) {
        const latLngs = layer.getLatLngs()[0];
        const newPolygon = latLngs.map(latLng => ({
          lat: latLng.lat,
          lng: latLng.lng
        }));
        
        // Add to map
        if (polygonLayerRef.current) {
          leafletMapRef.current.removeLayer(polygonLayerRef.current);
        }
        layer.addTo(leafletMapRef.current);
        polygonLayerRef.current = layer;
        
        onPolygonUpdated && onPolygonUpdated(newPolygon);
        
        // Calculate area
        const newArea = turfUtils.calculatePolygonArea(newPolygon);
        if (newArea && newArea > 0) {
          onAreaMeasured && onAreaMeasured(newArea);
        }
      }
    });
    
  }, [leafletMapRef.current, roofPolygon, onPolygonUpdated, onAreaMeasured]);

  return (
    <>
      <div 
        ref={leafletContainerRef} 
        className="leaflet-container"
        style={{ 
          width: '100%', 
          height: '100%', 
          background: 'transparent',
          pointerEvents: 'none'
        }}
      />
      <div className="absolute bottom-2 right-2 z-20">
        <button 
          className="bg-white p-2 rounded-md shadow-md text-xs text-gray-700 flex items-center"
          onClick={() => {
            // Toggle visibility of Leaflet draw controls
            document.querySelectorAll('.leaflet-draw').forEach(el => {
              el.style.display = el.style.display === 'none' ? 'block' : 'none';
              el.style.pointerEvents = 'all';
            });
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          Edit Roof
        </button>
      </div>
    </>
  );
};

export default LeafletMeasurementOverlay;
