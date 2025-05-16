// src/components/steps/ContactInfoStep.js
import React, { useState } from 'react';
import { Calculator, ChevronLeft, User, Mail, Phone, Check } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

const ContactInfoStep = ({ formData, updateFormData, prevStep, handleSubmit, isLoading, estimateResult }) => {
  const [errors, setErrors] = useState({});
  
  // Validate form fields
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name || formData.name.trim() === '') {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.email || formData.email.trim() === '') {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!formData.phone || formData.phone.trim() === '') {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/.test(formData.phone)) {
      newErrors.phone = 'Phone number is invalid';
    }
    
    if (!formData.termsAgreed) {
      newErrors.termsAgreed = 'You must agree to the terms';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle form submission
  const onSubmit = (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      handleSubmit();
    }
  };
  
  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-2">Get Your Detailed Estimate Report</h2>
      <p className="text-sm text-gray-600 mb-6">We'll email you the detailed report and connect you with verified roofers</p>
      
      <div className="w-full bg-white p-6 rounded-lg shadow-lg mb-6">
        <form onSubmit={onSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Your Name*</label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateFormData('name', e.target.value)}
                placeholder="Full Name"
                className={`w-full p-3 pl-10 border ${errors.name ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-primary-300 focus:border-primary-500 focus:outline-none`}
              />
            </div>
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Email Address*</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => updateFormData('email', e.target.value)}
                placeholder="your@email.com"
                className={`w-full p-3 pl-10 border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-primary-300 focus:border-primary-500 focus:outline-none`}
              />
            </div>
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-medium mb-1">Phone Number*</label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => updateFormData('phone', e.target.value)}
                placeholder="(123) 456-7890"
                className={`w-full p-3 pl-10 border ${errors.phone ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-primary-300 focus:border-primary-500 focus:outline-none`}
              />
            </div>
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
          </div>
          
          <div className="mb-6">
            <label className={`flex items-start ${errors.termsAgreed ? 'text-red-500' : 'text-gray-700'}`}>
              <input
                type="checkbox"
                checked={formData.termsAgreed}
                onChange={(e) => updateFormData('termsAgreed', e.target.checked)}
                className={`mt-1 mr-2 h-4 w-4 ${errors.termsAgreed ? 'border-red-500' : 'border-gray-300'}`}
              />
              <span className="text-sm">
                I agree to the <a href="#" className="text-primary-600 hover:underline">Terms of Service</a> and 
                <a href="#" className="text-primary-600 hover:underline"> Privacy Policy</a>*
              </span>
            </label>
            {errors.termsAgreed && <p className="text-red-500 text-xs mt-1">{errors.termsAgreed}</p>}
          </div>
          
          {estimateResult && (
            <div className="flex items-center justify-between bg-primary-50 p-3 rounded-lg mb-6">
              <div className="flex items-center">
                <Calculator className="text-primary-700 mr-2" size={20} />
                <div>
                  <p className="font-medium text-primary-800">Your Estimated Cost</p>
                  <p className="text-sm text-primary-600">Based on your selections</p>
                </div>
              </div>
              <div className="font-bold text-xl text-primary-800">
                {formatCurrency(estimateResult.estimate)}
              </div>
            </div>
          )}
          
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center transition-colors"
          >
            {isLoading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              <>Get My Free Detailed Report</>
            )}
          </button>
        </form>
      </div>
      
      <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600 w-full">
        <p className="mb-2">What happens next?</p>
        <ul className="space-y-2">
          <li className="flex">
            <Check size={16} className="text-green-500 mr-2 mt-0.5 flex-shrink-0" />
            <span>You'll receive your detailed AI-generated estimate report via email</span>
          </li>
          <li className="flex">
            <Check size={16} className="text-green-500 mr-2 mt-0.5 flex-shrink-0" />
            <span>We'll connect you with 2-3 top-rated local roofers who can provide official quotes</span>
          </li>
          <li className="flex">
            <Check size={16} className="text-green-500 mr-2 mt-0.5 flex-shrink-0" />
            <span>You can compare offers and choose the best option for your needs</span>
          </li>
        </ul>
      </div>
      
      <div className="w-full mt-6">
        <button 
          onClick={prevStep} 
          className="bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 flex items-center"
        >
          <ChevronLeft size={16} className="mr-1" /> Back
        </button>
      </div>
    </div>
  );
};

export default ContactInfoStep;
