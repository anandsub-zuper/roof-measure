// frontend/src/utils/imageUtils.js
/**
 * Utility functions for capturing and processing images
 */

/**
 * Captures the current state of a Google Map as a base64 image
 * @param {Object} mapInstance - Google Maps instance
 * @returns {Promise<string>} - Promise resolving to base64 image data
 */
export const captureMapImage = (mapInstance) => {
  return new Promise((resolve, reject) => {
    try {
      if (!mapInstance || !window.google?.maps) {
        reject(new Error("Map instance not available"));
        return;
      }

      // Hide the markers and UI controls temporarily for a clean capture
      const mapDiv = mapInstance.getDiv();
      const originalControls = [];
      
      // Store original control visibility
      mapInstance.controls.forEach((controlArray, position) => {
        controlArray.forEach(control => {
          originalControls.push({
            control,
            position,
            visible: control.style.display !== 'none'
          });
          control.style.display = 'none';
        });
      });
      
      // Hide any markers
      const markers = Array.from(mapDiv.querySelectorAll('img[src*="marker"]'));
      markers.forEach(marker => {
        marker.style.visibility = 'hidden';
      });

      // Use html2canvas to capture the map
      import('html2canvas').then(({ default: html2canvas }) => {
        html2canvas(mapDiv, {
          useCORS: true,
          allowTaint: true,
          scale: 2, // Higher quality
        }).then(canvas => {
          // Convert canvas to base64 image
          const imageBase64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
          
          // Restore UI elements
          originalControls.forEach(({ control, visible }) => {
            control.style.display = visible ? '' : 'none';
          });
          
          // Restore markers
          markers.forEach(marker => {
            marker.style.visibility = '';
          });
          
          resolve(imageBase64);
        }).catch(reject);
      }).catch(reject);
    } catch (error) {
      reject(error);
    }
  });
};
