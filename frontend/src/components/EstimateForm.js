// src/components/EstimateForm.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';

// Import step components
import AddressStep from './steps/AddressStep';
import RoofSizeStep from './steps/RoofSizeStep';
import RoofSteepnessStep from './steps/RoofSteepnessStep';
import BuildingTypeStep from './steps/BuildingTypeStep';
import CurrentRoofMaterialStep from './steps/CurrentRoofMaterialStep';
import DesiredRoofMaterialStep from './steps/DesiredRoofMaterialStep';
import TimelineStep from './steps/TimelineStep';
import FinancingStep from './steps/FinancingStep';
import EstimateResultStep from './steps/EstimateResultStep';
import ContactInfoStep from './steps/ContactInfoStep';

// Import services
import apiService from '../services/apiService';
import googleMapsService from '../services/googleMapsService';
import openAIService from '../services/openAIService';

const EstimateForm = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [estimateResult, setEstimateResult] = useState(null);
  
  // Form data state
  const [formData, setFormData] = useState({
    address: '',
    city: '',
    state: '',
    zipCode: '',
    lat: null,
    lng: null,
    roofSize: '',
    roofSizeAuto: true,
    roofSteepness: '',
    buildingType: '',
    currentRoofMaterial: '',
    desiredRoofMaterial: '',
    timeline: '',
    financing: '',
    additionalDetails: '',
    name: '',
    email: '',
    phone: '',
    termsAgreed: false
  });
  
  // Initialize Google Maps API
  useEffect(() => {
    googleMapsService.loadGoogleMapsScript(() => {
      console.log('Google Maps API loaded');
    });
  }, []);
  
  // Update form data
  const updateFormData = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);
  
  // Navigate to next step
  const nextStep = useCallback(async () => {
    // Special handling for certain steps
    if (currentStep === 0 && formData.address) {
      setIsLoading(true);
      try {
        // Get coordinates from address
        const coords = await googleMapsService.getAddressCoordinates(formData.address);
        
        // In a real app, this would use the Google Geocoding API response
        // Parse address components manually for now
        const addressParts = formData.address.split(',');
        const state = addressParts.length > 1 ? addressParts[addressParts.length - 2].trim().split(' ')[0] : '';
        const zipCode = addressParts.length > 1 ? addressParts[addressParts.length - 2].trim().split(' ')[1] : '';
        const city = addressParts.length > 2 ? addressParts[addressParts.length - 3].trim() : '';
        
        updateFormData('lat', coords.lat);
        updateFormData('lng', coords.lng);
        updateFormData('city', city);
        updateFormData('state', state);
        updateFormData('zipCode', zipCode);
        
        // Automatically estimate roof size from satellite imagery
        const roofSize = await googleMapsService.getRoofSizeEstimate(coords.lat, coords.lng);
        updateFormData('roofSize', roofSize);
      } catch (error) {
        console.error("Error processing address:", error);
        alert("There was an error processing your address. Please try again.");
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
    }
    
    // When reaching the estimate step, generate the estimate
    if (currentStep === 7) {
      setIsLoading(true);
      try {
        const estimate = await openAIService.generateRoofEstimate(formData);
        setEstimateResult(estimate);
      } catch (error) {
        console.error("Error generating estimate:", error);
        alert("There was an error generating your estimate. Please try again.");
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
    }
    
    setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
  }, [currentStep, formData, updateFormData, steps.length]);
  
  // Navigate to previous step
  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }, []);
  
  // Submit form
  const handleSubmit = useCallback(() => {
    // In a real app, this would send the data to a server
    // Navigate to thank you page
    navigate('/thank-you');
  }, [navigate]);
  
  // Define all form steps
  const steps = [
    { component: AddressStep, title: 'Your Address' },
    { component: RoofSizeStep, title: 'Roof Size' },
    { component: RoofSteepnessStep, title: 'Roof Steepness' },
    { component: BuildingTypeStep, title: 'Building Type' },
    { component: CurrentRoofMaterialStep, title: 'Current Roofing' },
    { component: DesiredRoofMaterialStep, title: 'New Roofing' },
    { component: TimelineStep, title: 'Timeline' },
    { component: FinancingStep, title: 'Financing' },
    { component: EstimateResultStep, title: 'Your Estimate' },
    { component: ContactInfoStep, title: 'Contact Info' }
  ];
  
  // Get current step component
  const CurrentStepComponent = steps[currentStep].component;
  
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-8 h-8 text-primary-600">
              <Home size={32} />
            </div>
            <div className="ml-2 font-bold text-lg text-gray-800">RoofAI</div>
          </div>
          
          {currentStep < steps.length - 1 && (
            <div className="flex items-center">
              <span className="text-sm font-medium mr-2">Step {currentStep + 1}/{steps.length}</span>
              <div className="w-20 h-2 bg-gray-200 rounded-full">
                <div 
                  className="h-full bg-primary-600 rounded-full" 
                  style={{width: `${((currentStep + 1) / steps.length) * 100}%`}}
                ></div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Form Content */}
      <main className="flex-grow flex items-start justify-center p-4 md:p-8">
        <CurrentStepComponent 
          formData={formData}
          updateFormData={updateFormData}
          nextStep={nextStep}
          prevStep={prevStep}
          handleSubmit={handleSubmit}
          isLoading={isLoading}
          estimateResult={estimateResult}
        />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t p-4">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-gray-600 mb-2 md:mb-0">
            Powered by AI • Satellite Data • Local Market Analysis
          </p>
          <div className="flex space-x-4">
          <a href="/privacy" className="text-sm text-gray-600 hover:text-primary-600">Privacy Policy</a>
          <a href="/terms" className="text-sm text-gray-600 hover:text-primary-600">Terms of Service</a>
          <a href="/contact" className="text-sm text-gray-600 hover:text-primary-600">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default EstimateForm;
