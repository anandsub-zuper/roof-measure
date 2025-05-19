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
  // Refs for DOM elements and map instances
  const mapContainerRef = useRef(null);
  const leafletContainerRef = useRef(null);
  const googleMapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const drawnItemsRef = useRef(null);
  const drawnPolygonRef = useRef(null);
  
  // State for UI management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState('initializing');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  
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
            
            // Also fit Google Maps to the same bounds
            if (googleMapRef.current) {
              const bounds = drawnPolygonRef.current.getBounds();
              const googleBounds = new window.google.maps.LatLngBounds(
                new window.google.maps.LatLng(bounds.getSouth(), bounds.getWest()),
                new window.google.maps.LatLng(bounds.getNorth(), bounds.getEast())
              );
              googleMapRef.current.fitBounds(googleBounds);
            }
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
      
      // Try to create polygon using Leaflet if available - prioritize this approach
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
          
          // Also fit Google Maps to the same bounds
          if (googleMapRef.current) {
            const bounds = leafletPolygon.getBounds();
            const googleBounds = new window.google.maps.LatLngBounds(
              new window.google.maps.LatLng(bounds.getSouth(), bounds.getWest()),
              new window.google.maps.LatLng(bounds.getNorth(), bounds.getEast())
            );
            googleMapRef.current.fitBounds(googleBounds);
          }
          
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
  
  // Load Google Maps API first
  useEffect(() => {
    let timeoutId;
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => Math.min(prev + 5, 40));
    }, 1000);
    
    const loadGoogleMapsAPI = async () => {
      try {
        setLoadingStatus('loading Google Maps');
        
        // Set a timeout to prevent hanging
        timeoutId = setTimeout(() => {
          setError("Google Maps loading timed out after 30 seconds");
          setLoading(false);
          clearInterval(progressInterval);
          if (onMapError) onMapError("Loading timed out");
        }, 30000);
        
        // Check if already loaded
        if (window.google && window.google.maps) {
          console.log("Google Maps already loaded");
          clearTimeout(timeoutId);
          setGoogleMapsLoaded(true);
          setLoadingProgress(50);
          
          // Go ahead and initialize the map
          initializeGoogleMap();
          return;
        }
        
        // Get API key
        const apiKey = config.googleMapsApiKey;
        
        if (!apiKey) {
          throw new Error("Google Maps API key is missing from configuration");
        }
        
        // Load Google Maps API
        window.initGoogleMapsCallback = () => {
          console.log("Google Maps loaded successfully");
          clearTimeout(timeoutId);
          setGoogleMapsLoaded(true);
          setLoadingProgress(50);
          
          // Initialize the map
          initializeGoogleMap();
          delete window.initGoogleMapsCallback;
        };
        
        // Create script tag
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,drawing&callback=initGoogleMapsCallback`;
        script.async = true;
        script.defer = true;
        
        script.onerror = (error) => {
          console.error("Error loading Google Maps script:", error);
          clearTimeout(timeoutId);
          setError("Failed to load Google Maps. Please check your internet connection.");
          setLoading(false);
          clearInterval(progressInterval);
          if (onMapError) onMapError("Google Maps script failed to load");
        };
        
        document.head.appendChild(script);
      } catch (error) {
        console.error("Error loading Google Maps:", error);
        clearTimeout(timeoutId);
        setError(error.message || "Failed to load Google Maps");
        setLoading(false);
        clearInterval(progressInterval);
        if (onMapError) onMapError(error.message || "Failed to load Google Maps");
      }
    };
    
    const initializeGoogleMap = () => {
      try {
        setLoadingStatus('creating map');
        setLoadingProgress(prev => Math.min(prev + 10, 70));
        
        // Create the Google Map
        if (!mapContainerRef.current) {
          throw new Error("Map container reference is not available");
        }
        
        // Initialize the map with satellite view
        const map = new window.google.maps.Map(mapContainerRef.current, {
          center: { lat: validLat, lng: validLng },
          zoom: 19,
          mapTypeId: 'satellite',
          tilt: 0,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true
        });
        
        // Store the reference
        googleMapRef.current = map;
        
        // Add a marker at the property location
        new window.google.maps.Marker({
          position: { lat: validLat, lng: validLng },
          map: map,
          title: address || "Property Location"
        });
        
        // After Google Maps is initialized, load Leaflet
        loadLeafletLibrary();
        
        console.log("Google Maps initialized successfully");
      } catch (error) {
        console.error("Error initializing Google Maps:", error);
        setError(error.message || "Failed to initialize Google Maps");
        setLoading(false);
        clearInterval(progressInterval);
        if (onMapError) onMapError(error.message || "Failed to initialize Google Maps");
      }
    };
    
    const loadLeafletLibrary = () => {
      try {
        setLoadingStatus('loading Leaflet');
        setLoadingProgress(prev => Math.min(prev + 10, 80));
        
        // Check if Leaflet is already loaded
        if (window.L) {
          console.log("Leaflet already loaded");
          setLeafletLoaded(true);
          initializeLeafletMap();
          return;
        }
        
        // Create Leaflet CSS link
        const leafletCss = document.createElement('link');
        leafletCss.rel = 'stylesheet';
        leafletCss.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        leafletCss.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        leafletCss.crossOrigin = '';
        document.head.appendChild(leafletCss);
        
        // Create Leaflet Draw CSS link
        const leafletDrawCss = document.createElement('link');
        leafletDrawCss.rel = 'stylesheet';
        leafletDrawCss.href = 'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css';
        document.head.appendChild(leafletDrawCss);
        
        // Load Leaflet script
        const leafletScript = document.createElement('script');
        leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        leafletScript.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
        leafletScript.crossOrigin = '';
        document.head.appendChild(leafletScript);
        
        leafletScript.onload = () => {
          console.log("Leaflet loaded successfully");
          
          // Now load Leaflet Draw
          const leafletDrawScript = document.createElement('script');
          leafletDrawScript.src = 'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js';
          document.head.appendChild(leafletDrawScript);
          
          leafletDrawScript.onload = () => {
            console.log("Leaflet Draw loaded successfully");
            setLeafletLoaded(true);
            initializeLeafletMap();
          };
          
          leafletDrawScript.onerror = (error) => {
            console.error("Failed to load Leaflet Draw:", error);
            // Continue anyway with just Leaflet
            setLeafletLoaded(true);
            initializeLeafletMap();
          };
        };
        
        leafletScript.onerror = (error) => {
          console.error("Failed to load Leaflet:", error);
          // Continue without Leaflet, using just Google Maps
          completeInitialization();
        };
      } catch (error) {
        console.error("Error loading Leaflet:", error);
        // Continue without Leaflet
        completeInitialization();
      }
    };
    
    const initializeLeafletMap = () => {
      try {
        setLoadingStatus('initializing Leaflet');
        setLoadingProgress(prev => Math.min(prev + 10, 90));
        
        // Create a separate container for Leaflet that overlays the Google Map
        const leafletContainer = document.createElement('div');
        leafletContainer.style.position = 'absolute';
        leafletContainer.style.top = '0';
        leafletContainer.style.left = '0';
        leafletContainer.style.width = '100%';
        leafletContainer.style.height = '100%';
        leafletContainer.style.zIndex = '1000';
        leafletContainer.style.pointerEvents = 'none'; // Initially transparent to clicks
        leafletContainer.id = 'leaflet-container';
        
        // Store in ref for later use
        leafletContainerRef.current = leafletContainer;
        
        // Add the container to the map container
        if (mapContainerRef.current) {
          mapContainerRef.current.appendChild(leafletContainer);
        } else {
          throw new Error("Map container not found");
        }
        
        // Initialize Leaflet map with empty tile layer (transparent)
        const map = L.map(leafletContainer, {
          center: [validLat, validLng],
          zoom: googleMapRef.current ? googleMapRef.current.getZoom() : 19,
          zoomControl: false,
          attributionControl: false
        });
        
        // Add an empty/transparent tile layer
        L.tileLayer('', {
          opacity: 0
        }).addTo(map);
        
        // Store the Leaflet map reference
        leafletMapRef.current = map;
        
        // Create feature group for drawings
        const drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);
        drawnItemsRef.current = drawnItems;
        
        // Initialize drawing controls if Leaflet Draw is available
        if (window.L.Control && window.L.Control.Draw && enableDrawing) {
          console.log("Setting up Leaflet Draw controls");
          
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
          
          // Enable pointer events when drawing starts
          map.on(L.Draw.Event.DRAWSTART, () => {
            leafletContainer.style.pointerEvents = 'auto';
          });
          
          // Disable pointer events when drawing stops
          map.on(L.Draw.Event.DRAWSTOP, () => {
            leafletContainer.style.pointerEvents = 'none';
          });
          
          // Handle creation of new drawings
          map.on(L.Draw.Event.CREATED, (event) => {
            // Clear existing drawings
            drawnItems.clearLayers();
            
            // Add the new layer
            const layer = event.layer;
            drawnItems.addLayer(layer);
            
            // Store reference
            drawnPolygonRef.current = layer;
            
            // Calculate area
            const latLngs = layer.getLatLngs()[0];
            const coordinates = latLngs.map(point => ({
              lat: point.lat,
              lng: point.lng
            }));
            
            const area = calculatePolygonArea(coordinates);
            
            // Mark as user-created
            layer._userCreated = true;
            
            // Notify parent
            if (onPolygonCreated) {
              onPolygonCreated(layer, area);
            }
            
            // Revert to pointer-events none
            leafletContainer.style.pointerEvents = 'none';
          });
          
          // Handle editing existing drawings
          map.on(L.Draw.Event.EDITED, (event) => {
            const layers = event.layers;
            layers.eachLayer((layer) => {
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
            });
          });
        }
        
        // Add custom buttons for measurement and drawing
        addCustomControls(map, leafletContainer);
        
        // Sync with Google Maps
        if (googleMapRef.current) {
          window.google.maps.event.addListener(googleMapRef.current, 'bounds_changed', () => {
            const center = googleMapRef.current.getCenter();
            const zoom = googleMapRef.current.getZoom();
            
            if (center && zoom && map) {
              map.setView([center.lat(), center.lng()], zoom, { animate: false });
            }
          });
        }
        
        // Show initial polygon
        setTimeout(() => {
          createRoofPolygon();
        }, 300);
        
        // Finish initialization
        completeInitialization();
      } catch (error) {
        console.error("Error initializing Leaflet:", error);
        // Continue with just Google Maps
        completeInitialization();
      }
    };
    
    const addCustomControls = (map, container) => {
      // Draw Button
      const drawButton = L.control({ position: 'topright' });
      drawButton.onAdd = function() {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        div.innerHTML = `
          <a href="#" title="Draw Roof Outline" 
             style="display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; font-size: 16px; 
                    font-weight: bold; color: #2563EB; text-decoration: none; background-color: white; border-radius: 4px; 
                    box-shadow: 0 1px 5px rgba(0,0,0,0.4); margin-bottom: 5px;">
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
          
          // Start polygon drawing
          if (window.L.Draw && map) {
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
      
      if (enableDrawing && window.L.Draw) {
        drawButton.addTo(map);
      }
      
      // Measure Button
      const measureButton = L.control({ position: 'topright' });
      measureButton.onAdd = function() {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        div.innerHTML = `
          <a href="#" title="Measure Roof Area" 
             style="display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; font-size: 16px; 
                    font-weight: bold; color: #2563EB; text-decoration: none; background-color: white; border-radius: 4px; 
                    box-shadow: 0 1px 5px rgba(0,0,0,0.4);">
            📏
          </a>
        `;
        
        L.DomEvent.disableClickPropagation(div);
        div.onclick = () => {
          if (drawnPolygonRef.current) {
            try {
              let area = 0;
              
              // Get coordinates from the active polygon
              if (drawnPolygonRef.current.getLatLngs) {
                const latLngs = drawnPolygonRef.current.getLatLngs()[0];
                const coordinates = latLngs.map(point => ({
                  lat: point.lat,
                  lng: point.lng
                }));
                
                area = calculatePolygonArea(coordinates);
              } else if (drawnPolygonRef.current.getPath) {
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
              
              // Display the result
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
      
      measureButton.addTo(map);
    };
    
    const completeInitialization = () => {
      setLoadingProgress(100);
      setLoading(false);
      clearInterval(progressInterval);
      
      console.log("Map initialization complete");
      
      // Notify parent component
      if (onMapReady) {
        onMapReady(googleMapRef.current);
      }
    };
    
    // Start the initialization process
    // First, validate coordinates
    if (isNaN(validLat) || isNaN(validLng)) {
      const errorMsg = `Invalid coordinates: ${lat}, ${lng}`;
      setError(errorMsg);
      setLoading(false);
      clearInterval(progressInterval);
      if (onMapError) onMapError(errorMsg);
      return;
    }
    
    // Start loading Google Maps
    loadGoogleMapsAPI();
    
    // Cleanup function
    return () => {
      clearInterval(progressInterval);
      if (timeoutId) clearTimeout(timeoutId);
      
      // Clean up Google Maps
      if (googleMapRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(googleMapRef.current);
      }
      
      // Clean up Leaflet
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
      }
    };
  }, [validLat, validLng, address, roofSize, propertyData, roofPolygon, enableDrawing, onMapReady, onMapError, onPolygonCreated]);
  
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
          <p className="text-gray-600 mb-2">Loading map... ({loadingStatus})</p>
          
          {/* Loading progress bar */}
          <div className="w-64 h-2 bg-gray-200 rounded-full mt-2 mb-2 mx-auto">
            <div 
              className="h-full bg-primary-600 rounded-full transition-all duration-300"
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
      className="absolute inset-0" 
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
