// src/components/steps/TimelineStep.js
import React from 'react';
import { ChevronLeft, ChevronRight, Clock, AlertTriangle, Calendar, HelpCircle } from 'lucide-react';

const TimelineStep = ({ formData, updateFormData, nextStep, prevStep }) => {
  const options = [
    { 
      id: 'emergency', 
      label: 'Emergency', 
      description: 'I need immediate help (leaks, damage)', 
      icon: <AlertTriangle className="text-red-500" size={24} />
    },
    { 
      id: 'asap', 
      label: 'As soon as possible', 
      description: 'Within the next few weeks', 
      icon: <Clock className="text-orange-500" size={24} />
    },
    { 
      id: '1_3_months', 
      label: 'In 1-3 months', 
      description: 'Planning ahead for the near future', 
      icon: <Calendar className="text-primary-500" size={24} />
    },
    { 
      id: 'planning', 
      label: 'Just planning', 
      description: 'Researching options and costs', 
      icon: <HelpCircle className="text-green-500" size={24} />
    }
  ];

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-2">When do you need the project completed?</h2>
      <p className="text-sm text-gray-600 mb-6">This helps us prioritize emergency situations</p>
      
      <div className="space-y-3 w-full mb-6">
        {options.map(option => (
          <div 
            key={option.id}
            className={`border rounded-lg p-3 cursor-pointer transition-all flex items-center ${
              formData.timeline === option.id 
                ? 'border-primary-500 bg-primary-50' 
                : 'border-gray-300 hover:border-primary-300'
            }`}
            onClick={() => updateFormData('timeline', option.id)}
          >
            <div className="mr-3">
              {option.icon}
            </div>
            <div>
              <h3 className="font-medium text-gray-800">{option.label}</h3>
              <p className="text-xs text-gray-500">{option.description}</p>
            </div>
            
            {formData.timeline === option.id && (
              <div className="ml-auto bg-primary-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
                ✓
              </div>
            )}
          </div>
        ))}
      </div>
      
      {formData.timeline === 'emergency' && (
        <div className="w-full p-4 bg-red-50 rounded-lg border border-red-200 mb-6">
          <div className="flex">
            <AlertTriangle className="text-red-500 mr-3 flex-shrink-0" size={20} />
            <p className="text-sm text-red-700">
              For emergency situations, we'll prioritize your request and connect you with available contractors as soon as possible.
            </p>
          </div>
        </div>
      )}
      
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
          disabled={!formData.timeline}
        >
          Continue <ChevronRight size={16} className="ml-1" />
        </button>
      </div>
    </div>
  );
};

export default TimelineStep;
