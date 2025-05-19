// src/components/MeasurementComparisonTool.js
import React, { useState, useEffect } from 'react';
import { formatNumber } from '../utils/formatters';
import LeafletMeasurementUtil from '../utils/LeafletMeasurementUtil';

/**
 * Component for comparing different roof measurement techniques
 * Useful for debugging and validating measurements
 */
const MeasurementComparisonTool = ({ 
  propertyData, 
  coordinates,
  roofPolygon, 
  visionResult, 
  manualMeasurement 
}) => {
  const [measurements, setMeasurements] = useState([]);
  const [bestEstimate, setBestEstimate] = useState(null);
  
  // Calculate all the measurements when props change
  useEffect(() => {
    const results = [];
    
    // If we have vision analysis result
    if (visionResult && visionResult.roofArea) {
      results.push({
        method: 'OpenAI Vision',
        area: visionResult.roofArea,
        confidence: visionResult.confidence || 'medium',
        notes: 'AI analysis of satellite imagery'
      });
    }
    
    // If we have property data
    if (propertyData && propertyData.buildingSize) {
      const stories = propertyData.stories || 1;
      const footprint = Math.round(propertyData.buildingSize / stories);
      
      // Calculate with standard factors
      const standardFactor = 1.3;
      const standardArea = Math.round(footprint * standardFactor);
      
      results.push({
        method: 'Property Data (Standard)',
        area: standardArea,
        confidence: 'medium',
        notes: `${footprint} sq ft × ${standardFactor} factor`
      });
      
      // Calculate with pitch-adjusted factor
      const pitchFactor = {
        'flat': 1.05,
        'low': 1.15,
        'moderate': 1.45,
        'steep': 1.6
      }[propertyData.roofPitch || 'moderate'] || 1.45;
      
      const pitchAdjustedArea = Math.round(footprint * pitchFactor);
      
      results.push({
        method: 'Property Data (Pitch-Adjusted)',
        area: pitchAdjustedArea,
        confidence: 'medium',
        notes: `${footprint} sq ft × ${pitchFactor} factor (${propertyData.roofPitch || 'moderate'} pitch)`
      });
    }
    
    // If we have roof polygon, calculate with Leaflet/Turf
    if (roofPolygon && Array.isArray(roofPolygon) && roofPolygon.length >= 3) {
      // Calculate basic polygon area
      const basicArea = LeafletMeasurementUtil.calculateRoofArea(
        roofPolygon, 
        'flat', 
        'simple'
      );
      
      results.push({
        method: 'Leaflet Measurement (Basic)',
        area: basicArea,
        confidence: 'medium',
        notes: 'Flat 2D polygon area calculation'
      });
      
      // Calculate with pitch adjustment
      const pitchAdjustedArea = LeafletMeasurementUtil.calculateRoofArea(
        roofPolygon,
        propertyData?.roofPitch || 'moderate',
        propertyData?.roofShape || 'simple'
      );
      
      results.push({
        method: 'Leaflet Measurement (Adjusted)',
        area: pitchAdjustedArea,
        confidence: 'high',
        notes: `Adjusted for ${propertyData?.roofPitch || 'moderate'} pitch and ${propertyData?.roofShape || 'simple'} complexity`
      });
    }
    
    // If we have manual measurement
    if (manualMeasurement) {
      results.push({
        method: 'Manual Input',
        area: manualMeasurement,
        confidence: 'user',
        notes: 'User-provided measurement'
      });
    }
    
    // Store all measurements
    setMeasurements(results);
    
    // Determine the best estimate
    let best = null;
    
    // Priority: Manual > Leaflet Adjusted > Vision High Confidence > Property Pitch-Adjusted
    if (manualMeasurement) {
      best = manualMeasurement;
    } else if (results.find(r => r.method === 'Leaflet Measurement (Adjusted)')) {
      best = results.find(r => r.method === 'Leaflet Measurement (Adjusted)').area;
    } else if (visionResult && visionResult.confidence === 'high') {
      best = visionResult.roofArea;
    } else if (results.find(r => r.method === 'Property Data (Pitch-Adjusted)')) {
      best = results.find(r => r.method === 'Property Data (Pitch-Adjusted)').area;
    } else if (results.length > 0) {
      // Use the average of all measurements
      const sum = results.reduce((total, r) => total + r.area, 0);
      best = Math.round(sum / results.length);
    } else {
      best = 2200; // Reasonable default
    }
    
    setBestEstimate(best);
  }, [propertyData, roofPolygon, visionResult, manualMeasurement]);

  // Calculate variations between measurements
  const calculateVariance = () => {
    if (measurements.length < 2) return 0;
    
    const values = measurements.map(m => m.area);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    
    return Math.sqrt(variance);
  };

  const variance = calculateVariance();
  const variancePercent = measurements.length > 0 ? 
    Math.round((variance / bestEstimate) * 100) : 0;

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className="text-xl font-semibold mb-3">Measurement Comparison</h3>
      
      {/* Best Estimate */}
      <div className="bg-blue-50 p-4 rounded-lg mb-4">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="font-medium text-blue-800">Best Estimate</h4>
            <p className="text-sm text-blue-600">Based on available data</p>
          </div>
          <div className="text-2xl font-bold text-blue-900">{formatNumber(bestEstimate)} sq ft</div>
        </div>
      </div>
      
      {/* Variance Indicator */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium">Measurement Variance</span>
          <span className={`text-sm font-medium ${
            variancePercent > 15 ? 'text-red-500' : 
            variancePercent > 10 ? 'text-yellow-500' : 
            'text-green-500'
          }`}>
            ±{variancePercent}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className={`h-2.5 rounded-full ${
              variancePercent > 15 ? 'bg-red-500' : 
              variancePercent > 10 ? 'bg-yellow-500' : 
              'bg-green-500'
            }`} 
            style={{ width: `${Math.min(variancePercent * 3, 100)}%` }}
          ></div>
        </div>
      </div>
      
      {/* Measurement Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Method
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Area (sq ft)
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Confidence
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Diff
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {measurements.map((item, index) => (
              <tr key={index} className={item.area === bestEstimate ? 'bg-blue-50' : ''}>
                <td className="px-4 py-2 text-sm text-gray-900">
                  {item.method}
                  <div className="text-xs text-gray-500">{item.notes}</div>
                </td>
                <td className="px-4 py-2 text-sm text-right font-medium">
                  {formatNumber(item.area)}
                </td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    item.confidence === 'high' ? 'bg-green-100 text-green-800' :
                    item.confidence === 'medium' ? 'bg-blue-100 text-blue-800' :
                    item.confidence === 'low' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-purple-100 text-purple-800'
                  }`}>
                    {item.confidence}
                  </span>
                </td>
                <td className="px-4 py-2 text-sm">
                  {bestEstimate && (
                    <span className={`${
                      Math.abs(item.area - bestEstimate) / bestEstimate > 0.1 ? 'text-red-500' : 'text-gray-500'
                    }`}>
                      {item.area > bestEstimate ? '+' : ''}
                      {Math.round((item.area - bestEstimate) / bestEstimate * 100)}%
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Explanation */}
      <div className="mt-4 text-xs text-gray-500">
        <p>This tool compares different measurement methods to determine the most accurate roof size. 
        The best estimate is selected based on confidence levels and measurement consistency.</p>
      </div>
    </div>
  );
};

export default MeasurementComparisonTool;
