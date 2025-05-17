// utils/logger.js
const winston = require('winston');
const { createLogger, format, transports } = winston;
const { combine, timestamp, printf, colorize, json } = format;

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Determine the appropriate log level based on the environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'development' ? 'debug' : 'info';
};

// Custom format for development logs
const devFormat = printf(({ level, message, timestamp, ...meta }) => {
  return `${timestamp} ${level}: ${message} ${
    Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
  }`;
});

// Configure the Winston logger
const logger = createLogger({
  level: level(),
  levels,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    process.env.NODE_ENV === 'development' 
      ? combine(colorize(), devFormat) 
      : json()
  ),
  transports: [
    // Write all logs to console
    new transports.Console(),
    
    // Write all errors to error.log
    new transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    
    // Write all logs to combined.log
    new transports.File({ 
      filename: 'logs/combined.log' 
    })
  ],
  // Do not exit on handled exceptions
  exitOnError: false
});

// Create a stream object for Morgan to use
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

// Helper methods for different log levels
const logError = (message, meta = {}) => {
  logger.error(message, meta);
};

const logWarn = (message, meta = {}) => {
  logger.warn(message, meta);
};

const logInfo = (message, meta = {}) => {
  logger.info(message, meta);
};

const logHttp = (message, meta = {}) => {
  logger.http(message, meta);
};

const logDebug = (message, meta = {}) => {
  logger.debug(message, meta);
};

// Log API requests
const logRequest = (req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    headers: req.headers,
    body: req.body
  });
  next();
};

// Log API responses
const logResponse = (req, res, data) => {
  logger.info(`Response: ${res.statusCode}`, {
    url: req.originalUrl,
    method: req.method,
    responseTime: res.responseTime,
    data: process.env.NODE_ENV === 'development' ? data : '[redacted]'
  });
};

// Log errors
const logErrorMiddleware = (err, req, res, next) => {
  logger.error(`Error: ${err.message}`, {
    url: req.originalUrl,
    method: req.method,
    stack: err.stack,
    body: req.body
  });
  next(err);
};

module.exports = {
  logger,
  logError,
  logWarn,
  logInfo,
  logHttp,
  logDebug,
  logRequest,
  logResponse,
  logErrorMiddleware
};
