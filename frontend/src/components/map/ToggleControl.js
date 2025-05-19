// src/components/map/ToggleControl.js
import React from 'react';

const ToggleControl = ({ isEditing, setIsEditing }) => {
  return (
    <div className="absolute top-2 right-2 z-30 bg-white rounded-md shadow-md">
      <div className="flex">
        <button
          className={`px-3 py-1 text-sm ${!isEditing ? 'bg-primary-600 text-white' : 'bg-white text-gray-700'} rounded-l-md`}
          onClick={() => setIsEditing(false)}
        >
          View
        </button>
        <button
          className={`px-3 py-1 text-sm ${isEditing ? 'bg-primary-600 text-white' : 'bg-white text-gray-700'} rounded-r-md`}
          onClick={() => setIsEditing(true)}
        >
          Edit
        </button>
      </div>
    </div>
  );
};

export default ToggleControl;
