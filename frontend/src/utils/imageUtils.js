// src/utils/imageUtils.js
import html2canvas from 'html2canvas';

/**
 * Captures the current state of a Google Map as a base64 image
 * @param {Object} mapInstance - Google Maps instance
 * @returns {Promise<string>} - Promise resolving to base64 image data
 */
export const captureMapImage = (mapInstance) => {
  return new Promise((resolve, reject) => {
    try {
      if (!mapInstance) {
        reject(new Error("Map instance not available"));
        return;
      }

      // Get the map container
      const mapDiv = mapInstance.getDiv();
      
      // Hide UI elements temporarily
      const controls = document.querySelectorAll('.gm-control-active, .gm-svpc, .gm-style-mtc');
      controls.forEach(control => {
        control.style.display = 'none';
      });
      
      // Capture the map
      html2canvas(mapDiv, {
        useCORS: true,
        allowTaint: true,
        scale: 1.5,
        logging: false,
      }).then(canvas => {
        // Convert to base64
        const imageBase64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
        
        // Restore UI elements
        controls.forEach(control => {
          control.style.display = '';
        });
        
        resolve(imageBase64);
      }).catch(error => {
        console.error("Error capturing map:", error);
        reject(error);
      });
    } catch (error) {
      console.error("Error in captureMapImage:", error);
      reject(error);
    }
  });
};

export default {
  captureMapImage
};
