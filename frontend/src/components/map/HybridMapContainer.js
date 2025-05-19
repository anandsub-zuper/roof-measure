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
  const mapContainerRef = useRef(null);
  const leafletMapRef = useRef(null);
  const googleMapRef = useRef(null);
  const drawnItemsRef = useRef(null);
  const drawnPolygonRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState('initializing');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const initAttempted = useRef(false);
  
  // Increase timeout to 60 seconds
  const MAP_LOADING_TIMEOUT = 60000;
  
  // Validate coordinates
  const validLat = parseFloat(lat);
  const validLng = parseFloat(lng);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      if (googleMapRef.current) {
        const currentZoom = googleMapRef.current.getZoom();
        googleMapRef.current.setZoom(currentZoom + 1);
        
        // Also update Leaflet if available
        if (leafletMapRef.current) {
          leafletMapRef.current.setZoom(currentZoom + 1);
        }
      }
    },
    zoomOut: () => {
      if (googleMapRef.current) {
        const currentZoom = googleMapRef.current.getZoom();
        googleMapRef.current.setZoom(currentZoom - 1);
        
        // Also update Leaflet if available
        if (leafletMapRef.current) {
          leafletMapRef.current.setZoom(currentZoom - 1);
        }
      }
    },
    getMapInstance: () => googleMapRef.current,
    fitPolygon: () => {
      try {
        if (drawnPolygonRef.current) {
          // If using Leaflet polygon
          if (leafletMapRef.current && drawnPolygonRef.current.getBounds) {
            leafletMapRef.current.fitBounds(drawnPolygonRef.current.getBounds());
          } 
          // If using Google polygon
          else if (googleMapRef.current && drawnPolygonRef.current.getPath) {
            const bounds = new window.google.maps.LatLngBounds();
            const path = drawnPolygonRef.current.getPath();
            path.forEach(point => bounds.extend(point));
            googleMapRef.current.fitBounds(bounds);
          }
        }
      } catch (e) {
        console.warn("Error fitting to polygon:", e);
      }
    },
    updatePolygon: (newPropertyData) => {
      try {
        // Clear any existing polygon
        clearExistingPolygon();
        
        // Generate new polygon
        createRoofPolygon(newPropertyData);
      } catch (e) {
        console.error("Error updating polygon:", e);
      }
    }
  }));
  
  // Clear existing polygon from both maps
  const clearExistingPolygon = () => {
    // Clear Google polygon
    if (drawnPolygonRef.current) {
      if (drawnPolygonRef.current.setMap) {
        drawnPolygonRef.current.setMap(null);
      } else if (drawnItemsRef.current && drawnItemsRef.current.clearLayers) {
        drawnItemsRef.current.clearLayers();
      }
      drawnPolygonRef.current = null;
    }
  };

  // Calculate polygon area using the best available method
  const calculatePolygonArea = (polygon) => {
    try {
      console.log("Calculating area for polygon:", polygon);
      
      // Use property data if available for cross-validation
      let propertyBasedArea = null;
      if (propertyData && propertyData.buildingSize) {
        const stories = propertyData.stories || 1;
        const footprint = propertyData.buildingSize / stories;
        
        // Get pitch factor
        const pitchFactor = {
          'flat': 1.05,
          'low': 1.15,
          'moderate': 1.3,
          'steep': 1.5
        }[propertyData.roofPitch || 'moderate'] || 1.3;
        
        propertyBasedArea = Math.round(footprint * pitchFactor);
        console.log("Property-based area calculation:", propertyBasedArea);
      }
      
      // Extract coordinates based on the type of polygon provided
      let coordinates = [];
      
      // Handle different polygon types
      if (polygon && typeof polygon === 'object') {
        // Leaflet polygon
        if (polygon.getLatLngs) {
          const latLngs = polygon.getLatLngs();
          if (Array.isArray(latLngs) && latLngs.length > 0) {
            // Handle potentially nested arrays
            const points = Array.isArray(latLngs[0]) ? latLngs[0] : latLngs;
            coordinates = points.map(point => ({
              lat: point.lat,
              lng: point.lng
            }));
          }
        } 
        // Google Maps polygon
        else if (polygon.getPath) {
          const path = polygon.getPath();
          for (let i = 0; i < path.getLength(); i++) {
            const point = path.getAt(i);
            coordinates.push({
              lat: point.lat(),
              lng: point.lng()
            });
          }
        }
      } 
      // Direct array of coordinates
      else if (Array.isArray(polygon)) {
        coordinates = polygon;
      }
      
      // Ensure we have enough points for a polygon
      if (coordinates.length < 3) {
        console.warn("Not enough coordinates for area calculation");
        return propertyBasedArea || roofSize || 2500;
      }
      
      // Try Turf.js for calculation (most accurate)
      if (window.turf) {
        try {
          // Format for Turf (it expects [lng, lat] format)
          const turfPoints = coordinates.map(coord => [coord.lng, coord.lat]);
          
          // Close the polygon if not already closed
          if (turfPoints.length > 0 && 
              (turfPoints[0][0] !== turfPoints[turfPoints.length-1][0] || 
               turfPoints[0][1] !== turfPoints[turfPoints.length-1][1])) {
            turfPoints.push(turfPoints[0]);
          }
          
          // Create polygon and calculate area
          const turfPolygon = window.turf.polygon([turfPoints]);
          const areaSqMeters = window.turf.area(turfPolygon);
          const areaSqFeet = Math.round(areaSqMeters * 10.7639);
          
          console.log("Turf.js area calculation:", areaSqFeet);
          
          // Validate the calculation - if outside reasonable bounds, fall back
          if (areaSqFeet >= 500 && areaSqFeet <= 10000) {
            return areaSqFeet;
          } else {
            console.warn("Turf calculation outside reasonable bounds:", areaSqFeet);
          }
        } catch (e) {
          console.warn("Turf.js calculation error:", e);
        }
      }
      
      // Try Google Maps geometry if available
      if (window.google && window.google.maps && window.google.maps.geometry) {
        try {
          const googleLatLngs = coordinates.map(point => 
            new window.google.maps.LatLng(point.lat, point.lng)
          );
          
          const areaSqMeters = window.google.maps.geometry.spherical.computeArea(googleLatLngs);
          const areaSqFeet = Math.round(areaSqMeters * 10.7639);
          
          console.log("Google Maps area calculation:", areaSqFeet);
          
          // Validate the calculation
          if (areaSqFeet >= 500 && areaSqFeet <= 10000) {
            return areaSqFeet;
          } else {
            console.warn("Google calculation outside reasonable bounds:", areaSqFeet);
          }
        } catch (e) {
          console.warn("Google geometry calculation error:", e);
        }
      }
      
      // If all else fails, use property-based, then original size
      return propertyBasedArea || roofSize || 2500;
    } catch (error) {
      console.error("Error in area calculation:", error);
      return roofSize || 2500;
    }
  };

  // Create roof polygon on the map
  const createRoofPolygon = (customPropertyData = null) => {
    try {
      // Use provided or custom property data
      const dataToUse = customPropertyData || propertyData;
      
      // Generate coordinates for the polygon
      let polygonCoords;
      
      // Use provided polygon coordinates if available
      if (roofPolygon && Array.isArray(roofPolygon) && roofPolygon.length >= 3) {
        console.log("Using provided roof polygon coordinates");
        polygonCoords = roofPolygon;
      }
      // Otherwise generate based on property data
      else if (dataToUse) {
        console.log("Generating polygon based on property data");
        polygonCoords = propertyPolygonGenerator.generatePropertyPolygon(
          validLat, 
          validLng, 
          roofSize, 
          dataToUse
        );
      }
      // Fallback to size-based polygon
      else {
        console.log("Generating size-based polygon");
        polygonCoords = propertyPolygonGenerator.generateSizeBasedPolygon(validLat, validLng, roofSize);
      }
      
      // If we don't have enough points, bail out
      if (!polygonCoords || polygonCoords.length < 3) {
        console.warn("Not enough coordinates for polygon creation");
        return null;
      }
      
      // Try to create polygon using Leaflet if available
      if (window.L && leafletMapRef.current && drawnItemsRef.current) {
        try {
          console.log("Creating Leaflet polygon");
          const leafletPolygon = L.polygon(polygonCoords, {
            color: '#2563EB',
            weight: 3,
            opacity: 1,
            fillColor: '#2563EB',
            fillOpacity: 0.4
          });
          
          // Add to feature group and map
          drawnItemsRef.current.addLayer(leafletPolygon);
          
          // Store reference
          drawnPolygonRef.current = leafletPolygon;
          
          // Calculate area
          const area = calculatePolygonArea(polygonCoords);
          
          // Fit bounds
          leafletMapRef.current.fitBounds(leafletPolygon.getBounds());
          
          // Notify parent
          if (onPolygonCreated) {
            onPolygonCreated(leafletPolygon, area);
          }
          
          return leafletPolygon;
        } catch (e) {
          console.warn("Error creating Leaflet polygon:", e);
          // Continue to try Google Maps as fallback
        }
      }
      
      // Try to create polygon using Google Maps if available (fallback)
      if (window.google && window.google.maps && googleMapRef.current) {
        try {
          console.log("Creating Google Maps polygon");
          const googlePolygon = new window.google.maps.Polygon({
            paths: polygonCoords,
            strokeColor: '#2563EB',
            strokeOpacity: 1.0,
            strokeWeight: 3,
            fillColor: '#2563EB',
            fillOpacity: 0.4,
            map: googleMapRef.current,
            editable: enableDrawing
          });
          
          // Store reference
          drawnPolygonRef.current = googlePolygon;
          
          // Calculate area
          const area = calculatePolygonArea(polygonCoords);
          
          // Fit bounds
          const bounds = new window.google.maps.LatLngBounds();
          polygonCoords.forEach(point => bounds.extend(point));
          googleMapRef.current.fitBounds(bounds);
          
          // Add drag listeners
          if (enableDrawing) {
            googlePolygon.addListener('dragend', () => {
              const path = googlePolygon.getPath();
              const newCoords = [];
              for (let i = 0; i < path.getLength(); i++) {
                const point = path.getAt(i);
                newCoords.push({ lat: point.lat(), lng: point.lng() });
              }
              const area = calculatePolygonArea(newCoords);
              if (onPolygonCreated) {
                onPolygonCreated(googlePolygon, area);
              }
            });
          }
          
          // Notify parent
          if (onPolygonCreated) {
            onPolygonCreated(googlePolygon, area);
          }
          
          return googlePolygon;
        } catch (e) {
          console.error("Error creating Google Maps polygon:", e);
        }
      }
      
      console.warn("Could not create polygon with either mapping library");
      return null;
    } catch (error) {
      console.error("Error in polygon creation:", error);
      return null;
    }
  };

  // Initialize the maps
  useEffect(() => {
    // Skip if no container or already attempted
    if (!mapContainerRef.current || initAttempted.current) return;
    
    // Mark as attempted to prevent duplicate initialization
    initAttempted.current = true;
    
    // Start loading process
    setLoading(true);
    setLoadingProgress(5);
    setLoadingStatus('initializing');
    
    console.log("Starting map initialization with coordinates:", { lat: validLat, lng: validLng });
    
    // Ensure we have valid coordinates
    if (isNaN(validLat) || isNaN(validLng)) {
      const errorMsg = `Invalid coordinates: ${lat}, ${lng}`;
      setError(errorMsg);
      setLoading(false);
      if (onMapError) onMapError(errorMsg);
      return;
    }
    
    // Set up loading simulation for user feedback
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        const increment = Math.floor(Math.random() * 5) + 1; // 1-5% increment
        return Math.min(prev + increment, 90);
      });
    }, 800);
    
    // Set a timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      if (loading) {
        const timeoutMsg = "Map loading timed out after " + MAP_LOADING_TIMEOUT/1000 + " seconds";
        console.error(timeoutMsg);
        setError(timeoutMsg);
        setLoading(false);
        clearInterval(progressInterval);
        if (onMapError) onMapError(timeoutMsg);
      }
    }, MAP_LOADING_TIMEOUT);
    
    // Primary initialization function for both maps
    const initializeMaps = async () => {
      try {
        // Initialize Google Maps first to get satellite imagery
        await initGoogleMaps();
        
        // Then initialize Leaflet on top for measurement
        await initLeaflet();
        
        // Show initial polygon
        setTimeout(() => {
          createRoofPolygon();
        }, 500);
        
        // Complete loading
        setLoadingProgress(100);
        setLoading(false);
        clearInterval(progressInterval);
        clearTimeout(timeoutId);
        
        // Notify parent
        if (onMapReady) {
          onMapReady(googleMapRef.current);
        }
      } catch (error) {
        console.error("Map initialization failed:", error);
        setError(error.message || "Failed to initialize maps");
        setLoading(false);
        clearInterval(progressInterval);
        clearTimeout(timeoutId);
        if (onMapError) onMapError(error.message || "Failed to initialize maps");
      }
    };
    
    // Initialize Google Maps
    const initGoogleMaps = () => {
      return new Promise((resolve, reject) => {
        try {
          setLoadingStatus('loading Google Maps');
          setLoadingProgress(prev => Math.min(prev + 10, 90));
          
          // Check if already loaded
          if (window.google && window.google.maps) {
            console.log("Google Maps already loaded, creating map");
            createGoogleMap();
            resolve();
            return;
          }
          
          // Get API key
          const apiKey = config.googleMapsApiKey;
          
          if (!apiKey) {
            console.error("Google Maps API key is missing");
            reject(new Error("Google Maps API key is missing. Check your environment variables."));
            return;
          }
          
          // Create callback function
          window.initGoogleMapsCallback = () => {
            console.log("Google Maps loaded via callback");
            createGoogleMap();
            resolve();
            delete window.initGoogleMapsCallback;
          };
          
          // Load script
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=drawing,geometry&callback=initGoogleMapsCallback`;
          script.async = true;
          script.defer = true;
          
          script.onerror = (error) => {
            console.error("Error loading Google Maps script:", error);
            reject(new Error("Failed to load Google Maps API script"));
          };
          
          document.head.appendChild(script);
        } catch (error) {
          console.error("Error in Google Maps initialization:", error);
          reject(error);
        }
      });
    };
    
    // Create Google Maps instance
    const createGoogleMap = () => {
      if (!window.google || !window.google.maps) {
        console.error("Google Maps not available");
        return;
      }
      
      try {
        setLoadingStatus('creating Google map');
        
        // Create map
        const mapOptions = {
          center: { lat: validLat, lng: validLng },
          zoom: 19,
          mapTypeId: 'satellite',
          tilt: 0,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true
        };
        
        const map = new window.google.maps.Map(mapContainerRef.current, mapOptions);
        googleMapRef.current = map;
        
        // Add marker for property location
        new window.google.maps.Marker({
          position: { lat: validLat, lng: validLng },
          map: map,
          title: address || "Selected location"
        });
        
        console.log("Google Maps instance created successfully");
      } catch (error) {
        console.error("Error creating Google Maps instance:", error);
        throw error;
      }
    };
    
    // Initialize Leaflet
    const initLeaflet = () => {
      return new Promise((resolve, reject) => {
        try {
          setLoadingStatus('initializing Leaflet');
          setLoadingProgress(prev => Math.min(prev + 10, 90));
          
          // Check if Leaflet is available
          if (!window.L) {
            console.warn("Leaflet not available, loading it dynamically");
            loadLeafletDynamically()
              .then(() => setupLeaflet())
              .then(resolve)
              .catch(reject);
          } else {
            console.log("Leaflet already loaded, setting up");
            setupLeaflet()
              .then(resolve)
              .catch(reject);
          }
        } catch (error) {
          console.error("Error in Leaflet initialization:", error);
          reject(error);
        }
      });
    };
    
    // Load Leaflet dynamically if not available
    const loadLeafletDynamically = () => {
      return new Promise((resolve, reject) => {
        try {
          // Load Leaflet CSS
          const leafletCSS = document.createElement('link');
          leafletCSS.rel = 'stylesheet';
          leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          leafletCSS.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
          leafletCSS.crossOrigin = '';
          document.head.appendChild(leafletCSS);
          
          // Load Leaflet JS
          const leafletScript = document.createElement('script');
          leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          leafletScript.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
          leafletScript.crossOrigin = '';
          
          leafletScript.onload = () => {
            console.log("Leaflet loaded dynamically");
            
            // Load Leaflet Draw plugin
            const drawCSS = document.createElement('link');
            drawCSS.rel = 'stylesheet';
            drawCSS.href = 'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css';
            document.head.appendChild(drawCSS);
            
            const drawScript = document.createElement('script');
            drawScript.src = 'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js';
            
            drawScript.onload = () => {
              console.log("Leaflet Draw loaded dynamically");
              
              // Also load Turf.js if needed
              if (!window.turf) {
                const turfScript = document.createElement('script');
                turfScript.src = 'https://cdn.jsdelivr.net/npm/@turf/turf@6.5.0/turf.min.js';
                
                turfScript.onload = () => {
                  console.log("Turf.js loaded dynamically");
                  resolve();
                };
                
                turfScript.onerror = (error) => {
                  console.warn("Turf.js loading failed:", error);
                  // Continue anyway, it's not critical
                  resolve();
                };
                
                document.head.appendChild(turfScript);
              } else {
                resolve();
              }
            };
            
            drawScript.onerror = (error) => {
              console.warn("Leaflet Draw loading failed:", error);
              // Continue anyway, we can still use basic Leaflet
              resolve();
            };
            
            document.head.appendChild(drawScript);
          };
          
          leafletScript.onerror = (error) => {
            console.error("Leaflet loading failed:", error);
            reject(new Error("Failed to load Leaflet library"));
          };
          
          document.head.appendChild(leafletScript);
        } catch (error) {
          console.error("Error loading Leaflet dynamically:", error);
          reject(error);
        }
      });
    };
    
    // Set up Leaflet map
    const setupLeaflet = () => {
      return new Promise((resolve, reject) => {
        try {
          // Skip if Leaflet isn't available
          if (!window.L) {
            console.warn("Leaflet not available, skipping Leaflet setup");
            resolve();
            return;
          }
          
          // Skip if Google Maps instance doesn't exist
          if (!googleMapRef.current) {
            console.warn("Google Maps not initialized, skipping Leaflet setup");
            resolve();
            return;
          }
          
          setLoadingStatus('setting up Leaflet overlay');
          
          // Create overlay div for Leaflet
          const leafletContainer = document.createElement('div');
          leafletContainer.style.position = 'absolute';
          leafletContainer.style.top = '0';
          leafletContainer.style.left = '0';
          leafletContainer.style.width = '100%';
          leafletContainer.style.height = '100%';
          leafletContainer.style.zIndex = '1000';
          leafletContainer.style.pointerEvents = 'none'; // Initially transparent to clicks
          leafletContainer.id = 'leaflet-container';
          
          // Append to main container
          mapContainerRef.current.appendChild(leafletContainer);
          
          // Initialize Leaflet map
          const lMap = L.map(leafletContainer, {
            center: [validLat, validLng],
            zoom: 19,
            zoomControl: false,
            attributionControl: false,
            inertia: false
          });
          
          // Store reference
          leafletMapRef.current = lMap;
          
          // Create transparent tile layer to capture events but show Google Maps underneath
          L.tileLayer('', {
            opacity: 0
          }).addTo(lMap);
          
          // Create feature group for drawings
          const drawnItems = new L.FeatureGroup();
          lMap.addLayer(drawnItems);
          drawnItemsRef.current = drawnItems;
          
          // Initialize drawing control
          if (window.L.Control.Draw && enableDrawing) {
            console.log("Adding Leaflet Draw control");
            
            const drawControl = new L.Control.Draw({
              position: 'topright',
              draw: {
                polygon: {
                  allowIntersection: false,
                  drawError: {
                    color: '#e1e7f0',
                    timeout: 1000
                  },
                  shapeOptions: {
                    color: '#2563EB',
                    weight: 3
                  },
                  showArea: true
                },
                polyline: false,
                circle: false,
                marker: false,
                circlemarker: false,
                rectangle: false
              },
              edit: {
                featureGroup: drawnItems,
                remove: true
              }
            });
            
            lMap.addControl(drawControl);
            
            // Enable pointer events when drawing starts
            lMap.on(L.Draw.Event.DRAWSTART, () => {
              leafletContainer.style.pointerEvents = 'auto';
            });
            
            // Disable pointer events when drawing ends
            lMap.on(L.Draw.Event.DRAWSTOP, () => {
              leafletContainer.style.pointerEvents = 'none';
            });
            
            // Enable pointer events when editing starts
            lMap.on(L.Draw.Event.EDITSTART, () => {
              leafletContainer.style.pointerEvents = 'auto';
            });
            
            // Disable pointer events when editing ends
            lMap.on(L.Draw.Event.EDITSTOP, () => {
              leafletContainer.style.pointerEvents = 'none';
            });
            
            // Handle draw events
            lMap.on(L.Draw.Event.CREATED, (event) => {
              // Clear previous drawings
              drawnItems.clearLayers();
              
              // Add the layer
              const layer = event.layer;
              drawnItems.addLayer(layer);
              
              // Store reference
              drawnPolygonRef.current = layer;
              
              // Mark as user-created
              layer._userCreated = true;
              
              // Get coordinates
              const latLngs = layer.getLatLngs()[0];
              const coordinates = latLngs.map(point => ({
                lat: point.lat,
                lng: point.lng
              }));
              
              // Calculate area
              const area = calculatePolygonArea(coordinates);
              
              // Sync with Google Maps if needed
              if (googleMapRef.current) {
                // Create Google polygon
                if (drawnPolygonRef.current.googlePolygon) {
                  drawnPolygonRef.current.googlePolygon.setMap(null);
                }
                
                const googlePolygon = new window.google.maps.Polygon({
                  paths: coordinates,
                  strokeColor: '#2563EB',
                  strokeOpacity: 0.6,
                  strokeWeight: 2,
                  fillColor: '#2563EB',
                  fillOpacity: 0.2,
                  map: googleMapRef.current
                });
                
                // Store reference on Leaflet layer
                layer.googlePolygon = googlePolygon;
              }
              
              // Notify parent component
              if (onPolygonCreated) {
                onPolygonCreated(layer, area);
              }
              
              // Disable pointer events after drawing
              leafletContainer.style.pointerEvents = 'none';
            });
            
            // Handle edit events
            lMap.on(L.Draw.Event.EDITED, (event) => {
              const layers = event.layers;
              layers.eachLayer((layer) => {
                // Get coordinates
                const latLngs = layer.getLatLngs()[0];
                const coordinates = latLngs.map(point => ({
                  lat: point.lat,
                  lng: point.lng
                }));
                
                // Calculate area
                const area = calculatePolygonArea(coordinates);
                
                // Sync with Google Maps if needed
                if (layer.googlePolygon && googleMapRef.current) {
                  layer.googlePolygon.setPath(coordinates);
                }
                
                // Notify parent
                if (onPolygonCreated) {
                  onPolygonCreated(layer, area);
                }
              });
            });
            
            // Handle delete events
            lMap.on(L.Draw.Event.DELETED, (event) => {
              const layers = event.layers;
              layers.eachLayer((layer) => {
                // Remove Google polygon if it exists
                if (layer.googlePolygon) {
                  layer.googlePolygon.setMap(null);
                }
              });
              
              // Clear reference
              drawnPolygonRef.current = null;
            });
          }
          
          // Create measurement button
          const measureButton = L.control({ position: 'topright' });
          
          measureButton.onAdd = function() {
            const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            div.innerHTML = `
              <a href="#" title="Measure Roof Area" 
                 style="display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; line-height: 30px; 
                        font-weight: bold; color: #2563EB; text-decoration: none; background-color: white; border-radius: 4px; 
                        box-shadow: 0 1px 5px rgba(0,0,0,0.4);">
                📏
              </a>
            `;
            
            // Prevent click/touch events from propagating to map
            L.DomEvent.disableClickPropagation(div);
            
            div.onclick = () => {
              if (drawnPolygonRef.current) {
                try {
                  let area = 0;
                  
                  // Get coordinates from Leaflet polygon
                  if (drawnPolygonRef.current.getLatLngs) {
                    const latLngs = drawnPolygonRef.current.getLatLngs()[0];
                    const coordinates = latLngs.map(point => ({
                      lat: point.lat,
                      lng: point.lng
                    }));
                    
                    area = calculatePolygonArea(coordinates);
                  } 
                  // Get coordinates from Google polygon
                  else if (drawnPolygonRef.current.getPath) {
                    const path = drawnPolygonRef.current.getPath();
                    const coordinates = [];
                    for (let i = 0; i < path.getLength(); i++) {
                      const point = path.getAt(i);
                      coordinates.push({
                        lat: point.lat(),
                        lng: point.lng()
                      });
                    }
                    
                    area = calculatePolygonArea(coordinates);
                  }
                  
                  // Show result
                  alert(`Roof Area: ${area} square feet`);
                } catch (e) {
                  console.error("Error measuring area:", e);
                  alert("Could not measure area: " + e.message);
                }
              } else {
                alert("Please draw a roof outline first using the drawing tools.");
              }
              
              return false;
            };
            
            return div;
          };
          
          measureButton.addTo(lMap);
          
          // Create draw button
          const drawButton = L.control({ position: 'topright' });
          
          drawButton.onAdd = function() {
            const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            div.innerHTML = `
              <a href="#" title="Draw Roof Outline" 
                 style="display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; line-height: 30px; 
                        font-weight: bold; color: #2563EB; text-decoration: none; background-color: white; border-radius: 4px; 
                        box-shadow: 0 1px 5px rgba(0,0,0,0.4); margin-bottom: 5px;">
                ✏️
              </a>
            `;
            
            // Prevent click/touch events from propagating to map
            L.DomEvent.disableClickPropagation(div);
            
            div.onclick = () => {
              // Enable pointer events for drawing
              leafletContainer.style.pointerEvents = 'auto';
              
              // Clear previous layers
              drawnItems.clearLayers();
              
              // Start drawing
              if (window.L.Draw && lMap) {
                new L.Draw.Polygon(lMap, {
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
          
          if (enableDrawing) {
            drawButton.addTo(lMap);
          }
          
          // Synchronize with Google Maps
          if (googleMapRef.current) {
            // When Google Maps moves, update Leaflet
            window.google.maps.event.addListener(googleMapRef.current, 'bounds_changed', () => {
              const center = googleMapRef.current.getCenter();
              const zoom = googleMapRef.current.getZoom();
              
              leafletMapRef.current.setView([center.lat(), center.lng()], zoom, { animate: false });
            });
          }
          
          console.log("Leaflet setup completed successfully");
          resolve();
        } catch (error) {
          console.error("Error setting up Leaflet:", error);
          // Continue anyway, we can still use Google Maps
          resolve();
        }
      });
    };
    
    // Start initialization
    initializeMaps();
    
    // Clean up function
    return () => {
      clearInterval(progressInterval);
      clearTimeout(timeoutId);
      
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
    validLat, validLng, // Only reinitialize if coordinates change
    address, 
    onMapReady, 
    onMapError, 
    onPolygonCreated, 
    enableDrawing,
    MAP_LOADING_TIMEOUT
  ]);

  // Error display
  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-red-600 p-4 text-center">
        <div>
          <p>Error loading map: {error}</p>
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
          <p className="text-gray-600">Loading map... ({loadingStatus})</p>
          
          {/* Loading progress bar */}
          <div className="w-64 h-2 bg-gray-200 rounded-full mt-3 mb-3 mx-auto">
            <div 
              className="h-full bg-primary-600 rounded-full" 
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
        </div>
      </div>
    );
  }

  // Main container
  return (
    <div 
      ref={mapContainerRef} 
      className="absolute inset-0 z-0" 
      style={{ width: '100%', height: '100%' }}
    >
      {/* Measurement instruction overlay */}
      <div className="absolute top-2 left-2 right-2 bg-white bg-opacity-80 text-xs p-2 rounded-md z-10 pointer-events-none text-gray-700">
        Use the drawing tools to outline your roof for an accurate measurement
      </div>
    </div>
  );
});

HybridMapContainer.displayName = 'HybridMapContainer';

export default HybridMapContainer;
