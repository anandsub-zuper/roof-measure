// src/utils/metricsLogger.js - New file for monitoring measurement discrepancies
import axios from 'axios';
import config from '../config';

/**
 * Log measurement discrepancy between backend and frontend
 * @param {number} backendSize - Size from backend calculation
 * @param {number} frontendSize - Size from frontend calculation
 * @param {string} address - Property address (will be anonymized)
 */
export const logMeasurementDiscrepancy = (backendSize, frontendSize, address) => {
  if (!backendSize || !frontendSize || !address) return;
  
  const ratio = frontendSize / backendSize;
  const discrepancy = Math.abs(frontendSize - backendSize);
  const percentDiff = Math.abs((frontendSize - backendSize) / backendSize) * 100;
  
  // Log to console for development
  console.log(`Measurement discrepancy: ${percentDiff.toFixed(1)}% (${discrepancy} sq ft)`);
  console.log(`Backend: ${backendSize} sq ft, Frontend: ${frontendSize} sq ft, Ratio: ${ratio.toFixed(2)}`);
  
  // Anonymize address for privacy (just keep street number)
  const anonymizedAddress = address.split(',')[0].trim();
  
  // Log to backend for monitoring
  try {
    // Only log if in production
    if (process.env.NODE_ENV === 'production') {
      axios.post(`${config.apiUrl}/api/metrics/log`, {
        type: 'measurement_discrepancy',
        backendSize,
        frontendSize,
        ratio,
        percentDiff,
        address: anonymizedAddress,
        timestamp: new Date().toISOString()
      });
    }
  } catch (e) {
    // Silent fail - metrics shouldn't affect user experience
    console.warn("Error logging metrics:", e.message);
  }
  
  // Alert threshold
  if (percentDiff > 25) {
    console.warn(`Large measurement discrepancy detected: ${percentDiff.toFixed(1)}%`);
    
    // Add to local storage for debugging
    try {
      const discrepancies = JSON.parse(localStorage.getItem('roofai_discrepancies') || '[]');
      discrepancies.push({
        backendSize,
        frontendSize,
        ratio,
        percentDiff,
        address: anonymizedAddress,
        timestamp: new Date().toISOString()
      });
      
      // Keep only the last 50 entries
      if (discrepancies.length > 50) {
        discrepancies.shift();
      }
      
      localStorage.setItem('roofai_discrepancies', JSON.stringify(discrepancies));
    } catch (e) {
      // Ignore storage errors
    }
  }
};

/**
 * Track API request timing
 * @param {string} endpoint - API endpoint
 * @param {number} duration - Request duration in ms
 */
export const trackApiTiming = (endpoint, duration) => {
  // Basic validation
  if (!endpoint || !duration) return;
  
  console.log(`API Timing: ${endpoint} - ${duration}ms`);
  
  // Log to backend in production
  if (process.env.NODE_ENV === 'production') {
    try {
      axios.post(`${config.apiUrl}/api/metrics/timing`, {
        endpoint,
        duration,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      // Silent fail
    }
  }
  
  // Alert on slow requests
  if (duration > 5000) {
    console.warn(`Slow API request: ${endpoint} - ${duration}ms`);
  }
};

/**
 * Get stored measurement discrepancies (for debugging)
 * @returns {Array} - Array of discrepancy objects
 */
export const getStoredDiscrepancies = () => {
  try {
    return JSON.parse(localStorage.getItem('roofai_discrepancies') || '[]');
  } catch (e) {
    return [];
  }
};

/**
 * Clear stored discrepancies
 */
export const clearStoredDiscrepancies = () => {
  localStorage.removeItem('roofai_discrepancies');
};

// Make functions available globally for debugging
window.logMeasurementDiscrepancy = logMeasurementDiscrepancy;
window.getStoredDiscrepancies = getStoredDiscrepancies;
window.clearStoredDiscrepancies = clearStoredDiscrepancies;

export default {
  logMeasurementDiscrepancy,
  trackApiTiming,
  getStoredDiscrepancies,
  clearStoredDiscrepancies
};
