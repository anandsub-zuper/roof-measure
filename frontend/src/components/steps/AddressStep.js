// src/components/steps/AddressStep.js
import React, { useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';
import * as mapsService from '../../services/mapsService';

const AddressStep = ({ formData, updateFormData, nextStep, isLoading }) => {
  const inputRef = useRef(null);
  
  // Initialize Google Places Autocomplete
  useEffect(() => {
    let autocomplete = null;
    
    const initializeAutocomplete = async () => {
      try {
        autocomplete = await mapsService.initAutocomplete(inputRef.current);
        
        if (autocomplete) {
          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            
            if (place && place.formatted_address) {
              updateFormData('address', place.formatted_address);
            }
          });
        }
      } catch (error) {
        console.error("Error initializing address autocomplete:", error);
      }
    };
    
    if (inputRef.current) {
      initializeAutocomplete();
    }
    
    // Cleanup
    return () => {
      if (autocomplete && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocomplete);
      }
    };
  }, [updateFormData]);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.address) {
      nextStep();
    }
  };
  
  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-4">Enter your property address</h2>
      <p className="text-sm text-gray-600 mb-4">We'll use satellite imagery to accurately measure your roof</p>
      
      <form onSubmit={handleSubmit} className="w-full">
        <div className="w-full relative mb-6">
          <MapPin className="absolute left-3 top-3 text-gray-400" size={20} />
          <input
            ref={inputRef}
            type="text"
            value={formData.address}
            onChange={(e) => updateFormData('address', e.target.value)}
            placeholder="123 Main St, City, State ZIP"
            className="w-full p-3 pl-10 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-300 focus:border-primary-500 focus:outline-none"
            autoComplete="off"
          />
        </div>
        
        <p className="text-sm text-gray-500 mb-6">
          We use advanced satellite imagery and AI to measure your roof and generate an accurate estimate
        </p>
        
        <button 
          type="submit"
          disabled={!formData.address || isLoading}
          className="bg-primary-600 text-white py-3 px-8 rounded-lg font-medium hover:bg-primary-700 disabled:bg-gray-400 w-full flex justify-center items-center transition-colors"
        >
          {isLoading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Analyzing Address...
            </span>
          ) : "Find My Roof"}
        </button>
      </form>
    </div>
  );
};

export default AddressStep;
