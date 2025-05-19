// src/App.js
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import EstimateForm from './components/EstimateForm';
import ThankYouPage from './components/ThankYouPage';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

// Removed duplicate CSS imports to avoid conflicts

function App() {
  useEffect(() => {
    // Check for map API availability - fix for ESLint 'google' is not defined
    window.mapApiStatus = {
      leaflet: typeof window.L !== 'undefined',
      googleMaps: typeof window.google !== 'undefined' && 
                 typeof window.google !== 'undefined' && 
                 typeof window.google.maps !== 'undefined'
    };
    
    console.log('Map API availability:', window.mapApiStatus);
    
    // Register service worker for PWA functionality
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
          .then(registration => {
            console.log('Service Worker registered with scope:', registration.scope);
          }).catch(error => {
            console.log('Service Worker registration failed:', error);
          });
      });
    }
  }, []);

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<EstimateForm />} />
          <Route path="/thank-you" element={<ThankYouPage />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
