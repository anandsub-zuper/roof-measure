// Modification to src/components/steps/RoofSizeStep.js
// Add import for new component
import LeafletMeasurementOverlay from '../map/LeafletMeasurementOverlay';

// Add state for Leaflet measurement
const [leafletArea, setLeafletArea] = useState(null);
const [leafletPolygon, setLeafletPolygon] = useState(null);
const [showLeaflet, setShowLeaflet] = useState(true); // Enable by default

// Add this inside the existing mapComponent useMemo
// After the EnhancedGoogleMapContainer component but before its closing tag
{showLeaflet && !skipMap && !mapDisabled && coordinates && mapContainerRef.current && (
  <LeafletMeasurementOverlay
    googleMapInstance={mapContainerRef.current?.getMapInstance?.()}
    roofPolygon={leafletPolygon || formData.roofPolygon}
    coordinates={coordinates}
    roofSize={formData.roofSize}
    onPolygonUpdated={(polygon) => {
      setLeafletPolygon(polygon);
      // Keep Google polygon for comparison
    }}
    onAreaMeasured={(area) => {
      setLeafletArea(area);
      if (area > 0 && !formData.roofSizeAuto) {
        // Only update if user has chosen manual mode
        setLocalRoofSize(area);
        debouncedUpdateRoofSize(area);
      }
    }}
  />
)}

// Update the handlePolygonCreated function to set Leaflet polygon initially
const handlePolygonCreated = useCallback((polygon, area) => {
  console.log("Polygon created with area:", area, "Backend area:", formData.initialRoofSize);
  
  // Store the polygon coordinates for Leaflet to use
  const polygonCoords = [];
  if (polygon && polygon.getPath) {
    const path = polygon.getPath();
    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i);
      polygonCoords.push({
        lat: point.lat(),
        lng: point.lng()
      });
    }
    setLeafletPolygon(polygonCoords);
  } else if (roofPolygon && Array.isArray(roofPolygon)) {
    setLeafletPolygon(roofPolygon);
  }
  
  // Always store the polygon-calculated area separately
  updateFormData('polygonArea', area);
  
  // Rest of your existing handlePolygonCreated code...
}, [formData.initialRoofSize, formData.address, estimatedSizeFromProperty, updateFormData]);

// Add a toggle for measurement system in the UI
// Add this near where you show the roof size information
<div className="flex items-center justify-between mb-2">
  <span className="text-sm text-gray-600">Measurement Method:</span>
  <div className="flex space-x-2">
    <button
      onClick={() => setShowLeaflet(false)}
      className={`text-xs px-2 py-1 rounded ${!showLeaflet ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'}`}
    >
      Google Maps
    </button>
    <button
      onClick={() => setShowLeaflet(true)}
      className={`text-xs px-2 py-1 rounded ${showLeaflet ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'}`}
    >
      Leaflet + Turf
    </button>
  </div>
</div>

// Add a section showing both measurements for comparison
// This helps validate the measurements are working correctly
<div className="w-full bg-gray-50 p-3 rounded-lg mb-4 text-sm">
  <div className="flex justify-between">
    <span>Google Maps area:</span>
    <span>{formatNumber(formData.polygonArea || 0)} sq ft</span>
  </div>
  <div className="flex justify-between">
    <span>Leaflet + Turf area:</span>
    <span>{formatNumber(leafletArea || 0)} sq ft</span>
  </div>
  <div className="flex justify-between font-medium text-primary-700">
    <span>Selected area:</span>
    <span>{formatNumber(localRoofSize || 0)} sq ft</span>
  </div>
</div>
