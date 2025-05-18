// src/utils/performance.js
/**
 * Simple performance monitoring utility
 */
const performanceMonitor = {
  markers: {},
  
  // Start timing an operation
  start: (name) => {
    if (process.env.NODE_ENV !== 'production') {
      performanceMonitor.markers[name] = performance.now();
      console.log(`⏱️ [PERF] Started: ${name}`);
    }
  },
  
  // End timing and log the result
  end: (name) => {
    if (process.env.NODE_ENV !== 'production') {
      const startTime = performanceMonitor.markers[name];
      if (!startTime) {
        console.warn(`⏱️ [PERF] No start marker found for: ${name}`);
        return;
      }
      
      const duration = performance.now() - startTime;
      console.log(`⏱️ [PERF] ${name}: ${duration.toFixed(2)}ms`);
      
      // Warn about slow operations
      if (duration > 500) {
        console.warn(`⚠️ [PERF] Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
      }
      
      delete performanceMonitor.markers[name];
    }
  },
  
  // Monitor a rendering component
  trackComponent: (componentName, renderTime) => {
    if (process.env.NODE_ENV !== 'production') {
      if (renderTime > 50) {
        console.warn(`⚠️ [PERF] Slow render: ${componentName} took ${renderTime.toFixed(2)}ms`);
      }
    }
  },

  // Log a memory warning if memory usage is high
  checkMemory: () => {
    if (process.env.NODE_ENV !== 'production' && window.performance && window.performance.memory) {
      const memoryInfo = window.performance.memory;
      const memoryUsedPercent = (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100;
      
      if (memoryUsedPercent > 70) {
        console.warn(`🚨 [PERF] High memory usage: ${memoryUsedPercent.toFixed(2)}% of available JS heap`);
      }
      
      return memoryUsedPercent;
    }
    return null;
  }
};

export default performanceMonitor;
