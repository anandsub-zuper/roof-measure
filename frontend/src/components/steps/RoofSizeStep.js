// src/components/steps/RoofSizeStep.js
import React, { useState, useRef } from 'react';
import { Ruler, Camera, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatNumber } from '../../utils/formatters';
import GoogleMapContainer from '../map/GoogleMapContainer';

const RoofSizeStep = ({ formData, updateFormData, nextStep, prevStep }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mapContainerRef = useRef(null);

  // Handle map events
  const handleMapReady = () => {
    setLoading(false);
  };

  const handleMapError = (errorMessage) => {
    setError(errorMessage);
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-2">Your Roof Details</h2>
      <p className="text-sm text-gray-600 mb-4">{formData.address}</p>
      
      <div className="w-full h-64 bg-gray-200 rounded-lg mb-6 relative overflow-hidden">
        {/* The map container that isolates Google Maps from React's DOM management */}
        {formData.lat && formData.lng && (
          <div className="absolute inset-0">
            <GoogleMapContainer
              ref={mapContainerRef}
              lat={formData.lat}
              lng={formData.lng}
              address={formData.address}
              onMapReady={handleMapReady}
              onMapError={handleMapError}
            />
          </div>
        )}
        
        {/* Loading or error overlay */}
        {(loading || error) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 z-10 bg-white bg-opacity-70">
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

        {/* Zoom controls - now calling methods on the isolated component */}
        <div className="absolute top-2 right-2 flex flex-col z-20">
          <button
            type="button"
            onClick={() => {
              if (mapContainerRef.current?.zoomIn) {
                mapContainerRef.current.zoomIn();
              }
            }}
            className="bg-white w-8 h-8 rounded shadow flex items-center justify-center mb-1"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              if (mapContainerRef.current?.zoomOut) {
                mapContainerRef.current.zoomOut();
              }
            }}
            className="bg-white w-8 h-8 rounded shadow flex items-center justify-center"
          >
            -
          </button>
        </div>

        <div className="absolute bottom-2 left-2 bg-white px-3 py-1 rounded-full text-sm font-medium flex items-center z-20">
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
