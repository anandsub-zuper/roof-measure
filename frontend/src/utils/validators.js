// src/utils/validators.js
/**
 * Form validation utility functions
 */

/**
 * Validates an email address
 * @param {string} email - The email to validate
 * @returns {boolean} True if email is valid
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates a US phone number
 * @param {string} phone - The phone number to validate
 * @returns {boolean} True if phone number is valid
 */
export const isValidPhone = (phone) => {
  // Allow formats: (123) 456-7890, 123-456-7890, 123.456.7890, 1234567890
  const phoneRegex = /^(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;
  return phoneRegex.test(phone);
};

/**
 * Validates a US address
 * @param {string} address - The address to validate
 * @returns {boolean} True if address seems valid (basic validation)
 */
export const isValidAddress = (address) => {
  // Basic validation: at least 5 characters containing digits (street number)
  return address.length > 5 && /\d/.test(address);
};

/**
 * Validates that a value is not empty
 * @param {string} value - The value to check
 * @returns {boolean} True if the value is not empty
 */
export const isNotEmpty = (value) => {
  return value.trim().length > 0;
};

/**
 * Validates a number is within range
 * @param {number} value - The value to check
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {boolean} True if the value is within range
 */
export const isWithinRange = (value, min, max) => {
  const numValue = Number(value);
  return !isNaN(numValue) && numValue >= min && numValue <= max;
};

/**
 * Validates form data against specified rules
 * @param {Object} data - The form data to validate
 * @param {Object} rules - Validation rules
 * @returns {Object} Object with errors for invalid fields
 */
export const validateForm = (data, rules) => {
  const errors = {};
  
  // Process each field with its rule
  Object.entries(rules).forEach(([field, rule]) => {
    // Skip fields that don't exist in data
    if (!(field in data)) return;
    
    const value = data[field];
    
    // Required field validation
    if (rule.required && !isNotEmpty(value.toString())) {
      errors[field] = rule.message || `${field} is required`;
      return; // Skip other validations if required check fails
    }
    
    // Email validation
    if (rule.email && value && !isValidEmail(value)) {
      errors[field] = rule.message || 'Please enter a valid email address';
    }
    
    // Phone validation
    if (rule.phone && value && !isValidPhone(value)) {
      errors[field] = rule.message || 'Please enter a valid phone number';
    }
    
    // Address validation
    if (rule.address && value && !isValidAddress(value)) {
      errors[field] = rule.message || 'Please enter a valid address';
    }
    
    // Min length validation
    if (rule.minLength && value.length < rule.minLength) {
      errors[field] = rule.message || `Must be at least ${rule.minLength} characters`;
    }
    
    // Max length validation
    if (rule.maxLength && value.length > rule.maxLength) {
      errors[field] = rule.message || `Cannot exceed ${rule.maxLength} characters`;
    }
    
    // Range validation
    if (rule.min !== undefined && rule.max !== undefined) {
      if (!isWithinRange(value, rule.min, rule.max)) {
        errors[field] = rule.message || `Must be between ${rule.min} and ${rule.max}`;
      }
    }
    
    // Custom validation function
    if (rule.validate && typeof rule.validate === 'function') {
      const isValid = rule.validate(value, data);
      if (!isValid) {
        errors[field] = rule.message || `${field} is invalid`;
      }
    }
  });
  
  return errors;
};

export default {
  isValidEmail,
  isValidPhone,
  isValidAddress,
  isNotEmpty,
  isWithinRange,
  validateForm
};
