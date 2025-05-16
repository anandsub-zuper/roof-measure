// src/components/steps/RoofSizeStep.js
import React, { useEffect, useRef } from 'react';
import { Ruler, Camera, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatNumber } from '../../utils/formatters';

const RoofSizeStep = ({ formData, updateFormData, nextStep, prevStep }) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const roofPolygonRef = useRef(null);
  
  // Initialize Google Maps with satellite view
  useEffect(() => {
    if (window.google && window.google.maps && mapContainerRef.current && formData.lat && formData.lng) {
      // Create map centered on the property
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: { lat: formData.lat, lng: formData.lng },
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
      mapRef.current = map;
      
      // Add a marker for the property
      new window.google.maps.Marker({
        position: { lat: formData.lat, lng: formData.lng },
        map: map,
        title: formData.address
      });
      
      // Create a simulated roof outline (polygon)
      // In a real app, this would come from satellite imagery analysis
      const roofPolygon = createRoofPolygon(formData.lat, formData.lng);
      roofPolygon.setMap(map);
      roofPolygonRef.current = roofPolygon;
    }
  }, [formData.lat, formData.lng, formData.address]);
  
  // Create a polygon to represent the roof outline
  const createRoofPolygon = (lat, lng) => {
    // Simulate a roof outline around the given coordinates
    const offset = 0.0003; // approximately 30 meters
    
    const polygonCoords = [
      { lat: lat - offset, lng: lng - offset },
      { lat: lat - offset, lng: lng + offset },
      { lat: lat + offset, lng: lng + offset },
      { lat: lat + offset, lng: lng - offset }
    ];
    
    return new window.google.maps.Polygon({
      paths: polygonCoords,
      strokeColor: '#2563EB',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#2563EB',
      fillOpacity: 0.35
    });
  };
  
  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-2">Your Roof Details</h2>
      <p className="text-sm text-gray-600 mb-4">{formData.address}</p>
      
      <div 
        ref={mapContainerRef} 
        className="w-full h-64 bg-gray-200 rounded-lg mb-6 relative overflow-hidden"
      >
        {/* This will be replaced with the Google Maps satellite view */}
        {(!window.google || !formData.lat) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
            <Camera size={40} className="mb-2" />
            <p className="text-sm">Loading satellite imagery...</p>
          </div>
        )}
        
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
