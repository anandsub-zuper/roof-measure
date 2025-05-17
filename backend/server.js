const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const errorHandler = require('./middleware/errorHandler');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const PORT = process.env.PORT || 5000;

// Security and utility middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000', 
  credentials: true
}));
app.use(express.json()); // Parse JSON requests
app.use(morgan('dev')); // Request logging

// Import routes
const estimateRoutes = require('./routes/estimateRoutes');
const googleMapsRoutes = require('./routes/googleMapsRoutes');

// Use routes
app.use('/api/estimates', estimateRoutes);
app.use('/api/maps', googleMapsRoutes);

// Simple health check route
app.get('/', (req, res) => {
  res.json({ status: 'RoofAI API is running' });
});

// Global error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
