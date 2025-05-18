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

// Import API service
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
  
  // Define steps array
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
  
  // Update form data
  const updateFormData = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);
  
  // Special handling for address step - get coordinates and roof size
  const getAddressDetails = useCallback(async () => {
    if (!formData.address) return;
    
    setIsLoading(true);
    try {
      // Get coordinates from address
      const addressData = await apiService.getAddressCoordinates(formData.address);
      
      if (addressData && addressData.success) {
        // Update form with coordinates and address components
        updateFormData('lat', addressData.lat);
        updateFormData('lng', addressData.lng);
        updateFormData('city', addressData.city || '');
        updateFormData('state', addressData.state || '');
        updateFormData('zipCode', addressData.zipCode || '');
        
        // Get roof size if coordinates are available
        if (addressData.lat && addressData.lng) {
          try {
            const roofSizeData = await apiService.getRoofSizeEstimate(
              addressData.lat, 
              addressData.lng
            );
            
            if (roofSizeData && roofSizeData.success) {
              updateFormData('roofSize', roofSizeData.size || 3000);
            }
          } catch (sizeError) {
            console.error("Error getting roof size:", sizeError);
            // Use default roof size
            updateFormData('roofSize', 3000);
          }
        }
      } else {
        throw new Error("Failed to get address coordinates");
      }
    } catch (error) {
      console.error("Error processing address:", error);
      alert("There was an error processing your address. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [formData.address, updateFormData]);
  
  // Generate estimate
  const generateEstimate = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiService.generateRoofEstimate(formData);
      
      if (response && response.success) {
        setEstimateResult(response.data || response);
      } else {
        throw new Error("Failed to generate estimate");
      }
    } catch (error) {
      console.error("Error generating estimate:", error);
      alert("There was an error generating your estimate. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [formData]);
  
  // Navigate to next step
  const nextStep = useCallback(async () => {
    // Special handling for certain steps
    if (currentStep === 0) {
      // Address step - get coordinates and roof size
      await getAddressDetails();
    } else if (currentStep === 7) {
      // Financing step - generate estimate
      await generateEstimate();
    }
    
    // Proceed to next step
    setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
  }, [currentStep, getAddressDetails, generateEstimate, steps.length]);
  
  // Navigate to previous step
  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }, []);
  
  // Submit form
  const handleSubmit = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiService.submitEstimate({
        ...formData,
        estimateResult
      });
      
      if (response && response.success) {
        navigate('/thank-you');
      } else {
        throw new Error("Failed to submit estimate");
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      alert("There was an error submitting your information. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [formData, estimateResult, navigate]);
  
  // Test API connection on component mount
  useEffect(() => {
    apiService.testApiConnection()
      .then(() => console.log("API connection successful"))
      .catch(error => console.error("API connection failed:", error));
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
