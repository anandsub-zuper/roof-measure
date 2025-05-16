// src/components/steps/DesiredRoofMaterialStep.js
import React from 'react';
import { ChevronLeft, ChevronRight, Clock, DollarSign, Shield } from 'lucide-react';

const DesiredRoofMaterialStep = ({ formData, updateFormData, nextStep, prevStep }) => {
  const options = [
    { 
      id: 'asphalt', 
      label: 'Asphalt Shingles', 
      description: 'Affordable and reliable',
      lifespan: '15-30 years',
      cost: '$-$$',
      bgImage: 'https://via.placeholder.com/300x200/404040/FFFFFF?text=Asphalt'
    },
    { 
      id: 'metal', 
      label: 'Metal Roof', 
      description: 'Durable and energy efficient',
      lifespan: '40-70 years',
      cost: '$$-$$$',
      bgImage: 'https://via.placeholder.com/300x200/708090/FFFFFF?text=Metal'
    },
    { 
      id: 'tile', 
      label: 'Tile Roof', 
      description: 'Elegant and long-lasting',
      lifespan: '50+ years',
      cost: '$$$-$$$$',
      bgImage: 'https://via.placeholder.com/300x200/CD5C5C/FFFFFF?text=Tile'
    }
  ];

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-2">What type of roof would you like?</h2>
      <p className="text-sm text-gray-600 mb-6">Choose the material that best fits your budget and preferences</p>
      
      <div className="space-y-4 w-full mb-6">
        {options.map(option => (
          <div 
            key={option.id}
            className={`border rounded-lg overflow-hidden cursor-pointer transition-all relative ${
              formData.desiredRoofMaterial === option.id 
                ? 'border-primary-500 bg-primary-50' 
                : 'border-gray-300 hover:border-primary-300'
            }`}
            onClick={() => updateFormData('desiredRoofMaterial', option.id)}
          >
            <div className="flex">
              <div className="w-1/3 h-28 bg-gray-200 relative">
                <div 
                  className="absolute inset-0 bg-cover bg-center" 
                  style={{backgroundImage: `url("${option.bgImage}")`}}
                ></div>
              </div>
              <div className="w-2/3 p-3">
                <h3 className="font-medium text-gray-800">{option.label}</h3>
                <p className="text-xs text-gray-500 mb-2">{option.description}</p>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center">
                    <Clock size={14} className="text-primary-500 mr-1" />
                    <span>{option.lifespan}</span>
                  </div>
                  <div className="flex items-center">
                    <DollarSign size={14} className="text-primary-500 mr-1" />
                    <span>{option.cost}</span>
                  </div>
                </div>
              </div>
              
              {formData.desiredRoofMaterial === option.id && (
                <div className="absolute top-3 right-3 bg-primary-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
                  ✓
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <div className="flex items-start">
          <Shield className="text-primary-600 mt-1 mr-3 flex-shrink-0" size={20} />
          <div>
            <p className="text-sm font-medium text-gray-700">Material Quality Guarantee</p>
            <p className="text-xs text-gray-500">All our roofing materials come with manufacturer warranties and are installed by certified professionals.</p>
          </div>
        </div>
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
          disabled={!formData.desiredRoofMaterial}
        >
          Continue <ChevronRight size={16} className="ml-1" />
        </button>
      </div>
    </div>
  );
};

export default DesiredRoofMaterialStep;
