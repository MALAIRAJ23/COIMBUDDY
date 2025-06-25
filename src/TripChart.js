import React from 'react';

export default function TripChart({ tripData = [] }) {
  // Sample data for the last 5 days
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const maxTrips = Math.max(...tripData, 1); // Prevent division by zero

  return (
    <div className="h-64 bg-gray-50 rounded-lg border border-gray-200 p-4">
      <div className="flex items-end justify-between h-48 mb-4">
        {days.map((day, index) => {
          const tripCount = tripData[index] || 0;
          const height = (tripCount / maxTrips) * 100;
          return (
            <div key={day} className="flex flex-col items-center flex-1">
              <div 
                className="w-full bg-gradient-to-t from-blue-500 to-blue-300 rounded-t-lg transition-all duration-300 hover:from-blue-600 hover:to-blue-400"
                style={{ height: `${height}%` }}
              >
                <div className="text-white text-xs font-bold text-center mt-1">
                  {tripCount}
                </div>
              </div>
              <div className="text-xs text-gray-600 mt-2 font-medium">{day}</div>
            </div>
          );
        })}
      </div>
      <div className="text-center">
        <div className="text-sm text-gray-600">
          Total Trips: {tripData.reduce((sum, count) => sum + count, 0)}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Last 5 days activity
        </div>
      </div>
    </div>
  );
} 