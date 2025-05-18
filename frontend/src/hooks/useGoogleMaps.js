// src/hooks/useGoogleMaps.js
import { useEffect, useRef, useState } from 'react';
import { loadGoogleMapsApi } from '../services/mapsService';

export default function useGoogleMaps(mapOptions = {}) {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);
  
  // Load Google Maps script
  useEffect(() => {
    loadGoogleMapsApi()
      .then(() => setIsLoaded(true))
      .catch(err => setError(err));
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
