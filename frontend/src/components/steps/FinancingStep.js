// src/components/steps/FinancingStep.js
import React from 'react';
import { ChevronLeft, ChevronRight, DollarSign, CreditCard, Calculator } from 'lucide-react';

const FinancingStep = ({ formData, updateFormData, nextStep, prevStep, isLoading }) => {
  const options = [
    { 
      id: 'yes', 
      label: 'Yes, I\'m interested', 
      description: 'Show me financing options', 
      icon: <CreditCard className="text-green-500" size={24} />
    },
    { 
      id: 'no', 
      label: 'No, I\'ll pay directly', 
      description: 'I don\'t need financing', 
      icon: <DollarSign className="text-primary-500" size={24} />
    },
    { 
      id: 'maybe', 
      label: 'Maybe, tell me more', 
      description: 'I\'d like to learn about my options', 
      icon: <Calculator className="text-purple-500" size={24} />
    }
  ];

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-2">Are you interested in financing options?</h2>
      <p className="text-sm text-gray-600 mb-6">Many homeowners qualify for low monthly payments</p>
      
      <div className="space-y-3 w-full mb-6">
        {options.map(option => (
          <div 
            key={option.id}
            className={`border rounded-lg p-3 cursor-pointer transition-all flex items-center ${
              formData.financing === option.id 
                ? 'border-primary-500 bg-primary-50' 
                : 'border-gray-300 hover:border-primary-300'
            }`}
            onClick={() => updateFormData('financing', option.id)}
          >
            <div className="mr-3">
              {option.icon}
            </div>
            <div>
              <h3 className="font-medium text-gray-800">{option.label}</h3>
              <p className="text-xs text-gray-500">{option.description}</p>
            </div>
            
            {formData.financing === option.id && (
              <div className="ml-auto bg-primary-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
                ✓
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="w-full p-4 bg-gray-50 rounded-lg mb-6">
        <p className="text-sm text-gray-700">
          <span className="font-medium">Did you know?</span> A new roof can increase your home's value by up to 7% and may qualify for insurance discounts in many cases.
        </p>
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
          disabled={!formData.financing || isLoading}
        >
          {isLoading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating...
            </span>
          ) : (
            <>Generate Estimate <Calculator className="ml-2" size={16} /></>
          )}
        </button>
      </div>
    </div>
  );
};

export default FinancingStep;
