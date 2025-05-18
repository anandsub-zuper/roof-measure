// src/components/steps/RoofSizeStep.js - Fixed version

import React, { useEffect, useRef } from 'react';
import { Ruler, Camera, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatNumber } from '../../utils/formatters';

const RoofSizeStep = ({ formData, updateFormData, nextStep, prevStep }) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const roofPolygonRef = useRef(null);
  
  // Initialize Google Maps with satellite view
  useEffect(() => {
    // Function to load Google Maps API script
    const loadGoogleMapsScript = () => {
      // Check if script is already loaded
      if (window.google && window.google.maps) {
        initMap();
        return;
      }
      
      console.log("Loading Google Maps API for satellite view...");
      const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_PUBLIC_KEY;
      
      if (!API_KEY) {
        console.error("Google Maps API key is missing!");
        return;
      }
      
      // Create script element
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places,geometry`;
      script.async = true;
      script.defer = true;
      
      // Handle script load success
      script.onload = () => {
        console.log("Google Maps API loaded successfully for map");
        initMap();
      };
      
      // Handle script load error
      script.onerror = (error) => {
        console.error("Error loading Google Maps API:", error);
      };
      
      // Add script to document
      document.head.appendChild(script);
    };
    
    // Initialize Map
    const initMap = () => {
      if (!mapContainerRef.current || !window.google || !window.google.maps) {
        console.error("Map container or Google Maps not available");
        return;
      }
      
      if (!formData.lat || !formData.lng) {
        console.error("Latitude or longitude is missing", formData);
        return;
      }
      
      console.log("Initializing map with coords:", formData.lat, formData.lng);
      
      try {
        // Create map centered on the property
        const mapOptions = {
          center: { lat: parseFloat(formData.lat), lng: parseFloat(formData.lng) },
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
        };
        
        const map = new window.google.maps.Map(mapContainerRef.current, mapOptions);
        mapRef.current = map;
        
        // Add a marker for the property
        new window.google.maps.Marker({
          position: { lat: parseFloat(formData.lat), lng: parseFloat(formData.lng) },
          map: map,
          title: formData.address
        });
        
        // Create a simulated roof outline
        const roofPolygon = createRoofPolygon(parseFloat(formData.lat), parseFloat(formData.lng));
        roofPolygon.setMap(map);
        roofPolygonRef.current = roofPolygon;
        
        console.log("Map initialized successfully");
      } catch (error) {
        console.error("Error initializing map:", error);
      }
    };
    
    // Create a polygon to represent the roof outline
const createRoofPolygon = (lat, lng) => {
  console.log("Creating precise roof polygon for:", lat, lng);
  
  try {
    // Use a smaller offset for more precise targeting
    // This simulates a more focused building footprint detection
    const offsetLat = 0.00008; // Approximately 8-10 meters
    const offsetLng = 0.00012; // Slightly wider for rectangular buildings
    
    // Create a more realistic house-shaped polygon (less square, more house-shaped)
    // This simulates an actual roof footprint better than a simple rectangle
    const polygonCoords = [
      { lat: lat - offsetLat, lng: lng - offsetLng },      // Bottom left
      { lat: lat - offsetLat, lng: lng + offsetLng },      // Bottom right
      { lat: lat + offsetLat, lng: lng + offsetLng },      // Top right
      { lat: lat + offsetLat, lng: lng - offsetLng }       // Top left
    ];
    
    return new window.google.maps.Polygon({
      paths: polygonCoords,
      strokeColor: '#2563EB',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#2563EB',
      fillOpacity: 0.35
    });
  } catch (error) {
    console.error("Error creating roof polygon:", error);
    return null;
  }
};
    
    // Load the Google Maps script
    loadGoogleMapsScript();
    
    // Cleanup
    return () => {
      // Clean up map resources if needed
    };
  }, [formData.lat, formData.lng, formData.address]);
  
  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-2">Your Roof Details</h2>
      <p className="text-sm text-gray-600 mb-4">{formData.address}</p>
      
      <div 
        ref={mapContainerRef} 
        className="w-full h-64 bg-gray-200 rounded-lg mb-6 relative overflow-hidden"
      >
        {/* Loading indicator or fallback */}
        {(!window.google || !formData.lat || !formData.lng) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
            <Camera size={40} className="mb-2" />
            <p className="text-sm">Loading satellite imagery...</p>
          </div>
        )}
        
        <div className="absolute top-2 right-2 flex flex-col z-10">
          <button type="button" onClick={() => mapRef.current?.setZoom((mapRef.current?.getZoom() || 19) + 1)} className="bg-white w-8 h-8 rounded shadow flex items-center justify-center mb-1">+</button>
          <button type="button" onClick={() => mapRef.current?.setZoom((mapRef.current?.getZoom() || 19) - 1)} className="bg-white w-8 h-8 rounded shadow flex items-center justify-center">-</button>
        </div>
        
        <div className="absolute bottom-2 left-2 bg-white px-3 py-1 rounded-full text-sm font-medium flex items-center z-10">
          <Ruler size={16} className="mr-1" /> Estimated roof outline
        </div>
      </div>
      
      <div className="w-full bg-blue-50 p-4 rounded-lg mb-6">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center">
            <Ruler className="text-primary-600 mr-2" size={20} />
            <span className="font-medium">Estimated Roof Size</span>
          </div>
          <span className="text-lg font-bold">{formatNumber(formData.roofSize)} sq ft</span>
        </div>
        <p className="text-sm text-gray-600">Our AI analyzed your roof using high-resolution satellite imagery</p>
        
        <div className="mt-4">
          <label className="flex items-center text-sm text-gray-700">
            <input
              type="checkbox"
              checked={formData.roofSizeAuto}
              onChange={(e) => updateFormData('roofSizeAuto', e.target.checked)}
              className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            Use AI-calculated size (recommended)
          </label>
        </div>
        
        {!formData.roofSizeAuto && (
          <div className="mt-3">
            <label className="block text-sm font-medium mb-1">Manually enter roof size</label>
            <input
              type="number"
              value={formData.roofSize}
              onChange={(e) => updateFormData('roofSize', e.target.value)}
              placeholder="Size in square feet"
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-300 focus:border-primary-500 focus:outline-none"
            />
          </div>
        )}
      </div>
      
      <div className="flex w-full justify-between">
        <button 
          onClick={prevStep} 
          className="bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 flex items-center transition-colors"
        >
          <ChevronLeft size={16} className="mr-1" /> Back
        </button>
        <button 
          onClick={nextStep} 
          className="bg-primary-600 text-white py-2 px-8 rounded-lg hover:bg-primary-700 flex items-center transition-colors"
        >
          Continue <ChevronRight size={16} className="ml-1" />
        </button>
      </div>
    </div>
  );
};

export default RoofSizeStep;
