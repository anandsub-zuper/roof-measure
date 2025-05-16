// src/components/steps/RoofSteepnessStep.js
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const RoofSteepnessStep = ({ formData, updateFormData, nextStep, prevStep }) => {
  const options = [
    { 
      id: 'flat', 
      label: 'Flat', 
      description: 'No noticeable slope',
      image: (
        <div className="w-full h-24 flex items-center justify-center">
          <div className="w-32 h-6 bg-gray-300 rounded"></div>
        </div>
      )
    },
    { 
      id: 'low', 
      label: 'Low', 
      description: 'Slight slope, easily walkable',
      image: (
        <div className="w-full h-24 flex items-center justify-center">
          <div className="w-32 h-24 bg-gray-100 rounded relative">
            <div className="absolute inset-0 rounded" style={{clipPath: 'polygon(0% 100%, 100% 100%, 50% 70%)'}}>
              <div className="w-full h-full bg-gray-300"></div>
            </div>
          </div>
        </div>
      )
    },
    { 
      id: 'moderate', 
      label: 'Moderate', 
      description: 'Standard slope, walkable with care',
      image: (
        <div className="w-full h-24 flex items-center justify-center">
          <div className="w-32 h-24 bg-gray-100 rounded relative">
            <div className="absolute inset-0 rounded" style={{clipPath: 'polygon(0% 100%, 100% 100%, 50% 40%)'}}>
              <div className="w-full h-full bg-gray-300"></div>
            </div>
          </div>
        </div>
      )
    },
    { 
      id: 'steep', 
      label: 'Steep', 
      description: 'Sharp incline, requires special equipment',
      image: (
        <div className="w-full h-24 flex items-center justify-center">
          <div className="w-32 h-24 bg-gray-100 rounded relative">
            <div className="absolute inset-0 rounded" style={{clipPath: 'polygon(0% 100%, 100% 100%, 50% 10%)'}}>
              <div className="w-full h-full bg-gray-300"></div>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-2">How steep is your roof?</h2>
      <p className="text-sm text-gray-600 mb-6">This helps us calculate labor and safety requirements</p>
      
      <div className="grid grid-cols-2 gap-4 w-full mb-6">
        {options.map(option => (
          <div 
            key={option.id}
            className={`border rounded-lg p-4 cursor-pointer transition-all relative ${
              formData.roofSteepness === option.id 
                ? 'border-primary-500 bg-primary-50' 
                : 'border-gray-300 hover:border-primary-300'
            }`}
            onClick={() => updateFormData('roofSteepness', option.id)}
          >
            {option.image}
            
            <div className="text-center mt-3">
              <h3 className="font-medium text-gray-800">{option.label}</h3>
              <p className="text-xs text-gray-500 mt-1">{option.description}</p>
            </div>
            
            {formData.roofSteepness === option.id && (
              <div className="absolute top-3 right-3 bg-primary-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
                ✓
              </div>
            )}
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
          disabled={!formData.roofSteepness}
        >
          Continue <ChevronRight size={16} className="ml-1" />
        </button>
      </div>
    </div>
  );
};

export default RoofSteepnessStep;
