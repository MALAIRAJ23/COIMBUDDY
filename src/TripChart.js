import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, Calendar, BarChart3 } from 'lucide-react';

// Enhanced colors for fare ranges
const COLORS = {
  low: '#10b981',      // Green for low fares
  medium: '#f59e0b',   // Amber for medium fares
  high: '#ef4444',     // Red for high fares
  premium: '#8b5cf6',  // Purple for premium fares
};

const getColor = (fare) => {
  if (fare < 100) return COLORS.low;
  if (fare < 150) return COLORS.medium;
  if (fare < 200) return COLORS.high;
  return COLORS.premium;
};

const getFareRange = (fare) => {
  if (fare < 100) return 'Budget';
  if (fare < 150) return 'Standard';
  if (fare < 200) return 'Premium';
  return 'Luxury';
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-white p-4 rounded-xl shadow-strong border border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: data.payload.color }}
          ></div>
          <span className="font-semibold text-gray-800">{data.payload.name}</span>
        </div>
        <div className="text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span>Fare: ₹{data.value}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Range: {getFareRange(data.value)}
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function TripChart({ tripData = [] }) {
  // tripData: array of fares for last 5 days
  const data = tripData.map((fare, i) => ({
    name: `Day ${i + 1}`,
    value: fare,
    color: getColor(fare),
    range: getFareRange(fare)
  }));

  const totalFare = data.reduce((sum, item) => sum + item.value, 0);
  const averageFare = data.length > 0 ? totalFare / data.length : 0;

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 rounded-xl">
            <BarChart3 className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Trip Analytics</h3>
            <p className="text-sm text-gray-500">Last 5 days fare breakdown</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-primary-600">₹{totalFare}</div>
          <div className="text-xs text-gray-500">Total Earnings</div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-br from-primary-50 to-primary-100 p-4 rounded-xl border border-primary-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary-600" />
            <span className="text-xs font-medium text-primary-700">Average Fare</span>
          </div>
          <div className="text-lg font-bold text-primary-800">₹{averageFare.toFixed(0)}</div>
        </div>
        <div className="bg-gradient-to-br from-secondary-50 to-secondary-100 p-4 rounded-xl border border-secondary-200">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-secondary-600" />
            <span className="text-xs font-medium text-secondary-700">Total Trips</span>
          </div>
          <div className="text-lg font-bold text-secondary-800">{data.length}</div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              innerRadius={40}
              paddingAngle={2}
              stroke="white"
              strokeWidth={2}
            >
              {data.map((entry, idx) => (
                <Cell 
                  key={`cell-${idx}`} 
                  fill={entry.color}
                  className="hover:opacity-80 transition-opacity duration-200"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center content */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-800">{data.length}</div>
            <div className="text-xs text-gray-500">Trips</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Fare Ranges</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-xs text-gray-600">Budget: &lt; ₹100</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-xs text-gray-600">Standard: ₹100-149</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-xs text-gray-600">Premium: ₹150-199</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span className="text-xs text-gray-600">Luxury: ₹200+</span>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {data.length === 0 && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-600 mb-2">No Trip Data</h3>
          <p className="text-sm text-gray-500">Start your first trip to see analytics here</p>
        </div>
      )}
    </div>
  );
} 