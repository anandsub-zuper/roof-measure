// server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const errorHandler = require('./middleware/errorHandler');
const { logInfo } = require('./utils/logger');

// Load environment variables
dotenv.config();

// Initialize express app
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
app.use(helmet()); // Security headers
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' })); // Parse JSON requests with size limit
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(morgan('dev')); // Request logging

// Import routes
const estimateRoutes = require('./routes/estimateRoutes');
const googleMapsRoutes = require('./routes/googleMapsRoutes');
const apiRoutes = require('./routes/api');

// Add request timestamp
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// Use routes
app.use('/api/estimates', estimateRoutes);
app.use('/api/maps', googleMapsRoutes);
app.use('/api', apiRoutes);
app.use('/api/metrics', require('./routes/metricsRoutes'));
app.use('/api/roof', require('./routes/roofAnalysisRoutes'));

// Simple health check route
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'RoofAI API is running',
    timestamp: req.requestTime,
    environment: process.env.NODE_ENV || 'development'
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
app.listen(PORT, () => {
  logInfo(`Server running on port ${PORT}`);
  console.log(`Server running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
  // In production, you might want to crash and let a process manager restart
  // server.close(() => process.exit(1));
});
