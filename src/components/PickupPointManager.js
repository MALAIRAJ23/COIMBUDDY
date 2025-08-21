import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, Marker, Polyline, InfoWindow } from '@react-google-maps/api';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../firebase/collections';
import { MapPin, Plus, Trash2, Edit } from 'lucide-react';
import toast from 'react-hot-toast';

const PickupPointManager = ({ 
  source, 
  destination, 
  routePolyline, 
  onPickupPointsChange,
  isPilot = false,
  selectedPickupPoints = [],
  onPickupPointSelect 
}) => {
  const [pickupPoints, setPickupPoints] = useState([]);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [mapCenter, setMapCenter] = useState(null);

  // Generate pickup points along route
  const generatePickupPoints = useCallback(async () => {
    if (!window.google || !source || !destination) return;

    setIsGenerating(true);
    try {
      const service = new window.google.maps.DirectionsService();
      const result = await new Promise((resolve, reject) => {
        service.route(
          {
            origin: source,
            destination: destination,
            travelMode: window.google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (status === 'OK') resolve(result);
            else reject(new Error('Failed to get route'));
          }
        );
      });

      const route = result.routes[0];
      const leg = route.legs[0];
      const generatedPoints = [];

      // Add start point
      generatedPoints.push({
        id: 'start',
        name: 'Start Point',
        location: source,
        lat: leg.start_location.lat(),
        lng: leg.start_location.lng(),
        distance: 0,
        type: 'start',
        isSelected: isPilot ? true : false
      });

      // Generate intermediate points every 2-3 km
      if (route.overview_path && window.google.maps.geometry) {
        const stepDistance = 2500; // 2.5km intervals
        let currentDistance = 0;
        let pointIndex = 1;

        for (let i = 0; i < route.overview_path.length - 1; i++) {
          const point1 = route.overview_path[i];
          const point2 = route.overview_path[i + 1];
          const distance = window.google.maps.geometry.spherical.computeDistanceBetween(point1, point2);
          currentDistance += distance;

          if (currentDistance >= stepDistance) {
            // Reverse geocode to get location name
            const geocoder = new window.google.maps.Geocoder();
            const locationName = await new Promise((resolve) => {
              geocoder.geocode({ location: { lat: point1.lat(), lng: point1.lng() } }, (results, status) => {
                if (status === 'OK' && results[0]) {
                  resolve(results[0].formatted_address);
                } else {
                  resolve(`Pickup Point ${pointIndex}`);
                }
              });
            });

            generatedPoints.push({
              id: `point_${pointIndex}`,
              name: locationName,
              location: locationName,
              lat: point1.lat(),
              lng: point1.lng(),
              distance: currentDistance / 1000,
              type: 'intermediate',
              isSelected: isPilot ? true : false
            });
            pointIndex++;
            currentDistance = 0;
          }
        }
      }

      // Add end point
      generatedPoints.push({
        id: 'end',
        name: 'End Point',
        location: destination,
        lat: leg.end_location.lat(),
        lng: leg.end_location.lng(),
        distance: leg.distance.value / 1000,
        type: 'end',
        isSelected: isPilot ? true : false
      });

      setPickupPoints(generatedPoints);
      setMapCenter({ lat: leg.start_location.lat(), lng: leg.start_location.lng() });
      
      // Save to Firestore for pilots
      if (isPilot) {
        await savePickupPointsToFirestore(generatedPoints, source, destination);
      }

      onPickupPointsChange(generatedPoints);
      toast.success(`Generated ${generatedPoints.length} pickup points`);
    } catch (error) {
      console.error('Error generating pickup points:', error);
      toast.error('Failed to generate pickup points');
    } finally {
      setIsGenerating(false);
    }
  }, [source, destination, isPilot, onPickupPointsChange]);

  // Save pickup points to Firestore
  const savePickupPointsToFirestore = async (points, tripSource, tripDestination) => {
    try {
      const pickupPointData = {
        source: tripSource,
        destination: tripDestination,
        points: points,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await addDoc(collection(db, COLLECTIONS.PICKUP_POINTS), pickupPointData);
    } catch (error) {
      console.error('Error saving pickup points:', error);
    }
  };

  // Handle pickup point selection
  const handlePickupPointSelect = (point) => {
    if (isPilot) {
      // For pilots: toggle selection
      const updatedPoints = pickupPoints.map(p => 
        p.id === point.id ? { ...p, isSelected: !p.isSelected } : p
      );
      setPickupPoints(updatedPoints);
      onPickupPointsChange(updatedPoints.filter(p => p.isSelected));
    } else {
      // For buddies: single selection
      setSelectedPoint(point);
      onPickupPointSelect(point);
    }
  };

  // Get marker icon based on type
  const getMarkerIcon = (type, isSelected) => {
    const baseUrl = 'https://maps.google.com/mapfiles/ms/icons/';
    const iconMap = {
      start: 'green-dot.png',
      end: 'red-dot.png',
      intermediate: 'blue-dot.png'
    };
    
    return {
      url: `${baseUrl}${iconMap[type] || 'yellow-dot.png'}`,
      scaledSize: new window.google.maps.Size(isSelected ? 35 : 30, isSelected ? 35 : 30),
      anchor: new window.google.maps.Point(15, 15)
    };
  };

  // Generate points when source/destination changes
  useEffect(() => {
    if (source && destination) {
      generatePickupPoints();
    }
  }, [source, destination, generatePickupPoints]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">
          {isPilot ? 'Pickup Points' : 'Select Pickup Point'}
        </h3>
        {isPilot && (
          <button
            onClick={generatePickupPoints}
            disabled={isGenerating}
            className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Generating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Regenerate
              </>
            )}
          </button>
        )}
      </div>

      {/* Map */}
      {mapCenter && (
        <div className="relative">
          <GoogleMap
            mapContainerStyle={{
              width: '100%',
              height: '300px',
              borderRadius: '12px',
              border: '2px solid #e5e7eb'
            }}
            center={mapCenter}
            zoom={12}
            options={{
              zoomControl: true,
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
            }}
          >
            {/* Route Polyline */}
            {routePolyline && (
              <Polyline
                path={routePolyline}
                options={{
                  strokeColor: '#3b82f6',
                  strokeOpacity: 0.8,
                  strokeWeight: 4,
                }}
              />
            )}

            {/* Pickup Point Markers */}
            {pickupPoints.map((point) => (
              <Marker
                key={point.id}
                position={{ lat: point.lat, lng: point.lng }}
                icon={getMarkerIcon(point.type, point.isSelected)}
                onClick={() => handlePickupPointSelect(point)}
                animation={
                  (isPilot ? point.isSelected : selectedPoint?.id === point.id)
                    ? window.google.maps.Animation.BOUNCE
                    : null
                }
              />
            ))}

            {/* Info Window */}
            {selectedPoint && (
              <InfoWindow
                position={{ lat: selectedPoint.lat, lng: selectedPoint.lng }}
                onCloseClick={() => setSelectedPoint(null)}
              >
                <div className="p-2">
                  <h4 className="font-semibold text-gray-800">{selectedPoint.name}</h4>
                  <p className="text-sm text-gray-600">{selectedPoint.location}</p>
                  {selectedPoint.distance > 0 && (
                    <p className="text-xs text-gray-500">
                      {selectedPoint.distance.toFixed(1)} km from start
                    </p>
                  )}
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </div>
      )}

      {/* Pickup Points List */}
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {pickupPoints.map((point) => (
          <div
            key={point.id}
            className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
              isPilot
                ? point.isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
                : selectedPoint?.id === point.id
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
            onClick={() => handlePickupPointSelect(point)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin className={`w-5 h-5 ${
                  isPilot
                    ? point.isSelected ? 'text-blue-500' : 'text-gray-400'
                    : selectedPoint?.id === point.id ? 'text-green-500' : 'text-gray-400'
                }`} />
                <div>
                  <div className="font-medium text-gray-800">{point.name}</div>
                  <div className="text-sm text-gray-600">{point.location}</div>
                  {point.distance > 0 && (
                    <div className="text-xs text-gray-500">
                      {point.distance.toFixed(1)} km from start
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  point.type === 'start'
                    ? 'bg-green-100 text-green-800'
                    : point.type === 'end'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {point.type}
                </span>
                {isPilot && (
                  <input
                    type="checkbox"
                    checked={point.isSelected}
                    onChange={() => handlePickupPointSelect(point)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      {isPilot && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-sm text-blue-800">
            Selected {pickupPoints.filter(p => p.isSelected).length} of {pickupPoints.length} pickup points
          </div>
        </div>
      )}
    </div>
  );
};

export default PickupPointManager;
