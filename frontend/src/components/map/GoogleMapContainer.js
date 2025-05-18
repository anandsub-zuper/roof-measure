// src/components/map/GoogleMapContainer.js with forwardRef for proper ref handling

import React, { useEffect, forwardRef, useImperativeHandle } from 'react';

// This component creates a completely isolated container for Google Maps
// to prevent React from trying to manage its DOM
const GoogleMapContainer = forwardRef(({ 
  lat, 
  lng, 
  address, 
  onMapReady, 
  onMapError, 
  onPolygonCreated 
}, ref) => {
  let mapInstanceRef = null;
  let polygonRef = null;
  let mapInitialized = false;

  // Methods to control the map from outside
  const zoomIn = () => {
    if (mapInstanceRef) {
      const currentZoom = mapInstanceRef.getZoom() || 19;
      mapInstanceRef.setZoom(currentZoom + 1);
    }
  };

  const zoomOut = () => {
    if (mapInstanceRef) {
      const currentZoom = mapInstanceRef.getZoom() || 19;
      mapInstanceRef.setZoom(currentZoom - 1);
    }
  };

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    zoomIn,
    zoomOut,
    getMapInstance: () => mapInstanceRef
  }));

  useEffect(() => {
    const containerRef = document.createElement('div');
    let mapContainer = null;
    
    const initialize = () => {
      // Create a div element that React won't try to manage
      mapContainer = document.createElement('div');
      mapContainer.style.width = '100%';
      mapContainer.style.height = '100%';
      mapContainer.style.position = 'absolute';
      mapContainer.style.top = '0';
      mapContainer.style.left = '0';
      mapContainer.style.zIndex = '1'; // Ensure it's above other elements
      
      // Append to the parent container
      containerRef.appendChild(mapContainer);
      
      // Load the Google Maps API
      const loadGoogleMapsAPI = () => {
        if (window.google && window.google.maps) {
          initializeMap(mapContainer);
          return;
        }

        const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_PUBLIC_KEY;
        if (!API_KEY) {
          onMapError && onMapError("Google Maps API key is missing");
          return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places,geometry`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
          initializeMap(mapContainer);
        };
        script.onerror = () => {
          onMapError && onMapError("Failed to load Google Maps API");
        };

        document.head.appendChild(script);
      };

      // Initialize the map with the container
      const initializeMap = (container) => {
        if (!window.google?.maps) {
          onMapError && onMapError("Google Maps not available");
          return;
        }

        try {
          const parsedLat = parseFloat(lat);
          const parsedLng = parseFloat(lng);

          if (isNaN(parsedLat) || isNaN(parsedLng)) {
            onMapError && onMapError("Invalid coordinates");
            return;
          }

          // Create map instance
          const mapInstance = new window.google.maps.Map(container, {
            center: { lat: parsedLat, lng: parsedLng },
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

          // Save the reference
          mapInstanceRef = mapInstance;
          mapInitialized = true;
          
          // Create a marker at the center
          new window.google.maps.Marker({
            position: { lat: parsedLat, lng: parsedLng },
            map: mapInstance,
            title: address,
            zIndex: 1000
          });

          // Notify parent that map is ready
          onMapReady && onMapReady(mapInstance);

          // Try to create the roof polygon
          createRoofPolygon(mapInstance, parsedLat, parsedLng, address);
        } catch (error) {
          console.error("Error initializing map:", error);
          onMapError && onMapError("Error initializing map");
        }
      };

      // Create roof polygon - either from Places API or fallback to estimation
      const createRoofPolygon = (mapInstance, lat, lng, address) => {
        // Helper to create polygon from coordinates
        const createPolygon = (coords) => {
          if (!window.google?.maps) return null;
          
          // Ensure coordinates are valid Google Maps LatLng objects
          const validCoords = coords.map(coord => {
            if (typeof coord.lat === 'function') {
              // Already a LatLng object
              return coord;
            } else {
              // Create new LatLng object
              return new window.google.maps.LatLng(coord.lat, coord.lng);
            }
          });
          
          // Create the polygon with stronger visual styling
          const polygon = new window.google.maps.Polygon({
            paths: validCoords,
            strokeColor: '#2563EB', // Blue outline
            strokeOpacity: 1.0,     // Fully opaque
            strokeWeight: 3,        // Thicker line
            fillColor: '#2563EB',   // Blue fill
            fillOpacity: 0.4,       // Semi-transparent
            zIndex: 100,
            map: mapInstance
          });
          
          // Save the polygon reference
          polygonRef = polygon;
          
          // Calculate square footage and pass with the polygon
          const area = calculatePolygonArea(validCoords);
          
          if (onPolygonCreated) {
            onPolygonCreated(polygon, area);
          }
          
          return polygon;
        };
        
        // Calculate area in square feet for a polygon
        const calculatePolygonArea = (latLngCoords) => {
          if (!window.google?.maps?.geometry?.spherical) {
            console.warn("Google Maps Geometry library not available for area calculation");
            return 2500; // Default fallback area (sq ft)
          }
          
          try {
            // Calculate area in square meters
            const areaInSquareMeters = window.google.maps.geometry.spherical.computeArea(latLngCoords);
            
            // Convert to square feet (1 sq meter = 10.7639 sq feet)
            const areaInSquareFeet = areaInSquareMeters * 10.7639;
            
            // Apply a roof steepness factor (estimated)
            // Assuming average roof is ~20-30% steeper than the flat projection
            const steepnessFactor = 1.25;
            
            // Round to the nearest whole number
            return Math.round(areaInSquareFeet * steepnessFactor);
          } catch (error) {
            console.error("Error calculating area:", error);
            return 2500; // Default fallback area (sq ft)
          }
        };

        // Create a polygon - try Places API first, then fallback to estimation
        try {
          if (window.google?.maps?.places) {
            // Try using Places API
            try {
              const placesService = new window.google.maps.places.PlacesService(mapInstance);
              
              const request = {
                query: address,
                fields: ['geometry'],
                locationBias: { lat, lng },
              };

              placesService.findPlaceFromQuery(request, (results, status) => {
                let polygonCoords;

                if (status === 'OK' && results?.[0]?.geometry?.viewport) {
                  const bounds = results[0].geometry.viewport;
                  polygonCoords = [
                    bounds.getSouthWest(),
                    { lat: bounds.getSouthWest().lat(), lng: bounds.getNorthEast().lng() },
                    bounds.getNorthEast(),
                    { lat: bounds.getNorthEast().lat(), lng: bounds.getSouthWest().lng() }
                  ];
                } else {
                  // Fallback to estimated polygon
                  polygonCoords = createEstimatedPolygon(lat, lng);
                  if (status !== 'OK') {
                    onMapError && onMapError("Using estimated roof outline");
                  }
                }

                createPolygon(polygonCoords);
              });
            } catch (placeErr) {
              console.error("Error with Places API:", placeErr);
              const polygonCoords = createEstimatedPolygon(lat, lng);
              createPolygon(polygonCoords);
              onMapError && onMapError("Using estimated roof outline");
            }
          } else {
            // Places API not available, use estimated polygon
            const polygonCoords = createEstimatedPolygon(lat, lng);
            createPolygon(polygonCoords);
            onMapError && onMapError("Using estimated roof outline");
          }
        } catch (err) {
          console.error("Error creating polygon:", err);
          onMapError && onMapError("Error creating roof outline");
        }
      };

      // Create estimated polygon based on lat/lng
      const createEstimatedPolygon = (lat, lng) => {
        // Convert meters to degrees at the given latitude
        const metersToDegrees = (meters) => {
          const latRad = lat * (Math.PI / 180);
          const latDeg = 111132.92 - 559.82 * Math.cos(2 * latRad) + 1.175 * Math.cos(4 * latRad);
          const lngDeg = 111412.84 * Math.cos(latRad) - 93.5 * Math.cos(3 * latRad);
          return {
            lat: meters / latDeg,
            lng: meters / lngDeg
          };
        };

        const conversion = metersToDegrees(15);
        return [
          { lat: lat - conversion.lat * 0.6, lng: lng - conversion.lng * 0.8 }, // SW
          { lat: lat - conversion.lat * 0.6, lng: lng + conversion.lng * 0.8 }, // SE
          { lat: lat + conversion.lat * 0.4, lng: lng + conversion.lng * 0.8 }, // NE
          { lat: lat + conversion.lat * 0.4, lng: lng - conversion.lng * 0.8 }  // NW
        ];
      };

      // Start loading Google Maps
      loadGoogleMapsAPI();
    };

    initialize();

    // Mount the container to the DOM
    const rootElement = document.getElementById('map-root');
    if (rootElement) {
      rootElement.appendChild(containerRef);
    }

    // Clean up function
    return () => {
      if (polygonRef) {
        polygonRef.setMap(null);
        polygonRef = null;
      }
      
      if (mapInstanceRef && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(mapInstanceRef);
        mapInstanceRef = null;
      }
      
      if (rootElement && containerRef.parentNode === rootElement) {
        rootElement.removeChild(containerRef);
      }
      
      mapInitialized = false;
    };
  }, [lat, lng, address, onMapReady, onMapError, onPolygonCreated]);

  return (
    <div id="map-root" style={{ position: 'relative', width: '100%', height: '100%' }} />
  );
});

export default GoogleMapContainer;
