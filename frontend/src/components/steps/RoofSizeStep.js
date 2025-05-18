// src/components/steps/RoofSizeStep.js
import React, { useEffect, useRef, useState } from 'react';
import { Ruler, Camera, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatNumber } from '../../utils/formatters';

const RoofSizeStep = ({ formData, updateFormData, nextStep, prevStep }) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const roofPolygonRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Convert meters to degrees at the property's latitude
  const metersToDegrees = (meters, lat) => {
    const latRad = lat * (Math.PI / 180);
    const latDeg = 111132.92 - 559.82 * Math.cos(2 * latRad) + 1.175 * Math.cos(4 * latRad);
    const lngDeg = 111412.84 * Math.cos(latRad) - 93.5 * Math.cos(3 * latRad);
    return {
      lat: meters / latDeg,
      lng: meters / lngDeg
    };
  };

  // Create polygon from coordinates
  const createPolygon = (coords, map) => {
    return new window.google.maps.Polygon({
      paths: coords,
      strokeColor: '#2563EB',
      strokeOpacity: 0.9,
      strokeWeight: 2.5,
      fillColor: '#2563EB',
      fillOpacity: 0.4,
      zIndex: 100
    });
  };

  // Fallback to estimated polygon
  const createEstimatedPolygon = (lat, lng) => {
    const conversion = metersToDegrees(15, lat);
    return [
      { lat: lat - conversion.lat * 0.6, lng: lng - conversion.lng * 0.8 }, // SW
      { lat: lat - conversion.lat * 0.6, lng: lng + conversion.lng * 0.8 }, // SE
      { lat: lat + conversion.lat * 0.4, lng: lng + conversion.lng * 0.8 }, // NE
      { lat: lat + conversion.lat * 0.4, lng: lng - conversion.lng * 0.8 }  // NW
    ];
  };

  // Initialize Google Maps with satellite view
  useEffect(() => {
    let map;
    let placesService;

    const loadGoogleMapsScript = () => {
      if (window.google && window.google.maps) {
        initMap();
        return;
      }

      const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_PUBLIC_KEY;
      if (!API_KEY) {
        setError("Google Maps API key is missing");
        setLoading(false);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places,geometry`;
      script.async = true;
      script.defer = true;

      script.onload = () => initMap();
      script.onerror = () => {
        setError("Failed to load Google Maps API");
        setLoading(false);
      };

      document.head.appendChild(script);
    };

    const initMap = () => {
      if (!mapContainerRef.current || !window.google?.maps) {
        setError("Map container or Google Maps not available");
        setLoading(false);
        return;
      }

      if (!formData.lat || !formData.lng) {
        setError("Latitude or longitude is missing");
        setLoading(false);
        return;
      }

      try {
        const lat = parseFloat(formData.lat);
        const lng = parseFloat(formData.lng);

        map = new window.google.maps.Map(mapContainerRef.current, {
          center: { lat, lng },
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

        // Enable 3D buildings if available
        if (map.setOptions) {
          map.setOptions({ buildings: true });
        }

        mapRef.current = map;

        // Initialize Places API with the new recommended approach
        placesService = new window.google.maps.places.PlacesService(map);

        // Create a request for place search
        const request = {
          query: formData.address,
          fields: ['geometry'],
          locationBias: { lat, lng },
        };

        // Use the new findPlaceFromQuery method
        placesService.findPlaceFromQuery(request, (results, status) => {
          let polygonCoords;
          
          if (status === 'OK' && results[0]?.geometry?.viewport) {
            // Use actual building bounds
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
          }

          const polygon = createPolygon(polygonCoords, map);
          polygon.setMap(map);
          roofPolygonRef.current = polygon;
          setLoading(false);
        });

      } catch (err) {
        console.error("Error initializing map:", err);
        setError("Error initializing map");
        setLoading(false);
      }
    };

    loadGoogleMapsScript();

    return () => {
      // Clean up map and places service
      if (map) {
        window.google.maps.event.clearInstanceListeners(map);
      }
      if (roofPolygonRef.current) {
        roofPolygonRef.current.setMap(null);
      }
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
        {(loading || error) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
            {error ? (
              <>
                <Camera size={40} className="mb-2" />
                <p className="text-sm text-red-500">{error}</p>
                <p className="text-xs mt-1">Showing estimated roof size</p>
              </>
            ) : (
              <>
                <Camera size={40} className="mb-2" />
                <p className="text-sm">Loading satellite imagery...</p>
              </>
            )}
          </div>
        )}
        
        <div className="absolute top-2 right-2 flex flex-col z-10">
          <button 
            type="button" 
            onClick={() => mapRef.current?.setZoom((mapRef.current?.getZoom() || 19) + 1)} 
            className="bg-white w-8 h-8 rounded shadow flex items-center justify-center mb-1"
          >
            +
          </button>
          <button 
            type="button" 
            onClick={() => mapRef.current?.setZoom((mapRef.current?.getZoom() || 19) - 1)} 
            className="bg-white w-8 h-8 rounded shadow flex items-center justify-center"
          >
            -
          </button>
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
