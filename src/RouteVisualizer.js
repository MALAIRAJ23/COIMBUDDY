import React from 'react';
import { GoogleMap, Polyline, Marker, InfoWindow } from '@react-google-maps/api';

const RouteVisualizer = ({ 
  routePolyline, 
  pickupPoints, 
  selectedPickupPoint, 
  onPickupPointSelect,
  center,
  zoom = 12 
}) => {
  const [infoWindow, setInfoWindow] = React.useState(null);

  const mapContainerStyle = {
    width: '100%',
    height: '300px',
    borderRadius: '12px',
    border: '2px solid #e5e7eb'
  };

  const getMarkerIcon = (type) => {
    const baseUrl = 'https://maps.google.com/mapfiles/ms/icons/';
    switch (type) {
      case 'start':
        return `${baseUrl}green-dot.png`;
      case 'end':
        return `${baseUrl}red-dot.png`;
      case 'intermediate':
        return `${baseUrl}blue-dot.png`;
      default:
        return `${baseUrl}yellow-dot.png`;
    }
  };

  const getMarkerColor = (type) => {
    switch (type) {
      case 'start':
        return '#10b981'; // green
      case 'end':
        return '#ef4444'; // red
      case 'intermediate':
        return '#3b82f6'; // blue
      default:
        return '#f59e0b'; // yellow
    }
  };

  return (
    <div className="mb-4">
      <div className="text-sm font-medium text-gray-700 mb-2">Route & Pickup Points</div>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={zoom}
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
        {pickupPoints.map((point, index) => (
          <Marker
            key={point.id}
            position={{ lat: point.lat, lng: point.lng }}
            icon={{
              url: getMarkerIcon(point.type),
              scaledSize: new window.google.maps.Size(30, 30),
            }}
            onClick={() => {
              setInfoWindow(point);
              onPickupPointSelect(point, index);
            }}
            animation={
              selectedPickupPoint?.id === point.id 
                ? window.google.maps.Animation.BOUNCE 
                : null
            }
          />
        ))}

        {/* Info Window */}
        {infoWindow && (
          <InfoWindow
            position={{ lat: infoWindow.lat, lng: infoWindow.lng }}
            onCloseClick={() => setInfoWindow(null)}
          >
            <div className="p-2">
              <div className="font-semibold text-gray-800">{infoWindow.name}</div>
              <div className="text-sm text-gray-600">
                {infoWindow.type === 'start' ? '🚀 Start' : 
                 infoWindow.type === 'end' ? '🎯 End' : '📍 Intermediate'}
              </div>
              {infoWindow.distance > 0 && (
                <div className="text-xs text-gray-500">
                  {infoWindow.distance.toFixed(1)} km from start
                </div>
              )}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
};

export default RouteVisualizer; 