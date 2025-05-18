// backend/scripts/serviceCheck.js
const path = require('path');
const fs = require('fs');

// Check if OpenAI Vision service exists
console.log('Checking if openAIVisionService.js exists...');

// Path to the service file - adjusted based on your folder structure
const servicePath = path.join(__dirname, '..', 'services', 'openAIVisionService.js');
console.log('Looking for file at:', servicePath);

if (fs.existsSync(servicePath)) {
  console.log('✅ openAIVisionService.js exists at', servicePath);
  
  // Try to load the service
  try {
    const openAIVisionService = require('../services/openAIVisionService');
    console.log('✅ Successfully loaded openAIVisionService module');
    
    // Check for required functions
    const requiredFunctions = ['analyzeRoof', 'calculateRoofSizeFromProperty'];
    const missingFunctions = requiredFunctions.filter(func => typeof openAIVisionService[func] !== 'function');
    
    if (missingFunctions.length > 0) {
      console.error('❌ Missing required functions in openAIVisionService:', missingFunctions.join(', '));
    } else {
      console.log('✅ All required functions exist in openAIVisionService');
    }
    
  } catch (error) {
    console.error('❌ Error loading openAIVisionService:', error.message);
    console.error(error.stack);
  }
} else {
  console.error('❌ openAIVisionService.js does not exist at', servicePath);
}

// Check environment variables
console.log('\nChecking required environment variables...');
const requiredEnvVars = ['OPENAI_API_KEY', 'GOOGLE_MAPS_API_KEY'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
} else {
  console.log('✅ All required environment variables are set');
}

console.log('\nService check completed.');
