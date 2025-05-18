// src/components/map/GoogleMapContainer.js
import React, { useRef, useEffect } from 'react';

// This component creates a completely isolated container for Google Maps
// to prevent React from trying to manage its DOM
const GoogleMapContainer = ({ 
  lat, 
  lng, 
  address, 
  onMapReady, 
  onMapError, 
  onPolygonCreated 
}) => {
  const containerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const mapInitializedRef = useRef(false);

  useEffect(() => {
    // Create a div element that React won't try to manage
    const mapContainer = document.createElement('div');
    mapContainer.style.width = '100%';
    mapContainer.style.height = '100%';
    mapContainer.style.position = 'absolute';
    mapContainer.style.top = '0';
    mapContainer.style.left = '0';
    
    // Only append if the ref is available and not already initialized
    if (containerRef.current && !mapInitializedRef.current) {
      containerRef.current.appendChild(mapContainer);
      
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

          // Save the reference to access later (for zoom controls, etc.)
          mapInstanceRef.current = mapInstance;
          mapInitializedRef.current = true;
          
          // Create a marker at the center
          new window.google.maps.Marker({
            position: { lat: parsedLat, lng: parsedLng },
            map: mapInstance,
            title: address
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
          
          const polygon = new window.google.maps.Polygon({
            paths: coords,
            strokeColor: '#2563EB',
            strokeOpacity: 0.9,
            strokeWeight: 2.5,
            fillColor: '#2563EB',
            fillOpacity: 0.4,
            zIndex: 100,
            map: mapInstance
          });

          onPolygonCreated && onPolygonCreated(polygon);
          return polygon;
        };

        // Create estimated polygon based on lat/lng
        const createEstimatedPolygon = () => {
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
                  polygonCoords = createEstimatedPolygon();
                  if (status !== 'OK') {
                    onMapError && onMapError("Using estimated roof outline");
                  }
                }

                createPolygon(polygonCoords);
              });
            } catch (placeErr) {
              console.error("Error with Places API:", placeErr);
              const polygonCoords = createEstimatedPolygon();
              createPolygon(polygonCoords);
              onMapError && onMapError("Using estimated roof outline");
            }
          } else {
            // Places API not available, use estimated polygon
            const polygonCoords = createEstimatedPolygon();
            createPolygon(polygonCoords);
            onMapError && onMapError("Using estimated roof outline");
          }
        } catch (err) {
          console.error("Error creating polygon:", err);
          onMapError && onMapError("Error creating roof outline");
        }
      };

      // Start loading Google Maps
      loadGoogleMapsAPI();
    }

    // Clean up function - this is critical for preventing memory leaks
    return () => {
      // If we have a reference to the map instance
      if (mapInstanceRef.current && window.google?.maps?.event) {
        // Clear all event listeners
        window.google.maps.event.clearInstanceListeners(mapInstanceRef.current);
      }
      
      // Remove the container from the DOM completely
      if (containerRef.current && mapContainer.parentNode === containerRef.current) {
        containerRef.current.removeChild(mapContainer);
      }
      
      // Reset initialization flag to allow reinitializing if needed
      mapInitializedRef.current = false;
    };
  }, [lat, lng, address, onMapReady, onMapError, onPolygonCreated]);

  // Methods to control the map from outside
  const zoomIn = () => {
    if (mapInstanceRef.current) {
      const currentZoom = mapInstanceRef.current.getZoom() || 19;
      mapInstanceRef.current.setZoom(currentZoom + 1);
    }
  };

  const zoomOut = () => {
    if (mapInstanceRef.current) {
      const currentZoom = mapInstanceRef.current.getZoom() || 19;
      mapInstanceRef.current.setZoom(currentZoom - 1);
    }
  };

  // Expose control methods to parent component
  React.useImperativeHandle(React.createRef(), () => ({
    zoomIn,
    zoomOut,
    getMapInstance: () => mapInstanceRef.current
  }));

  return (
    <div 
      ref={containerRef} 
      style={{ position: 'relative', width: '100%', height: '100%' }}
    />
  );
};

export default GoogleMapContainer;
