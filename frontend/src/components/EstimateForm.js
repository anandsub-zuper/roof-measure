// src/components/EstimateForm.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import killSwitch from '../killSwitch';
import propertyDataService from '../services/propertyDataService';
import propertyPolygonGenerator from '../utils/propertyPolygonGenerator';

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
    initialRoofSize: '', // Keep original API value for reference
    roofPolygon: null, // Store the polygon coordinates from the backend
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
  // with improved roof size calculation
  const getAddressDetails = useCallback(async () => {
    if (!formData.address) return;
    
    console.log("🔍 Starting address processing for:", formData.address);
    
    // Set a timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timed out')), 15000);
    });
    
    setIsLoading(true);
    
    try {
      // First get property data from Rentcast API
      console.log("🔍 Calling propertyDataService.getPropertyDetails");
      let propertyData = null;
      try {
        propertyData = await propertyDataService.getPropertyDetails(formData.address);
        console.log("🔍 Retrieved property data:", JSON.stringify(propertyData, null, 2));
        
        if (propertyData) {
          console.log("🔍 Property Type:", propertyData.propertyType);
          console.log("🔍 Building Size:", propertyData.buildingSize);
          console.log("🔍 Stories:", propertyData.stories);
        }
        
        // Store property data in form state
        updateFormData('propertyData', propertyData);
      } catch (propertyError) {
        console.error("🔍 Error fetching property data:", propertyError);
        // Continue without property data - not critical
      }
      
      // Get coordinates from address - pass property data if available
      console.log("🔍 Getting coordinates for address:", formData.address);
      
      // Wrap the geocoding API call with a race against the timeout
      const response = await Promise.race([
        apiService.getAddressCoordinates(formData.address, propertyData),
        timeoutPromise
      ]);
      
      console.log("🔍 Geocoding API response:", response);
      
      if (response) {
        // Extract the actual data, handling different response structures
        const data = response.data || response;
        
        // Check if we have lat/lng in the response
        const lat = parseFloat(data.lat);
        const lng = parseFloat(data.lng);
        
        console.log("🔍 Extracted coordinates:", { lat, lng });
        
        if (!isNaN(lat) && !isNaN(lng)) {
          // Update form with coordinates and address components
          updateFormData('lat', lat);
          updateFormData('lng', lng);
          updateFormData('city', data.city || '');
          updateFormData('state', data.state || '');
          updateFormData('zipCode', data.zipCode || '');
          
          // *** IMPROVED ROOF SIZE CALCULATION ***
          // Calculate roof size based on property data first (most accurate)
          if (propertyData && propertyData.buildingSize) {
            console.log("🔍 Using property data for primary roof size calculation");
            
            // Use improved calculation from propertyPolygonGenerator
            const calculatedRoofSize = propertyPolygonGenerator.calculateRoofSizeFromBuildingSize(
              propertyData.buildingSize, 
              propertyData
            );
            
            if (calculatedRoofSize) {
              console.log("🔍 Calculated roof size from property data:", calculatedRoofSize);
              updateFormData('roofSize', calculatedRoofSize);
              updateFormData('initialRoofSize', calculatedRoofSize);
              updateFormData('sizingMethod', 'property_calculation');
              
              // We'll still get the backend roof size, but use our calculated size as primary
              try {
                console.log("🔍 Getting secondary roof size from API for reference");
                
                const roofSizeData = await Promise.race([
                  apiService.getRoofSizeEstimate(lat, lng, propertyData),
                  timeoutPromise
                ]);
                
                if (roofSizeData) {
                  const sizeData = roofSizeData.data || roofSizeData;
                  if (sizeData.roofPolygon && Array.isArray(sizeData.roofPolygon)) {
                    updateFormData('roofPolygon', sizeData.roofPolygon);
                    console.log("🔍 Saved reference polygon from API");
                  }
                }
              } catch (apiSizeError) {
                console.log("🔍 API roof size request failed, using property calculation only");
              }
            } else {
              // Fall back to API method if property calculation fails
              fallbackToApiRoofSize(lat, lng, propertyData);
            }
          } else {
            // No property data, use API method
            fallbackToApiRoofSize(lat, lng, propertyData);
          }
        } else {
          console.error("🔍 Invalid coordinates in response:", { lat, lng });
          // Use fallback coordinates
          updateFormData('lat', 47.6162);
          updateFormData('lng', -122.0355);
          updateFormData('roofSize', 3000);
          updateFormData('initialRoofSize', 3000);
          alert("Could not determine the exact location coordinates. Using approximate location.");
        }
      } else {
        console.error("🔍 Invalid geocoding response format");
        // Use fallback coordinates
        updateFormData('lat', 47.6162);
        updateFormData('lng', -122.0355);
        updateFormData('roofSize', 3000);
        updateFormData('initialRoofSize', 3000);
        alert("Error processing address. Using default location data.");
      }
    } catch (error) {
      console.error("🔍 Error in address processing:", error);
      
      // Handle timeout specifically
      if (error.message === 'Operation timed out') {
        console.warn("🔍 Operation timed out - using fallback data");
      }
      
      // Use fallback values
      updateFormData('lat', 47.6162);
      updateFormData('lng', -122.0355);
      updateFormData('roofSize', 3000);
      updateFormData('initialRoofSize', 3000);
      
      alert("There was an error processing your address. Using default location data.");
    } finally {
      console.log("🔍 Address processing completed");
      setIsLoading(false);
    }
  }, [formData.address, updateFormData]);

  // Helper function for API-based roof size calculation
  const fallbackToApiRoofSize = async (lat, lng, propertyData) => {
    try {
      console.log("🔍 Getting roof size from API (fallback method)");
      
      const roofSizeData = await apiService.getRoofSizeEstimate(lat, lng, propertyData);
      
      if (roofSizeData) {
        // Extract size data
        const sizeData = roofSizeData.data || roofSizeData;
        
        // Get roof size and polygon from API
        const roofSize = parseInt(sizeData.size || 0, 10);
        if (!isNaN(roofSize) && roofSize > 0) {
          console.log("🔍 Setting roof size from API:", roofSize);
          updateFormData('roofSize', roofSize);
          updateFormData('initialRoofSize', roofSize);
          updateFormData('sizingMethod', 'api_calculation');
        } else {
          console.log("🔍 Invalid roof size from API, using default");
          updateFormData('roofSize', 3000);
          updateFormData('initialRoofSize', 3000);
          updateFormData('sizingMethod', 'default_fallback');
        }
        
        // Store the roof polygon if available
        if (sizeData.roofPolygon && Array.isArray(sizeData.roofPolygon)) {
          console.log("🔍 Received roof polygon from API");
          updateFormData('roofPolygon', sizeData.roofPolygon);
        }
      } else {
        console.log("🔍 No roof size data, using default");
        updateFormData('roofSize', 3000);
        updateFormData('initialRoofSize', 3000);
        updateFormData('sizingMethod', 'default_fallback');
      }
    } catch (error) {
      console.error("🔍 Error getting roof size from API:", error);
      updateFormData('roofSize', 3000);
      updateFormData('initialRoofSize', 3000);
      updateFormData('sizingMethod', 'default_fallback');
    }
  };
  
  // Generate estimate
  const generateEstimate = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiService.generateRoofEstimate(formData);
      console.log("Estimate API response:", response);
      
      if (response) {
        // Handle different response structures
        const estimateData = response.data || response;
        setEstimateResult(estimateData);
      } else {
        throw new Error("Failed to generate estimate - empty response");
      }
    } catch (error) {
      console.error("Error generating estimate:", error);
      alert("There was an error generating your estimate. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [formData]);
  
  const nextStep = useCallback(async () => {
    try {
      // Add a timeout for any async operations to ensure we don't freeze
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Operation timed out")), 20000)
      );
      
      // Special handling for certain steps
      if (currentStep === 0) {
        // Address step - get coordinates and roof size
        await Promise.race([getAddressDetails(), timeoutPromise]);
      } else if (currentStep === 7) {
        // Financing step - generate estimate
        await Promise.race([generateEstimate(), timeoutPromise]);
      }
      
      // Proceed to next step
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    } catch (error) {
      console.error("Error in nextStep:", error);
      
      // Handle specific errors
      if (error.message === "Operation timed out") {
        alert("The operation took too long to complete. Please try again.");
      } else {
        alert("There was an error processing your request. Please try again.");
      }
      
      setIsLoading(false);
    }
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
      
      console.log("Form submission response:", response);
      
      if (response && (response.success || response.reference)) {
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
  
  // Debug formData changes
  useEffect(() => {
    console.log("FormData updated:", {
      address: formData.address,
      lat: formData.lat,
      lng: formData.lng,
      roofSize: formData.roofSize,
      sizingMethod: formData.sizingMethod,
      propertyData: formData.propertyData ? {
        type: formData.propertyData.propertyType,
        size: formData.propertyData.buildingSize,
        stories: formData.propertyData.stories
      } : "None"
    });
  }, [formData.address, formData.lat, formData.lng, formData.roofSize, 
      formData.sizingMethod, formData.propertyData]);
  
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
              <span className="text-sm font-medium mr-2">Step {currentStep + 1}/{steps.length - 1}</span>
              <div className="w-20 h-2 bg-gray-200 rounded-full">
                <div 
                  className="h-full bg-primary-600 rounded-full" 
                  style={{width: `${((currentStep + 1) / (steps.length - 1)) * 100}%`}}
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
