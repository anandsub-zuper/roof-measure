// src/components/steps/EstimateResultStep.js
import React from 'react';
import { ChevronLeft, ChevronRight, ArrowDown, Check } from 'lucide-react';
import { formatCurrency, formatNumber } from '../../utils/formatters';

const EstimateResultStep = ({ formData, estimateResult, nextStep, prevStep }) => {
  // If estimate result is not available yet, show loading
  if (!estimateResult) {
    return (
      <div className="flex flex-col items-center w-full max-w-md mx-auto">
        <div className="w-full text-center py-12">
          <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-xl font-semibold mb-2">Generating Your Estimate</h2>
          <p className="text-gray-600">Please wait while our AI analyzes your roof details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full max-w-xl mx-auto">
      <div className="bg-primary-600 text-white w-full py-4 px-6 rounded-t-lg">
        <h2 className="text-xl font-semibold text-center">Your AI-Generated Roof Estimate</h2>
        <p className="text-center text-sm opacity-80">Based on satellite imagery and your preferences</p>
      </div>
      
      <div className="bg-white p-6 rounded-b-lg shadow-lg w-full">
        <div className="flex justify-between items-center mb-6 pb-4 border-b">
          <div>
            <p className="text-sm text-gray-500">Property Address</p>
            <p className="font-medium">{formData.address}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Roof Size</p>
            <p className="font-medium">{formatNumber(formData.roofSize)} sq ft</p>
          </div>
        </div>
        
        <div className="bg-primary-50 p-4 rounded-lg mb-6">
          <h3 className="text-lg font-semibold mb-2 text-center text-primary-800">Estimated Cost Range</h3>
          <div className="flex justify-between items-center">
            <div className="text-center">
              <p className="text-sm text-gray-500">Low</p>
              <p className="text-xl font-bold">{formatCurrency(estimateResult.lowEstimate)}</p>
            </div>
            <div className="text-center px-4 py-2 bg-primary-100 rounded-lg border-2 border-primary-200">
              <p className="text-sm text-primary-700">Average</p>
              <p className="text-2xl font-bold text-primary-800">{formatCurrency(estimateResult.estimate)}</p>
              <p className="text-xs text-primary-600">${estimateResult.pricePerSqft}/sq ft</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">High</p>
              <p className="text-xl font-bold">{formatCurrency(estimateResult.highEstimate)}</p>
            </div>
          </div>
        </div>
        
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Estimate Breakdown</h3>
          <div className="space-y-2">
            {estimateResult.estimateParts.map((part, index) => (
              <div key={index} className="flex justify-between">
                <span className="text-gray-700">{part.name}</span>
                <span className="font-medium">{formatCurrency(part.cost)}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Factors Affecting Your Estimate</h3>
          <div className="space-y-3">
            {estimateResult.estimateFactors.map((factor, index) => (
              <div key={index} className="bg-gray-50 p-3 rounded border">
                <div className="flex justify-between mb-1">
                  <span className="font-medium">{factor.factor}</span>
                  <span className={`text-sm px-2 py-0.5 rounded ${
                    factor.impact.includes('High') ? 'bg-red-100 text-red-700' :
                    factor.impact.includes('Medium') ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>{factor.impact}</span>
                </div>
                <p className="text-sm text-gray-600">{factor.description}</p>
              </div>
            ))}
          </div>
        </div>
        
        {/* Material information (if available) */}
        {estimateResult.materialInfo && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">{formData.desiredRoofMaterial.charAt(0).toUpperCase() + formData.desiredRoofMaterial.slice(1)} Roof Details</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="mb-2">
                <span className="font-medium">Expected Lifespan: </span>
                <span>{estimateResult.materialInfo.lifespan}</span>
              </div>
              
              <div className="mb-3">
                <div className="font-medium mb-1">Advantages:</div>
                <ul className="text-sm space-y-1">
                  {estimateResult.materialInfo.pros.map((pro, index) => (
                    <li key={index} className="flex items-start">
                      <Check size={16} className="text-green-500 mr-1 mt-0.5" />
                      <span>{pro}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <div className="font-medium mb-1">Considerations:</div>
                <ul className="text-sm space-y-1">
                  {estimateResult.materialInfo.cons.map((con, index) => (
                    <li key={index} className="flex items-start">
                      <ArrowDown size={16} className="text-orange-500 mr-1 mt-0.5" />
                      <span>{con}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
        
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Note:</span> This is an AI-generated estimate based on satellite imagery, 
            regional pricing data, and your selections. Final pricing may vary based on a professional on-site 
            inspection. Fill out your contact details to receive a detailed report and connect with local 
            professional roofers.
          </p>
        </div>
        
        <div className="flex w-full justify-between">
          <button 
            onClick={prevStep} 
            className="bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 flex items-center"
          >
            <ChevronLeft size={16} className="mr-1" /> Back
          </button>
          <button 
            onClick={nextStep} 
            className="bg-primary-600 text-white py-2 px-8 rounded-lg hover:bg-primary-700 flex items-center"
          >
            Continue <ChevronRight size={16} className="ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default EstimateResultStep;
