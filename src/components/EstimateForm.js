import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AddressStep from './steps/AddressStep';
// Import other step components...
import apiService from '../services/apiService';

const EstimateForm = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    address: '',
    // ...other form fields
  });
  const [isLoading, setIsLoading] = useState(false);
  const [estimateResult, setEstimateResult] = useState(null);
  
  // Handle form updates
  const updateFormData = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);
  
  // Go to next step
  const nextStep = useCallback(async () => {
    // Special handling for API calls at certain steps
    if (currentStep === 0) {
      setIsLoading(true);
      try {
        // Call backend for address validation and roof size
        const addressData = await apiService.getAddressCoordinates(formData.address);
        updateFormData('lat', addressData.lat);
        updateFormData('lng', addressData.lng);
        
        const roofSizeData = await apiService.getRoofSizeEstimate(addressData.lat, addressData.lng);
        updateFormData('roofSize', roofSizeData.size);
      } catch (error) {
        console.error('Error:', error);
        alert('Error processing address. Please try again.');
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
    }
    
    // Generate estimate before showing results step
    if (currentStep === 7) {
      setIsLoading(true);
      try {
        const estimate = await apiService.generateRoofEstimate(formData);
        setEstimateResult(estimate.data);
      } catch (error) {
        console.error('Error:', error);
        alert('Error generating estimate. Please try again.');
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
    }
    
    setCurrentStep(prev => Math.min(prev + 1, 9));
  }, [currentStep, formData, updateFormData]);
  
  // Handle form submission
  const handleSubmit = useCallback(async () => {
    setIsLoading(true);
    try {
      await apiService.submitEstimate({
        ...formData,
        estimateResult
      });
      navigate('/thank-you');
    } catch (error) {
      console.error('Error:', error);
      alert('Error submitting form. Please try again.');
      setIsLoading(false);
    }
  }, [formData, estimateResult, navigate]);
  
  // Form steps configuration
  const steps = [
    { component: AddressStep, title: 'Address' },
    // ...other steps configuration
  ];
  
  // Current step component
  const CurrentStepComponent = steps[currentStep].component;
  
  return (
    <div>
      {/* Header with progress bar */}
      <header>
        <div>Step {currentStep + 1} of 10</div>
        <div className="progress-bar">
          <div style={{width: `${(currentStep + 1) * 10}%`}}></div>
        </div>
      </header>
      
      {/* Main form content */}
      <main>
        <CurrentStepComponent
          formData={formData}
          updateFormData={updateFormData}
          nextStep={nextStep}
          prevStep={() => setCurrentStep(prev => Math.max(prev - 1, 0))}
          isLoading={isLoading}
          estimateResult={estimateResult}
          handleSubmit={handleSubmit}
        />
      </main>
    </div>
  );
};

export default EstimateForm;
