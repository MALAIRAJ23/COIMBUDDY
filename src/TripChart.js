import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Colors for fare ranges
const COLORS = ['#60a5fa', '#fbbf24', '#34d399', '#ef4444'];
const getColor = (fare) => {
  if (fare < 100) return COLORS[0];
  if (fare < 150) return COLORS[1];
  if (fare < 200) return COLORS[2];
  return COLORS[3];
};

export default function TripChart({ tripData = [] }) {
  // tripData: array of fares for last 5 days
  const data = tripData.map((fare, i) => ({
    name: `Day ${i + 1}`,
    value: fare,
    color: getColor(fare)
  }));

  return (
    <div className="h-64 bg-gray-50 rounded-lg border border-gray-200 p-4">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={({ name, value }) => `${name}: ₹${value}`}
          >
            {data.map((entry, idx) => (
              <Cell key={`cell-${idx}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `₹${value}`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      <div className="text-center mt-2 text-xs text-gray-500">
        <div><span style={{ color: COLORS[0] }}>●</span> &lt; ₹100</div>
        <div><span style={{ color: COLORS[1] }}>●</span> ₹100-₹149</div>
        <div><span style={{ color: COLORS[2] }}>●</span> ₹150-₹199</div>
        <div><span style={{ color: COLORS[3] }}>●</span> ₹200+</div>
      </div>
    </div>
  );
} 