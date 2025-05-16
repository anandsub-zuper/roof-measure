// src/components/steps/BuildingTypeStep.js
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const BuildingTypeStep = ({ formData, updateFormData, nextStep, prevStep }) => {
  const options = [
    { 
      id: 'residential', 
      label: 'Residential', 
      description: 'House, townhome, condo',
      bgImage: 'https://via.placeholder.com/400x300/B0C4DE/FFFFFF?text=Residential'
    },
    { 
      id: 'commercial', 
      label: 'Commercial', 
      description: 'Office, retail, warehouse',
      bgImage: 'https://via.placeholder.com/400x300/708090/FFFFFF?text=Commercial'
    }
  ];

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-2">What type of building do you have?</h2>
      <p className="text-sm text-gray-600 mb-6">We'll tailor our estimate to your building type</p>
      
      <div className="grid grid-cols-2 gap-6 w-full mb-6">
        {options.map(option => (
          <div 
            key={option.id}
            className={`border rounded-lg overflow-hidden cursor-pointer transition-all relative ${
              formData.buildingType === option.id 
                ? 'border-primary-500 ring-2 ring-primary-200' 
                : 'border-gray-300 hover:border-primary-300'
            }`}
            onClick={() => updateFormData('buildingType', option.id)}
          >
            <div className="h-40 bg-gray-200 relative">
              <div 
                className="absolute inset-0 bg-cover bg-center" 
                style={{backgroundImage: `url("${option.bgImage}")`}}
              ></div>
              
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                <h3 className="font-medium text-white text-lg">{option.label}</h3>
                <p className="text-xs text-white/80">{option.description}</p>
              </div>
              
              {formData.buildingType === option.id && (
                <div className="absolute top-3 right-3 bg-primary-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
                  ✓
                </div>
              )}
            </div>
          </div>
        ))}
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
          className="bg-primary-600 text-white py-2 px-8 rounded-lg hover:bg-primary-700 flex items-center transition-colors disabled:bg-gray-400"
          disabled={!formData.buildingType}
        >
          Continue <ChevronRight size={16} className="ml-1" />
        </button>
      </div>
    </div>
  );
};

export default BuildingTypeStep;
