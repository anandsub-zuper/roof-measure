// src/components/ThankYouPage.js
import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Check, Mail, Clock, Download } from 'lucide-react';

const ThankYouPage = () => {
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
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center p-4 md:p-8">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <Check size={32} className="text-green-600" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-center mb-2">Thank You!</h1>
          <p className="text-center text-gray-600 mb-8">
            Your roof estimate request has been submitted successfully.
          </p>
          
          <div className="bg-gray-50 p-4 rounded-lg mb-8">
            <h2 className="font-medium mb-4">What happens next?</h2>
            <ul className="space-y-4">
              <li className="flex">
                <Mail className="text-primary-600 mr-3 flex-shrink-0" size={20} />
                <div>
                  <p className="font-medium">Check your email</p>
                  <p className="text-sm text-gray-600">We've sent your detailed estimate report to your email address.</p>
                </div>
              </li>
              <li className="flex">
                <Clock className="text-primary-600 mr-3 flex-shrink-0" size={20} />
                <div>
                  <p className="font-medium">Expect a call soon</p>
                  <p className="text-sm text-gray-600">A roofing professional will contact you within 24 hours to discuss your project.</p>
                </div>
              </li>
              <li className="flex">
                <Download className="text-primary-600 mr-3 flex-shrink-0" size={20} />
                <div>
                  <p className="font-medium">Save the app</p>
                  <p className="text-sm text-gray-600">Add RoofAI to your home screen for quick access to your estimate.</p>
                </div>
              </li>
            </ul>
          </div>
          
          <Link 
            to="/"
            className="block w-full bg-primary-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-primary-700 text-center transition-colors"
          >
            Start a New Estimate
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t p-4">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-gray-600 mb-2 md:mb-0">
            Powered by AI • Satellite Data • Local Market Analysis
          </p>
          <div className="flex space-x-4">
            <a href="#" className="text-sm text-gray-600 hover:text-primary-600">Privacy Policy</a>
            <a href="#" className="text-sm text-gray-600 hover:text-primary-600">Terms of Service</a>
            <a href="#" className="text-sm text-gray-600 hover:text-primary-600">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ThankYouPage;
