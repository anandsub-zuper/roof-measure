javascriptimport { useEffect, useRef, useState } from 'react';

export default function useGoogleMaps(mapOptions = {}) {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);
  
  // Load Google Maps script
  useEffect(() => {
    // Check if script is already loaded
    if (window.google && window.google.maps) {
      setIsLoaded(true);
      return;
    }
    
    // Create script element
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_PUBLIC_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    
    // Handle script load success
    script.onload = () => {
      setIsLoaded(true);
    };
    
    // Handle script load error
    script.onerror = (e) => {
      setError(new Error('Failed to load Google Maps script'));
    };
    
    // Add script to document
    document.head.appendChild(script);
    
    // Cleanup
    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);
  
  // Initialize map when script is loaded and container is available
  useEffect(() => {
    if (isLoaded && mapRef.current && !map) {
      try {
        const mapInstance = new window.google.maps.Map(mapRef.current, {
          center: { lat: 39.8283, lng: -98.5795 }, // Default center (US)
          zoom: 4,
          ...mapOptions
        });
        setMap(mapInstance);
      } catch (e) {
        setError(e);
      }
    }
  }, [isLoaded, map, mapOptions]);
  
  return { mapRef, map, isLoaded, error };
}
