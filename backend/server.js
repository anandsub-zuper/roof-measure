// server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const errorHandler = require('./middleware/errorHandler');
const { logInfo, logError } = require('./utils/logger');

// Process-level error handling
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥');
  console.error('Error name:', err.name);
  console.error('Error message:', err.message);
  console.error('Stack trace:', err.stack);
  // Don't exit immediately in production to allow logging
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Load environment variables
console.log('Loading environment variables...');
dotenv.config();

// Check for required files before initializing
console.log('Checking for required files...');
const requiredFiles = [
  './routes/estimateRoutes.js',
  './routes/googleMapsRoutes.js',
  './routes/api.js',
  './routes/metricsRoutes.js',
  './routes/roofAnalysisRoutes.js',
  './services/openAIVisionService.js',
];

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    console.log(`✓ ${file} exists`);
  } catch (err) {
    console.error(`✗ ${file} is missing or inaccessible`);
  }
});

// Initialize express app
console.log('Initializing Express app...');
const app = express();
const PORT = process.env.PORT || 5000;

// CORS Configuration
const allowedOrigins = [
  'https://roof-measure.netlify.app',
  'http://localhost:3000'
];

const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logInfo('CORS blocked request from', { origin });
      callback(null, false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // 24 hours
};

// Security and utility middleware
console.log('Setting up middleware...');
app.use(helmet()); // Security headers
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' })); // Parse JSON requests with size limit
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(morgan('dev')); // Request logging

// Add request timestamp
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// Early diagnostic endpoint to check if the server is running
app.get('/api/serverinfo', (req, res) => {
  res.json({
    status: 'running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    hasOpenAiKey: !!process.env.OPENAI_API_KEY,
    hasGoogleMapsKey: !!process.env.GOOGLE_MAPS_API_KEY
  });
});

// Import and use routes with error handling
console.log('Loading routes...');

// Load core routes first
let estimateRoutes, googleMapsRoutes, apiRoutes;

try {
  estimateRoutes = require('./routes/estimateRoutes');
  googleMapsRoutes = require('./routes/googleMapsRoutes');
  apiRoutes = require('./routes/api');
  console.log('✓ Core routes loaded successfully');
} catch (error) {
  console.error('ERROR LOADING CORE ROUTES:', error);
  process.exit(1); // Exit if core routes can't be loaded
}

// Use core routes
app.use('/api/estimates', estimateRoutes);
app.use('/api/maps', googleMapsRoutes);
app.use('/api', apiRoutes);

// Load and use metrics routes
let metricsRoutes;
try {
  metricsRoutes = require('./routes/metricsRoutes');
  app.use('/api/metrics', metricsRoutes);
  console.log('✓ Metrics routes loaded successfully');
} catch (error) {
  console.error('ERROR LOADING METRICS ROUTES:', error.message);
  // Create a stub router for metrics
  metricsRoutes = express.Router();
  metricsRoutes.post('/log', (req, res) => {
    console.log('Metrics logging stub:', req.body);
    res.status(200).json({ success: true, message: 'Metrics logging stub' });
  });
  app.use('/api/metrics', metricsRoutes);
  console.log('✓ Created stub for metrics routes');
}

// Load and use roof analysis routes
let roofAnalysisRoutes;
try {
  roofAnalysisRoutes = require('./routes/roofAnalysisRoutes');
  app.use('/api/roof', roofAnalysisRoutes);
  console.log('✓ Roof analysis routes loaded successfully');
} catch (error) {
  console.error('ERROR LOADING ROOF ANALYSIS ROUTES:', error.message);
  console.error(error.stack);
  
  // Create a stub router for roof analysis
  roofAnalysisRoutes = express.Router();
  roofAnalysisRoutes.post('/analyze', (req, res) => {
    const { lat, lng, propertyData } = req.body;
    
    // Generate a fallback response
    const response = {
      success: true,
      message: 'Roof analysis service temporarily using fallback calculation',
      data: {
        roofArea: propertyData?.buildingSize || 3000,
        confidence: "medium",
        roofShape: "simple",
        estimatedPitch: "moderate",
        method: "fallback_calculation",
        notes: "Generated using fallback calculation due to service loading error"
      }
    };
    
    res.status(200).json(response);
  });
  
  app.use('/api/roof', roofAnalysisRoutes);
  console.log('✓ Created stub for roof analysis routes');
}

// Comprehensive diagnostic endpoint
app.get('/api/diagnostic', (req, res) => {
  try {
    // List all registered routes
    const routes = [];
    app._router.stack.forEach(middleware => {
      if(middleware.route) { // routes registered directly on the app
        routes.push(`${Object.keys(middleware.route.methods)[0].toUpperCase()} ${middleware.route.path}`);
      } else if(middleware.name === 'router') { // router middleware 
        middleware.handle.stack.forEach(handler => {
          if(handler.route) {
            const method = Object.keys(handler.route.methods)[0].toUpperCase();
            let path = handler.route.path;
            if (middleware.regexp) {
              const middlewarePath = middleware.regexp.toString()
                .replace('/^\\', '')
                .replace('\\/?(?=\\/|$)/i', '');
              path = middlewarePath.replace(/\\\//g, '/') + path;
            }
            routes.push(`${method} ${path}`);
          }
        });
      }
    });
    
    // Check for modules
    const modules = {};
    try { modules.openAIVisionService = !!require('./services/openAIVisionService'); } 
    catch (e) { modules.openAIVisionService = false; }
    
    try { modules.roofAnalysisController = !!require('./controllers/roofAnalysisController'); } 
    catch (e) { modules.roofAnalysisController = false; }
    
    // Check environment vars (excluding sensitive data)
    const env = {
      NODE_ENV: process.env.NODE_ENV,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasGoogleMapsKey: !!process.env.GOOGLE_MAPS_API_KEY,
    };
    
    res.json({
      status: 'success',
      message: 'Diagnostic completed successfully',
      routes: routes,
      modules: modules,
      environment: env,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Diagnostic error',
      error: error.message,
      stack: error.stack
    });
  }
});

// Simple health check route
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'RoofAI API is running',
    timestamp: req.requestTime,
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Handle 404 routes
app.use((req, res, next) => {
  res.status(404).json({
    status: 'error',
    message: `Route not found: ${req.originalUrl}`
  });
});

// Global error handler
app.use(errorHandler);

// Start server
console.log(`Starting server on port ${PORT}...`);
app.listen(PORT, () => {
  logInfo(`Server running on port ${PORT}`);
  console.log(`✓ Server running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥');
  console.error(err.name, err.message);
  console.error(err.stack);
  
  // In production, log but don't exit
  if (process.env.NODE_ENV !== 'production') {
    // server.close(() => process.exit(1));
  }
});

module.exports = app; // For testing
