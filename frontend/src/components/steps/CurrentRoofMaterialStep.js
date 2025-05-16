// src/components/steps/CurrentRoofMaterialStep.js
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const CurrentRoofMaterialStep = ({ formData, updateFormData, nextStep, prevStep }) => {
  const options = [
    { 
      id: 'asphalt', 
      label: 'Asphalt Shingles', 
      description: 'Most common roofing material',
      bgImage: 'https://via.placeholder.com/300x200/404040/FFFFFF?text=Asphalt'
    },
    { 
      id: 'metal', 
      label: 'Metal', 
      description: 'Corrugated or standing seam',
      bgImage: 'https://via.placeholder.com/300x200/708090/FFFFFF?text=Metal'
    },
    { 
      id: 'tile', 
      label: 'Tile', 
      description: 'Clay or concrete tile',
      bgImage: 'https://via.placeholder.com/300x200/CD5C5C/FFFFFF?text=Tile'
    },
    { 
      id: 'cedar', 
      label: 'Cedar Shakes', 
      description: 'Wood shingles or shakes',
      bgImage: 'https://via.placeholder.com/300x200/8B4513/FFFFFF?text=Cedar'
    }
  ];

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-2">What's currently on your roof?</h2>
      <p className="text-sm text-gray-600 mb-6">This helps us determine removal costs and requirements</p>
      
      <div className="grid grid-cols-2 gap-4 w-full mb-6">
        {options.map(option => (
          <div 
            key={option.id}
            className={`border rounded-lg overflow-hidden cursor-pointer transition-all relative ${
              formData.currentRoofMaterial === option.id 
                ? 'border-primary-500 ring-2 ring-primary-200' 
                : 'border-gray-300 hover:border-primary-300'
            }`}
            onClick={() => updateFormData('currentRoofMaterial', option.id)}
          >
            <div className="h-28 bg-gray-200 relative">
              <div 
                className="absolute inset-0 bg-cover bg-center" 
                style={{backgroundImage: `url("${option.bgImage}")`}}
              ></div>
              
              {formData.currentRoofMaterial === option.id && (
                <div className="absolute top-2 right-2 bg-primary-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
                  ✓
                </div>
              )}
            </div>
            <div className="p-3">
              <h3 className="font-medium">{option.label}</h3>
              <p className="text-xs text-gray-500">{option.description}</p>
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
          disabled={!formData.currentRoofMaterial}
        >
          Continue <ChevronRight size={16} className="ml-1" />
        </button>
      </div>
    </div>
  );
};

export default CurrentRoofMaterialStep;
