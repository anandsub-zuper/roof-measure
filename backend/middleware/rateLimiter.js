// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const { logWarn } = require('../utils/logger');
const apiResponse = require('../utils/apiResponse');

/**
 * Creates a rate limiter middleware with customizable options
 * 
 * @param {Object} options - Rate limiting options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum number of requests per window
 * @param {string} options.message - Message to return when rate limit is exceeded
 * @returns {Function} Express middleware function
 */
const createRateLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res, next, options) => {
      // Log rate limit exceeded
      logWarn('Rate limit exceeded', {
        ip: req.ip,
        url: req.originalUrl,
        method: req.method,
        headers: req.headers
      });
      
      // Return standardized error response
      const response = apiResponse.error(
        options.message || 'Too many requests, please try again later.',
        null,
        429
      );
      res.status(429).json(response);
    }
  };

  // Merge default options with provided options
  const mergedOptions = { ...defaultOptions, ...options };
  
  return rateLimit(mergedOptions);
};

// Create various rate limiters for different routes

/**
 * Standard API rate limiter
 * 100 requests per 15 minutes per IP
 */
const apiLimiter = createRateLimiter();

/**
 * Strict rate limiter for sensitive operations
 * 10 requests per 15 minutes per IP
 */
const strictLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many requests for this operation, please try again later.'
});

/**
 * Login rate limiter
 * 5 requests per minute per IP
 */
const loginLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.'
});

/**
 * Estimate generation rate limiter
 * 30 requests per hour per IP
 */
const estimateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: 'You have generated too many estimates, please try again later.'
});

module.exports = {
  apiLimiter,
  strictLimiter,
  loginLimiter,
  estimateLimiter,
  createRateLimiter
};
