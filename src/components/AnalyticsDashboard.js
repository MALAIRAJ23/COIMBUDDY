import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  startAfter,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../firebase/collections';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  Car, 
  DollarSign, 
  Star, 
  Calendar,
  MapPin,
  Clock,
  Filter
} from 'lucide-react';

const AnalyticsDashboard = ({ userId, userType = 'pilot' }) => {
  const [analyticsData, setAnalyticsData] = useState({
    trips: [],
    earnings: [],
    ratings: [],
    locations: [],
    timeDistribution: []
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30'); // days
  const [selectedMetric, setSelectedMetric] = useState('trips');

  // Load analytics data
  useEffect(() => {
    loadAnalyticsData();
  }, [userId, userType, dateRange]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateRange));

      // Load trips data
      const tripsQuery = query(
        collection(db, COLLECTIONS.TRIPS),
        where(userType === 'pilot' ? 'driverId' : 'buddyId', '==', userId),
        where('createdAt', '>=', startDate),
        orderBy('createdAt', 'desc')
      );
      const tripsSnapshot = await getDocs(tripsQuery);
      const trips = tripsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date()
      }));

      // Load ratings data
      const ratingsQuery = query(
        collection(db, COLLECTIONS.RATINGS),
        where('ratedUserId', '==', userId),
        where('createdAt', '>=', startDate),
        orderBy('createdAt', 'desc')
      );
      const ratingsSnapshot = await getDocs(ratingsQuery);
      const ratings = ratingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date()
      }));

      // Process data for charts
      const processedData = processAnalyticsData(trips, ratings);
      setAnalyticsData(processedData);
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Process raw data into chart formats
  const processAnalyticsData = (trips, ratings) => {
    // Daily trips chart
    const dailyTrips = {};
    trips.forEach(trip => {
      const date = trip.createdAt.toISOString().split('T')[0];
      dailyTrips[date] = (dailyTrips[date] || 0) + 1;
    });

    const tripsChartData = Object.entries(dailyTrips).map(([date, count]) => ({
      date,
      trips: count
    }));

    // Earnings chart (for pilots)
    const dailyEarnings = {};
    if (userType === 'pilot') {
      trips.forEach(trip => {
        const date = trip.createdAt.toISOString().split('T')[0];
        dailyEarnings[date] = (dailyEarnings[date] || 0) + (trip.fare || 0);
      });
    }

    const earningsChartData = Object.entries(dailyEarnings).map(([date, amount]) => ({
      date,
      earnings: amount
    }));

    // Ratings distribution
    const ratingDistribution = {};
    ratings.forEach(rating => {
      const stars = rating.rating;
      ratingDistribution[stars] = (ratingDistribution[stars] || 0) + 1;
    });

    const ratingsChartData = Object.entries(ratingDistribution).map(([stars, count]) => ({
      stars: `${stars}★`,
      count
    }));

    // Location analysis
    const locationStats = {};
    trips.forEach(trip => {
      const source = trip.source;
      locationStats[source] = (locationStats[source] || 0) + 1;
    });

    const locationChartData = Object.entries(locationStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([location, count]) => ({
        location,
        trips: count
      }));

    // Time distribution
    const timeDistribution = {};
    trips.forEach(trip => {
      const hour = trip.createdAt.getHours();
      const timeSlot = hour < 6 ? 'Night (12-6 AM)' :
                      hour < 12 ? 'Morning (6-12 PM)' :
                      hour < 18 ? 'Afternoon (12-6 PM)' : 'Evening (6-12 AM)';
      timeDistribution[timeSlot] = (timeDistribution[timeSlot] || 0) + 1;
    });

    const timeChartData = Object.entries(timeDistribution).map(([timeSlot, count]) => ({
      timeSlot,
      trips: count
    }));

    return {
      trips: tripsChartData,
      earnings: earningsChartData,
      ratings: ratingsChartData,
      locations: locationChartData,
      timeDistribution: timeChartData
    };
  };

  // Calculate summary statistics
  const calculateSummaryStats = () => {
    const { trips, earnings, ratings } = analyticsData;
    
    const totalTrips = trips.reduce((sum, item) => sum + item.trips, 0);
    const totalEarnings = earnings.reduce((sum, item) => sum + item.earnings, 0);
    const averageRating = ratings.length > 0 
      ? ratings.reduce((sum, item) => sum + (parseInt(item.stars) * item.count), 0) / 
        ratings.reduce((sum, item) => sum + item.count, 0)
      : 0;

    return {
      totalTrips,
      totalEarnings,
      averageRating: averageRating.toFixed(1),
      totalRatings: ratings.reduce((sum, item) => sum + item.count, 0)
    };
  };

  const summaryStats = calculateSummaryStats();

  // Chart colors
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Analytics Dashboard</h2>
          <p className="text-gray-600">Your {userType} performance insights</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Trips</p>
              <p className="text-2xl font-bold text-gray-800">{summaryStats.totalTrips}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Car className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {userType === 'pilot' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Earnings</p>
                <p className="text-2xl font-bold text-gray-800">₹{summaryStats.totalEarnings}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        )}

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Rating</p>
              <p className="text-2xl font-bold text-gray-800">{summaryStats.averageRating}★</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Star className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Ratings</p>
              <p className="text-2xl font-bold text-gray-800">{summaryStats.totalRatings}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trips Over Time */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Trips Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analyticsData.trips}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="trips" 
                stroke="#3B82F6" 
                strokeWidth={2}
                dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Earnings Over Time (Pilots only) */}
        {userType === 'pilot' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Earnings Over Time</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={analyticsData.earnings}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="earnings" 
                  stroke="#10B981" 
                  fill="#10B981"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Rating Distribution */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Rating Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analyticsData.ratings}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ stars, percent }) => `${stars} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {analyticsData.ratings.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top Locations */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Pickup Locations</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.locations}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="location" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="trips" fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Time Distribution */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Trip Time Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.timeDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timeSlot" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="trips" fill="#F59E0B" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Insights */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Key Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">Peak Hours</h4>
            <p className="text-blue-700">
              {analyticsData.timeDistribution.length > 0 
                ? analyticsData.timeDistribution.reduce((max, item) => 
                    item.trips > max.trips ? item : max
                  ).timeSlot
                : 'No data available'
              }
            </p>
          </div>
          
          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="font-semibold text-green-800 mb-2">Most Popular Route</h4>
            <p className="text-green-700">
              {analyticsData.locations.length > 0 
                ? analyticsData.locations[0].location
                : 'No data available'
              }
            </p>
          </div>
          
          <div className="p-4 bg-yellow-50 rounded-lg">
            <h4 className="font-semibold text-yellow-800 mb-2">Average Daily Trips</h4>
            <p className="text-yellow-700">
              {summaryStats.totalTrips > 0 
                ? (summaryStats.totalTrips / parseInt(dateRange)).toFixed(1)
                : '0'
              } trips per day
            </p>
          </div>
          
          <div className="p-4 bg-purple-50 rounded-lg">
            <h4 className="font-semibold text-purple-800 mb-2">Customer Satisfaction</h4>
            <p className="text-purple-700">
              {summaryStats.averageRating}★ average rating from {summaryStats.totalRatings} reviews
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
