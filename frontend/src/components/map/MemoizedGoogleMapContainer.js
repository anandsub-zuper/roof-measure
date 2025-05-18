// src/components/map/MemoizedGoogleMapContainer.js
import React, { memo } from 'react';
import GoogleMapContainer from './GoogleMapContainer';

// Prevent unnecessary re-renders of the expensive map component
const MemoizedGoogleMapContainer = memo(
  GoogleMapContainer, 
  (prevProps, nextProps) => {
    // Only re-render if these critical props change
    return (
      prevProps.lat === nextProps.lat &&
      prevProps.lng === nextProps.lng &&
      prevProps.address === nextProps.address
    );
  }
);

export default MemoizedGoogleMapContainer;
