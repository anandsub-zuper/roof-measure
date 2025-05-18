// EstimateForm.js - Fixed version

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
  
  // Update form data
  const updateFormData = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);
  
  // Define steps array early - before it's used in other functions
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
  
  // Navigate to next step
  const nextStep = useCallback(async () => {
    // Special handling for certain steps
    if (currentStep === 0 && formData.address) {
      setIsLoading(true);
      try {
        // Get coordinates from address
        const addressData = await apiService.getAddressCoordinates(formData.address);
        
        // Update form with coordinates and address components
        if (addressData && addressData.data) {
          updateFormData('lat', addressData.data.lat);
          updateFormData('lng', addressData.data.lng);
          updateFormData('city', addressData.data.city || '');
          updateFormData('state', addressData.data.state || '');
          updateFormData('zipCode', addressData.data.zipCode || '');
        }
        
        // Estimate roof size if coordinates are available
        if (addressData && addressData.data && addressData.data.lat && addressData.data.lng) {
          const roofSizeData = await apiService.getRoofSizeEstimate(
            addressData.data.lat, 
            addressData.data.lng
          );
          
          if (roofSizeData && roofSizeData.data) {
            updateFormData('roofSize', roofSizeData.data.size || 3000);
          }
        }
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
        const estimateResponse = await apiService.generateRoofEstimate(formData);
        if (estimateResponse && estimateResponse.data) {
          setEstimateResult(estimateResponse.data);
        }
      } catch (error) {
        console.error("Error generating estimate:", error);
        alert("There was an error generating your estimate. Please try again.");
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
    }
    
    // Move to next step
    setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
  }, [currentStep, formData, updateFormData, steps.length]);
  
  // Navigate to previous step
  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }, []);
  
  // Submit form
  const handleSubmit = useCallback(async () => {
    setIsLoading(true);
    try {
      await apiService.submitEstimate({
        ...formData,
        estimateResult
      });
      navigate('/thank-you');
    } catch (error) {
      console.error("Error submitting form:", error);
      alert("There was an error submitting your information. Please try again.");
      setIsLoading(false);
    }
  }, [formData, estimateResult, navigate]);
  
  // Test API connection on component mount
  useEffect(() => {
    const testApi = async () => {
      try {
        await apiService.testApiConnection();
        console.log("API connection successful!");
      } catch (error) {
        console.error("API connection failed:", error);
      }
    };
    
    testApi();
  }, []);
  
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
