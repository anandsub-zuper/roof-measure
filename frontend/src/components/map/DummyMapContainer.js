// src/components/map/DummyMapContainer.js
import React, { forwardRef, useImperativeHandle } from 'react';
import { MapPin } from 'lucide-react';

const DummyMapContainer = forwardRef(({ 
  lat, 
  lng, 
  address, 
  onMapReady, 
  onPolygonCreated 
}, ref) => {
  // Create dummy methods for the ref
  useImperativeHandle(ref, () => ({
    zoomIn: () => console.log("Dummy zoom in"),
    zoomOut: () => console.log("Dummy zoom out"),
    getMapInstance: () => null
  }));

  // Call callbacks immediately with dummy data
  React.useEffect(() => {
    // Notify parent the "map" is ready
    onMapReady && onMapReady();
    
    // Provide a reasonable roof size
    const defaultArea = Math.floor(2000 + Math.random() * 2000); // Random between 2000-4000
    onPolygonCreated && onPolygonCreated(null, defaultArea);
  }, [onMapReady, onPolygonCreated]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
      <MapPin size={40} className="mb-4 text-primary-600" />
      <p className="font-medium text-gray-700">Map View Disabled</p>
      <p className="text-sm text-gray-500 mt-1">Using property data for roof size calculation</p>
      <div className="mt-4 text-xs text-gray-400">
        <p>Location: {address}</p>
        <p>Coordinates: {lat.toFixed(6)}, {lng.toFixed(6)}</p>
      </div>
    </div>
  );
});

DummyMapContainer.displayName = 'DummyMapContainer';

export default DummyMapContainer;
