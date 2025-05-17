// utils/apiResponse.js
/**
 * Standard API response formatting utilities
 */

/**
 * Create a success response object
 * @param {string} message - Success message
 * @param {*} data - The data to include in the response
 * @param {number} statusCode - HTTP status code
 * @returns {Object} Formatted success response
 */
const success = (message = 'Operation successful', data = {}, statusCode = 200) => {
  return {
    success: true,
    message,
    data,
    statusCode
  };
};

/**
 * Create an error response object
 * @param {string} message - Error message
 * @param {Object} error - Error details
 * @param {number} statusCode - HTTP status code
 * @returns {Object} Formatted error response
 */
const error = (message = 'An error occurred', error = null, statusCode = 500) => {
  const response = {
    success: false,
    message,
    statusCode
  };

  // Include error details in development, but not in production
  if (process.env.NODE_ENV !== 'production' && error) {
    response.error = typeof error === 'object' ? {
      ...error,
      stack: error.stack
    } : error;
  }

  return response;
};

/**
 * Create a validation error response
 * @param {string} message - Validation error message
 * @param {Object} errors - Validation errors object
 * @returns {Object} Formatted validation error response
 */
const validationError = (message = 'Validation failed', errors = {}) => {
  return {
    success: false,
    message,
    errors,
    statusCode: 422
  };
};

/**
 * Create a not found error response
 * @param {string} message - Not found message
 * @returns {Object} Formatted not found error response
 */
const notFound = (message = 'Resource not found') => {
  return {
    success: false,
    message,
    statusCode: 404
  };
};

/**
 * Create an unauthorized error response
 * @param {string} message - Unauthorized message
 * @returns {Object} Formatted unauthorized error response
 */
const unauthorized = (message = 'Unauthorized access') => {
  return {
    success: false,
    message,
    statusCode: 401
  };
};

/**
 * Create a forbidden error response
 * @param {string} message - Forbidden message
 * @returns {Object} Formatted forbidden error response
 */
const forbidden = (message = 'Forbidden access') => {
  return {
    success: false,
    message,
    statusCode: 403
  };
};

/**
 * Send response helper for Express
 * @param {Object} res - Express response object
 * @param {Object} response - Response object from one of the functions above
 */
const send = (res, response) => {
  return res.status(response.statusCode).json(response);
};

module.exports = {
  success,
  error,
  validationError,
  notFound,
  unauthorized,
  forbidden,
  send
};
