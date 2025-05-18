// src/App.js
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import EstimateForm from './components/EstimateForm';
import ThankYouPage from './components/ThankYouPage';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

function App() {
  useEffect(() => {
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
