// src/components/map/HybridMapContainer.js
import React, { useEffect, forwardRef, useImperativeHandle, useState, useRef } from 'react';
import propertyPolygonGenerator from '../../utils/propertyPolygonGenerator';
import config from '../../config';

const HybridMapContainer = forwardRef(({ 
  lat, 
  lng, 
  address, 
  roofSize,
  roofPolygon,
  propertyData,
  enableDrawing = true,
  onMapReady, 
  onMapError, 
  onPolygonCreated 
}, ref) => {
  const containerRef = useRef(null);
  const googleMapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const drawnItemsRef = useRef(null);
  const drawnPolygonRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState('initializing');
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Parse coordinates once to avoid re-parsing
  const validLat = parseFloat(lat);
  const validLng = parseFloat(lng);
  
  // Expose methods through ref
  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      if (googleMapRef.current) {
        const currentZoom = googleMapRef.current.getZoom();
        googleMapRef.current.setZoom(currentZoom + 1);
      }
    },
    zoomOut: () => {
      if (googleMapRef.current) {
        const currentZoom = googleMapRef.current.getZoom();
        googleMapRef.current.setZoom(Math.max(currentZoom - 1, 1));
      }
    },
    getMapInstance: () => googleMapRef.current,
    fitPolygon: () => {
      if (drawnPolygonRef.current && googleMapRef.current) {
        try {
          if (drawnPolygonRef.current.getBounds) {
            // Leaflet polygon
            const bounds = drawnPolygonRef.current.getBounds();
            const googleBounds = new window.google.maps.LatLngBounds(
              new window.google.maps.LatLng(bounds.getSouth(), bounds.getWest()),
              new window.google.maps.LatLng(bounds.getNorth(), bounds.getEast())
            );
            googleMapRef.current.fitBounds(googleBounds);
          } else if (drawnPolygonRef.current.getPath) {
            // Google Maps polygon
            const bounds = new window.google.maps.LatLngBounds();
            const path = drawnPolygonRef.current.getPath();
            path.forEach(point => bounds.extend(point));
            googleMapRef.current.fitBounds(bounds);
          }
        } catch (e) {
          console.error("Error fitting to polygon:", e);
        }
      }
    },
    updatePolygon: (newPropertyData) => {
      createRoofPolygon(newPropertyData);
    }
  }));
  
  // Calculate polygon area
  const calculatePolygonArea = (coordinates) => {
    try {
      // Check if coordinates are valid
      if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 3) {
        console.warn("Invalid coordinates for area calculation");
        return roofSize || 2500;
      }
      
      // Try to use Turf.js if available
      if (window.turf) {
        try {
          // Format for Turf (expects [lng, lat])
          const turfPoints = coordinates.map(coord => [coord.lng, coord.lat]);
          
          // Close the polygon if not already closed
          if (turfPoints.length > 0 && 
              (turfPoints[0][0] !== turfPoints[turfPoints.length-1][0] || 
               turfPoints[0][1] !== turfPoints[turfPoints.length-1][1])) {
            turfPoints.push(turfPoints[0]);
          }
          
          // Calculate area
          const turfPolygon = window.turf.polygon([turfPoints]);
          const areaSqMeters = window.turf.area(turfPolygon);
          const areaSqFeet = Math.round(areaSqMeters * 10.7639);
          
          // Validate result
          if (areaSqFeet >= 500 && areaSqFeet <= 10000) {
            return areaSqFeet;
          }
        } catch (e) {
          console.warn("Turf.js calculation error:", e);
        }
      }
      
      // Fallback to Google Maps geometry
      if (window.google?.maps?.geometry) {
        try {
          const googleLatLngs = coordinates.map(p => new google.maps.LatLng(p.lat, p.lng));
          const areaSqMeters = google.maps.geometry.spherical.computeArea(googleLatLngs);
          const areaSqFeet = Math.round(areaSqMeters * 10.7639);
          
          // Validate result
          if (areaSqFeet >= 500 && areaSqFeet <= 10000) {
            return areaSqFeet;
          }
        } catch (e) {
          console.warn("Google geometry calculation error:", e);
        }
      }
      
      // Use property data estimate as fallback
      if (propertyData?.buildingSize) {
        const stories = propertyData.stories || 1;
        const footprint = propertyData.buildingSize / stories;
        const pitchFactor = {
          'flat': 1.05, 'low': 1.15, 'moderate': 1.3, 'steep': 1.5
        }[propertyData.roofPitch || 'moderate'] || 1.3;
        
        return Math.round(footprint * pitchFactor);
      }
      
      // Last resort
      return roofSize || 2500;
    } catch (error) {
      console.error("Area calculation error:", error);
      return roofSize || 2500;
    }
  };
  
  // Create roof polygon
  const createRoofPolygon = (customPropertyData) => {
    try {
      // Clear existing polygon
      if (drawnPolygonRef.current) {
        if (drawnPolygonRef.current.setMap) {
          drawnPolygonRef.current.setMap(null);
        } else if (drawnItemsRef.current?.clearLayers) {
          drawnItemsRef.current.clearLayers();
        }
        drawnPolygonRef.current = null;
      }
      
      // Generate polygon coordinates
      let polygonCoords;
      
      // Use provided polygon if available
      if (roofPolygon && Array.isArray(roofPolygon) && roofPolygon.length >= 3) {
        polygonCoords = roofPolygon;
      } 
      // Otherwise generate based on property data
      else {
        const dataToUse = customPropertyData || propertyData;
        
        if (dataToUse) {
          polygonCoords = propertyPolygonGenerator.generatePropertyPolygon(
            validLat, validLng, roofSize, dataToUse
          );
        } else {
          polygonCoords = propertyPolygonGenerator.generateSizeBasedPolygon(
            validLat, validLng, roofSize
          );
        }
      }
      
      // Create the appropriate polygon
      let polygon = null;
      let area = 0;
      
      // If Leaflet is available and initialized, use it for the polygon
      if (window.L && leafletMapRef.current && drawnItemsRef.current) {
        try {
          polygon = L.polygon(polygonCoords, {
            color: '#2563EB',
            weight: 3,
            opacity: 1,
            fillColor: '#2563EB',
            fillOpacity: 0.4
          });
          
          drawnItemsRef.current.addLayer(polygon);
          drawnPolygonRef.current = polygon;
          
          // Calculate area
          area = calculatePolygonArea(polygonCoords);
          
          // Fit bounds
          const bounds = polygon.getBounds();
          leafletMapRef.current.fitBounds(bounds);
          
          // Fit Google Maps too
          if (googleMapRef.current) {
            const googleBounds = new google.maps.LatLngBounds(
              new google.maps.LatLng(bounds.getSouth(), bounds.getWest()),
              new google.maps.LatLng(bounds.getNorth(), bounds.getEast())
            );
            googleMapRef.current.fitBounds(googleBounds);
          }
        } catch (e) {
          console.warn("Error creating Leaflet polygon:", e);
          // Fall back to Google Maps
        }
      }
      
      // If no Leaflet polygon was created or it failed, use Google Maps
      if (!polygon && googleMapRef.current) {
        try {
          polygon = new google.maps.Polygon({
            paths: polygonCoords,
            strokeColor: '#2563EB',
            strokeOpacity: 1.0,
            strokeWeight: 3,
            fillColor: '#2563EB',
            fillOpacity: 0.4,
            map: googleMapRef.current
          });
          
          drawnPolygonRef.current = polygon;
          
          // Calculate area
          area = calculatePolygonArea(polygonCoords);
          
          // Fit bounds
          const bounds = new google.maps.LatLngBounds();
          polygonCoords.forEach(point => bounds.extend(point));
          googleMapRef.current.fitBounds(bounds);
        } catch (e) {
          console.error("Error creating Google Maps polygon:", e);
        }
      }
      
      // Notify parent component
      if (onPolygonCreated && polygon) {
        onPolygonCreated(polygon, area);
      }
      
      return polygon;
    } catch (error) {
      console.error("Error creating roof polygon:", error);
      return null;
    }
  };
  
  // Initialize maps
  useEffect(() => {
    console.log("HybridMapContainer initialization started");
    let progressTimer;
    let timeoutTimer;
    
    // Set up progress indication
    progressTimer = setInterval(() => {
      setLoadingProgress(prev => Math.min(prev + 5, 90));
    }, 500);
    
    // Set up timeout to avoid hanging
    timeoutTimer = setTimeout(() => {
      setError("Map loading timed out after 30 seconds");
      setLoading(false);
      clearInterval(progressTimer);
      if (onMapError) onMapError("Loading timed out");
    }, 30000);
    
    // Validate coordinates
    if (isNaN(validLat) || isNaN(validLng)) {
      const errorMsg = `Invalid coordinates: ${lat}, ${lng}`;
      setError(errorMsg);
      setLoading(false);
      clearInterval(progressTimer);
      clearTimeout(timeoutTimer);
      if (onMapError) onMapError(errorMsg);
      return;
    }
    
    // Initialize Google Maps first
    const initializeGoogleMaps = () => {
      // Simpler loading approach that doesn't depend on container refs
      if (window.google && window.google.maps) {
        console.log("Google Maps already loaded, initializing map");
        createGoogleMap();
      } else {
        console.log("Loading Google Maps API...");
        // Load script
        loadGoogleMapsScript()
          .then(() => {
            console.log("Google Maps API loaded, creating map");
            createGoogleMap();
          })
          .catch(error => {
            console.error("Failed to load Google Maps:", error);
            setError("Could not load Google Maps: " + error.message);
            setLoading(false);
            clearInterval(progressTimer);
            clearTimeout(timeoutTimer);
            if (onMapError) onMapError(error.message);
          });
      }
    };
    
    // Load Google Maps script
    const loadGoogleMapsScript = () => {
      return new Promise((resolve, reject) => {
        // Get API key
        const apiKey = config.googleMapsApiKey;
        if (!apiKey) {
          reject(new Error("Google Maps API key missing from configuration"));
          return;
        }
        
        // Create callback function
        window.initGoogleMapsCallback = () => {
          console.log("Google Maps callback executed");
          resolve();
          delete window.initGoogleMapsCallback;
        };
        
        // Create script tag
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,drawing&callback=initGoogleMapsCallback`;
        script.async = true;
        script.defer = true;
        
        script.onerror = () => {
          reject(new Error("Google Maps script failed to load"));
        };
        
        document.head.appendChild(script);
      });
    };
    
    // Create Google Map
    const createGoogleMap = () => {
      try {
        setLoadingStatus('creating Google map');
        
        // Make sure container is available
        if (!containerRef.current) {
          console.error("Map container not available");
          setError("Map container not available - please reload the page");
          setLoading(false);
          clearInterval(progressTimer);
          clearTimeout(timeoutTimer);
          if (onMapError) onMapError("Map container not available");
          return;
        }
        
        // Create the map
        const map = new google.maps.Map(containerRef.current, {
          center: { lat: validLat, lng: validLng },
          zoom: 19,
          mapTypeId: 'satellite',
          tilt: 0,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true
        });
        
        // Store reference
        googleMapRef.current = map;
        
        // Add marker
        new google.maps.Marker({
          position: { lat: validLat, lng: validLng },
          map: map,
          title: address || "Property Location"
        });
        
        // Now load Leaflet
        loadLeaflet();
      } catch (error) {
        console.error("Error creating Google Map:", error);
        setError("Failed to create map: " + error.message);
        setLoading(false);
        clearInterval(progressTimer);
        clearTimeout(timeoutTimer);
        if (onMapError) onMapError(error.message);
      }
    };
    
    // Load Leaflet
    const loadLeaflet = () => {
      try {
        setLoadingStatus('initializing drawing tools');
        
        // If Leaflet is already loaded, initialize
        if (window.L) {
          console.log("Leaflet already loaded, initializing");
          initializeLeaflet();
          return;
        }
        
        // Load Leaflet CSS and JS
        console.log("Loading Leaflet libraries...");
        
        // Load CSS first
        const loadCSS = (href) => {
          return new Promise((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = resolve;
            document.head.appendChild(link);
          });
        };
        
        // Load script
        const loadScript = (src) => {
          return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        };
        
        // Load all Leaflet resources
        Promise.all([
          loadCSS('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'),
          loadCSS('https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css')
        ])
        .then(() => loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'))
        .then(() => loadScript('https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js'))
        .then(() => {
          console.log("Leaflet libraries loaded");
          initializeLeaflet();
        })
        .catch(error => {
          console.warn("Error loading Leaflet, continuing with just Google Maps:", error);
          // Just proceed without Leaflet
          finishInitialization();
        });
      } catch (error) {
        console.warn("Error setting up Leaflet:", error);
        // Continue without Leaflet
        finishInitialization();
      }
    };
    
    // Initialize Leaflet
    const initializeLeaflet = () => {
      try {
        console.log("Initializing Leaflet overlay");
        
        // Create a container for Leaflet
        const leafletContainer = document.createElement('div');
        leafletContainer.style.position = 'absolute';
        leafletContainer.style.top = '0';
        leafletContainer.style.left = '0';
        leafletContainer.style.width = '100%';
        leafletContainer.style.height = '100%';
        leafletContainer.style.zIndex = '1000';
        leafletContainer.style.pointerEvents = 'none';
        
        // Append to main container
        containerRef.current.appendChild(leafletContainer);
        
        // Create Leaflet map
        const map = L.map(leafletContainer, {
          center: [validLat, validLng],
          zoom: googleMapRef.current ? googleMapRef.current.getZoom() : 19,
          zoomControl: false,
          attributionControl: false
        });
        
        // Add empty tile layer
        L.tileLayer('', { opacity: 0 }).addTo(map);
        
        // Store reference
        leafletMapRef.current = map;
        
        // Create feature group for drawings
        const drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);
        drawnItemsRef.current = drawnItems;
        
        // Add drawing controls if available
        if (L.Control.Draw && enableDrawing) {
          const drawControl = new L.Control.Draw({
            position: 'topright',
            draw: {
              polygon: {
                allowIntersection: false,
                showArea: true,
                shapeOptions: {
                  color: '#2563EB',
                  weight: 3
                }
              },
              polyline: false,
              circle: false,
              rectangle: false,
              marker: false,
              circlemarker: false
            },
            edit: {
              featureGroup: drawnItems,
              remove: true
            }
          });
          
          map.addControl(drawControl);
          
          // Handle draw events
          map.on(L.Draw.Event.DRAWSTART, () => {
            leafletContainer.style.pointerEvents = 'auto';
          });
          
          map.on(L.Draw.Event.DRAWSTOP, () => {
            leafletContainer.style.pointerEvents = 'none';
          });
          
          map.on(L.Draw.Event.CREATED, event => {
            // Clear existing drawings
            drawnItems.clearLayers();
            
            const layer = event.layer;
            drawnItems.addLayer(layer);
            
            // Store reference
            drawnPolygonRef.current = layer;
            
            // Mark as user-created
            layer._userCreated = true;
            
            // Calculate area
            const latLngs = layer.getLatLngs()[0];
            const coordinates = latLngs.map(point => ({
              lat: point.lat,
              lng: point.lng
            }));
            
            const area = calculatePolygonArea(coordinates);
            
            // Notify parent
            if (onPolygonCreated) {
              onPolygonCreated(layer, area);
            }
            
            // Reset pointer events
            leafletContainer.style.pointerEvents = 'none';
          });
          
          // Custom buttons for easier access
          addCustomControls(map, leafletContainer);
        }
        
        // Sync with Google Maps
        if (googleMapRef.current) {
          google.maps.event.addListener(googleMapRef.current, 'bounds_changed', () => {
            const center = googleMapRef.current.getCenter();
            const zoom = googleMapRef.current.getZoom();
            
            if (center && zoom) {
              map.setView([center.lat(), center.lng()], zoom, { animate: false });
            }
          });
        }
        
        // Create initial polygon
        setTimeout(() => {
          createRoofPolygon();
        }, 300);
        
        finishInitialization();
      } catch (error) {
        console.warn("Error initializing Leaflet:", error);
        // Continue with just Google Maps
        finishInitialization();
      }
    };
    
    // Add custom map controls
    const addCustomControls = (map, container) => {
      // Draw button
      const drawButton = L.control({ position: 'topright' });
      drawButton.onAdd = function() {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        div.innerHTML = `
          <a href="#" title="Draw Roof Outline" 
             style="display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; 
                    font-size: 16px; font-weight: bold; color: #2563EB; background-color: white; 
                    border-radius: 4px; box-shadow: 0 1px 5px rgba(0,0,0,0.4); text-decoration: none;">
            ✏️
          </a>
        `;
        
        L.DomEvent.disableClickPropagation(div);
        div.onclick = () => {
          // Enable drawing
          container.style.pointerEvents = 'auto';
          
          // Clear existing drawings
          if (drawnItemsRef.current) {
            drawnItemsRef.current.clearLayers();
          }
          
          // Start drawing
          if (L.Draw && map) {
            new L.Draw.Polygon(map, {
              showArea: true,
              shapeOptions: {
                color: '#2563EB',
                weight: 3
              }
            }).enable();
          }
          
          return false;
        };
        
        return div;
      };
      
      // Add button to map
      if (enableDrawing) {
        drawButton.addTo(map);
      }
    };
    
    // Finish initialization
    const finishInitialization = () => {
      setLoading(false);
      clearInterval(progressTimer);
      clearTimeout(timeoutTimer);
      
      // Notify parent
      if (onMapReady) {
        onMapReady(googleMapRef.current);
      }
    };
    
    // Start initialization after a small delay to ensure container is rendered
    setTimeout(() => {
      initializeGoogleMaps();
    }, 250);
    
    // Cleanup
    return () => {
      clearInterval(progressTimer);
      clearTimeout(timeoutTimer);
      
      // Clean up Google Maps
      if (googleMapRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(googleMapRef.current);
      }
      
      // Clean up Leaflet
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
      }
    };
  }, [
    validLat, validLng, address, roofSize, propertyData, roofPolygon,
    enableDrawing, onMapReady, onMapError, onPolygonCreated
  ]);
  
  // Error display
  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-red-600 p-4 text-center">
        <div>
          <p className="mb-2 font-medium">Error loading map:</p>
          <p>{error}</p>
          <p className="text-sm mt-2 text-gray-600">
            Coordinates: {lat}, {lng}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-lg text-sm"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
  
  // Loading indicator
  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 mb-2">Loading satellite imagery...</p>
          <p className="text-gray-500 text-sm">({loadingStatus})</p>
          
          {/* Loading progress bar */}
          <div className="w-64 h-2 bg-gray-200 rounded-full mt-2 mb-2 mx-auto">
            <div 
              className="h-full bg-primary-600 rounded-full transition-all duration-300"
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
          
          <button 
            onClick={() => {
              setLoading(false);
              if (onMapError) onMapError("User skipped map");
            }}
            className="mt-4 text-xs text-blue-500 hover:text-blue-700 underline"
          >
            Skip map view
          </button>
        </div>
      </div>
    );
  }
  
  // Render the map container
  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full"
      style={{ width: '100%', height: '100%' }}
    >
      {/* Instruction overlay */}
      {enableDrawing && (
        <div className="absolute top-2 left-2 right-2 bg-white bg-opacity-80 text-xs p-2 rounded-md z-10 pointer-events-none text-gray-700">
          Use the drawing tools (✏️) in the top-right corner to outline your roof for an accurate measurement
        </div>
      )}
    </div>
  );
});

HybridMapContainer.displayName = 'HybridMapContainer';

export default HybridMapContainer;
