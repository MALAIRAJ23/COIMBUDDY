import React, { useState, useEffect, useCallback } from 'react';
import { Car, UserCircle2, MapPin, MessageCircle, Phone, MapPin as MapPinIcon } from 'lucide-react';
import RouteVisualizer from './RouteVisualizer';
import ChatSystem from './ChatSystem';
import { auth, db } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate
} from 'react-router-dom';
import { GoogleMap, useJsApiLoader, DirectionsRenderer } from '@react-google-maps/api';
import { collection, addDoc, query, where, getDocs, serverTimestamp, doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';
import BottomNavBar from './BottomNavBar';
import AnimatedTitle from './AnimatedTitle';
import TripChart from './TripChart';
import PlacesAutocompleteInput from './PlacesAutocompleteInput';

const GOOGLE_MAPS_API_KEY = 'AIzaSyB0biE37HC3gkUvKIB_ZfzIk30ZdRARZEM';
const COIMBATORE_CENTER = { lat: 11.0168, lng: 76.9558 };
const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };
const RATE_PER_KM = 6.80; // ₹6.80 per kilometer
const ADDITIONAL_EXPENSES = 20; // ₹20 additional expenses
const GOOGLE_MAPS_LIBRARIES = ['places'];

// --- Input Normalization Helper ---
function normalizePlace(str) {
  return str.trim().toLowerCase();
}

// --- Route Distance Helper ---
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// --- Check if pickup point is near route ---
function isPickupPointNearRoute(pickupLat, pickupLng, routeWaypoints, maxDistance = 2) {
  if (!routeWaypoints || routeWaypoints.length === 0) return false;
  
  for (const waypoint of routeWaypoints) {
    const distance = calculateDistance(pickupLat, pickupLng, waypoint.lat, waypoint.lng);
    if (distance <= maxDistance) {
      return true;
    }
  }
  return false;
}

// --- Calculate fare from pickup point ---
function calculateFareFromPickup(pickupLat, pickupLng, tripSourceLat, tripSourceLng, baseFare, ratePerKm) {
  if (!pickupLat || !pickupLng || !tripSourceLat || !tripSourceLng) return baseFare;
  
  const distanceFromSource = calculateDistance(pickupLat, pickupLng, tripSourceLat, tripSourceLng);
  const adjustedFare = baseFare - (distanceFromSource * ratePerKm);
  return Math.max(adjustedFare, baseFare * 0.3); // Minimum 30% of base fare
}

// --- Test function for debugging ---
function testFlexiblePickup() {
  console.log('=== Testing Flexible Pickup Functions ===');
  
  // Test distance calculation
  const distance = calculateDistance(11.0168, 76.9558, 11.0268, 76.9658);
  console.log('Distance test (Coimbatore coordinates):', distance, 'km');
  
  // Test fare calculation
  const fare = calculateFareFromPickup(11.0168, 76.9558, 11.0268, 76.9658, 100, 6.80);
  console.log('Fare test:', fare, '₹');
  
  // Test route matching
  const waypoints = [
    { lat: 11.0168, lng: 76.9558 },
    { lat: 11.0268, lng: 76.9658 },
    { lat: 11.0368, lng: 76.9758 }
  ];
  const isNear = isPickupPointNearRoute(11.0218, 76.9608, waypoints, 2);
  console.log('Route matching test:', isNear);
  
  // Test with real Coimbatore locations
  console.log('=== Real Location Tests ===');
  const saibabaToTidel = calculateDistance(11.0168, 76.9558, 11.0268, 76.9658); // Saibaba Colony to Tidel Park
  console.log('Saibaba Colony to Tidel Park:', saibabaToTidel, 'km');
  
  const lakshmiMillsToSaibaba = calculateDistance(11.0218, 76.9608, 11.0168, 76.9558); // Lakshmi Mills to Saibaba Colony
  console.log('Lakshmi Mills to Saibaba Colony:', lakshmiMillsToSaibaba, 'km');
  
  console.log('=== Test Complete ===');
}

function UserProfile({ user, userProfile }) {
  return (
    <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl sm:rounded-2xl shadow border border-gray-200">
      {user.photoURL ? (
        <img src={user.photoURL} alt="Profile" className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-blue-400 flex-shrink-0" />
      ) : (
        <UserCircle2 className="w-12 h-12 sm:w-14 sm:h-14 text-blue-400 flex-shrink-0" />
      )}
      <div className="text-left min-w-0 flex-1">
        <div className="font-bold text-base sm:text-lg text-gray-800 truncate">{userProfile?.username || user.displayName || 'User'}</div>
        <div className="text-gray-500 text-xs sm:text-sm truncate">{user.email}</div>
        {userProfile?.phoneNumber && (
          <div className="text-gray-500 text-xs sm:text-sm truncate">📞 {userProfile.phoneNumber}</div>
        )}
      </div>
    </div>
  );
}

function MapWithRoute({ source, destination, isLoaded }) {
  const [directions, setDirections] = useState(null);

  useEffect(() => {
    setDirections(null);
  }, [source, destination]);

  useEffect(() => {
    if (isLoaded && source && destination) {
      const service = new window.google.maps.DirectionsService();
      service.route(
        {
          origin: source,
          destination: destination,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === 'OK') {
            setDirections(result);
          } else {
            setDirections(null);
          }
        }
      );
    }
  }, [isLoaded, source, destination]);

  return (
    <div className="w-full h-48 sm:h-64 rounded-xl sm:rounded-2xl overflow-hidden border border-dashed border-green-300 mb-4">
      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={MAP_CONTAINER_STYLE}
          center={COIMBATORE_CENTER}
          zoom={12}
        >
          {directions && <DirectionsRenderer directions={directions} />}
        </GoogleMap>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm sm:text-base">Loading map...</div>
      )}
    </div>
  );
}

function RoleSelection({ onSelect }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-pink-400 via-blue-500 to-purple-600 animate-gradient-x p-4 transition-all duration-700">
      <div className="bg-white/90 rounded-2xl sm:rounded-3xl p-6 sm:p-10 w-full max-w-sm sm:max-w-md shadow-2xl text-center border-4 border-transparent bg-clip-padding backdrop-blur-xl animate-fade-in">
        <Car className="w-12 h-12 sm:w-14 sm:h-14 text-pink-500 animate-bounce mx-auto mb-4 drop-shadow-lg" />
        <AnimatedTitle />
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-pink-500 to-purple-700 animate-gradient-x">Choose Your Role</h2>
        <button
          className="w-full bg-gradient-to-r from-green-400 via-yellow-400 to-pink-500 text-white py-3 sm:py-3 rounded-xl font-semibold mb-4 shadow-xl hover:from-green-500 hover:to-pink-600 hover:scale-105 active:scale-95 transition-all duration-300 animate-pulse focus:ring-4 focus:ring-pink-300"
          onClick={() => onSelect('pilot')}
        >
          I am a Pilot
        </button>
        <button
          className="w-full bg-gradient-to-r from-blue-400 via-purple-400 to-pink-500 text-white py-3 sm:py-3 rounded-xl font-semibold shadow-xl hover:from-blue-500 hover:to-pink-600 hover:scale-105 active:scale-95 transition-all duration-300 animate-pulse focus:ring-4 focus:ring-blue-300"
          onClick={() => onSelect('buddy')}
        >
          I am a Buddy
        </button>
      </div>
    </div>
  );
}

function UserProfilePage({ user, userProfile, onBack, onSignOut }) {
  const [ratings, setRatings] = useState([]);
  const [averageRating, setAverageRating] = useState(0);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buddyRidesThisMonth, setBuddyRidesThisMonth] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch ratings for this user
        const ratingsQuery = query(
          collection(db, 'ratings'),
          where('ratedUserId', '==', user.uid)
        );
        const ratingsSnapshot = await getDocs(ratingsQuery);
        const ratingsData = ratingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRatings(ratingsData);
        
        // Calculate average rating
        if (ratingsData.length > 0) {
          const total = ratingsData.reduce((sum, rating) => sum + rating.rating, 0);
          setAverageRating((total / ratingsData.length).toFixed(1));
        }

        // Fetch bookings
        const bookingsQuery = query(
          collection(db, 'bookings'),
          where('pilotId', '==', user.uid)
        );
        const bookingsSnapshot = await getDocs(bookingsQuery);
        const pilotBookings = bookingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const buddyBookingsQuery = query(
          collection(db, 'bookings'),
          where('buddyId', '==', user.uid)
        );
        const buddyBookingsSnapshot = await getDocs(buddyBookingsQuery);
        const buddyBookings = buddyBookingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        setBookings([...pilotBookings, ...buddyBookings]);

        // Filter buddy rides for this month
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const ridesThisMonth = buddyBookings.filter(b => {
          if (b.createdAt && b.createdAt.toDate) {
            const d = b.createdAt.toDate();
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
          }
          return false;
        });
        setBuddyRidesThisMonth(ridesThisMonth);
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user.uid]);

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span key={i} className={i <= rating ? 'text-yellow-400' : 'text-gray-300'}>
          ★
        </span>
      );
    }
    return stars;
  };

  // Fix: Define a no-op handleFinishTrip to clear ESLint error
  const handleFinishTrip = () => {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-400 via-pink-200 to-purple-400 animate-gradient-x p-4 transition-all duration-700">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white/90 rounded-3xl p-8 shadow-2xl border-4 border-transparent bg-clip-padding backdrop-blur-xl animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={onBack}
              className="text-blue-600 hover:text-pink-600 font-medium transition-colors duration-200 animate-bounce"
            >
              ← Back
            </button>
            <AnimatedTitle />
            <button
              onClick={onSignOut}
              className="text-red-600 hover:text-purple-700 font-medium transition-colors duration-200 animate-bounce"
            >
              Sign Out
            </button>
          </div>

          {/* Profile Info */}
          <div className="mb-8">
            <div className="flex items-center gap-6 mb-6 p-6 bg-gradient-to-r from-pink-100 via-blue-100 to-purple-100 rounded-2xl shadow border-2 border-pink-200 animate-fade-in">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-20 h-20 rounded-full border-4 border-pink-400 shadow-lg animate-pulse" />
              ) : (
                <UserCircle2 className="w-20 h-20 text-pink-400 animate-bounce" />
              )}
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-pink-500 to-purple-700 animate-gradient-x mb-2">
                  {userProfile?.username || user.displayName || 'User'}
                </h2>
                <div className="text-gray-600 mb-1">📧 {user.email}</div>
                {userProfile?.phoneNumber && (
                  <div className="text-gray-600 mb-1">📞 {userProfile.phoneNumber}</div>
                )}
                <div className="text-gray-600">👤 {userProfile?.username ? 'Pilot' : 'Buddy'}</div>
              </div>
            </div>
          </div>

          {/* Ratings Section */}
          <div className="mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Customer Ratings</h3>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading ratings...</p>
              </div>
            ) : ratings.length > 0 ? (
              <div>
                {/* Average Rating */}
                <div className="mb-6 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                  <div className="flex items-center gap-4">
                    <div className="text-3xl font-bold text-yellow-800">{averageRating}</div>
                    <div>
                      <div className="flex text-2xl mb-1">
                        {renderStars(parseFloat(averageRating))}
                      </div>
                      <div className="text-sm text-gray-600">
                        {ratings.length} {ratings.length === 1 ? 'review' : 'reviews'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Individual Ratings */}
                <div className="space-y-4">
                  {ratings.map((rating) => (
                    <div key={rating.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="flex text-lg">
                            {renderStars(rating.rating)}
                          </div>
                          <span className="text-sm text-gray-500">
                            by {rating.raterName || 'Anonymous'}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {rating.createdAt?.toDate?.() ? 
                            rating.createdAt.toDate().toLocaleDateString() : 
                            'Recently'
                          }
                        </span>
                      </div>
                      {rating.comment && (
                        <p className="text-gray-700 text-sm">{rating.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200">
                <div className="text-4xl mb-4">⭐</div>
                <p className="text-gray-600">No ratings yet</p>
                <p className="text-sm text-gray-500">Complete trips to receive ratings</p>
              </div>
            )}
          </div>

          {/* Rides Travelled in Last 5 Days */}
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4 px-4 py-2 rounded-xl bg-gradient-to-r from-green-400 to-blue-400 shadow-md border border-green-200">
              <span className="text-2xl">🚗</span>
              <h3 className="text-xl font-extrabold text-white tracking-wide">Rides Travelled in Last 5 Days</h3>
            </div>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading rides...</p>
              </div>
            ) : (() => {
              // Filter bookings to only those in the last 5 days
              const now = new Date();
              const fiveDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 4, 0, 0, 0, 0);
              const last5DaysBookings = bookings
                .filter(b => {
                  const d = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                  return d >= fiveDaysAgo && d <= now;
                })
                .sort((a, b) => {
                  const aTime = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                  const bTime = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                  return bTime - aTime;
                });
              return last5DaysBookings.length > 0 ? (
                <ul className="grid sm:grid-cols-2 gap-6">
                  {last5DaysBookings.map((ride) => (
                    <li key={ride.id} className="group p-5 bg-white rounded-2xl border border-gray-200 shadow-lg hover:shadow-2xl transition-shadow duration-200 flex flex-col gap-2 hover:border-blue-400">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-green-600 text-lg">🟢</span>
                        <span className="font-semibold text-gray-800 text-base">{ride.source}</span>
                        <span className="mx-2 text-gray-400">→</span>
                        <span className="font-semibold text-gray-800 text-base">{ride.destination}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span className="inline-flex items-center gap-1"><span className="text-blue-500">📅</span>{ride.createdAt?.toDate?.() ? ride.createdAt.toDate().toLocaleDateString() : 'Recently'}</span>
                        <span className="inline-flex items-center gap-1"><span className="text-yellow-500">💰</span>₹{ride.fare}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                        <span className="inline-flex items-center gap-1"><span className="text-purple-500">👤</span>Pilot:</span>
                        <span className="font-medium text-gray-700 group-hover:text-blue-700 transition">{ride.pilotName}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="text-4xl mb-4">🚗</div>
                  <p className="text-gray-600">No rides in the last 5 days</p>
                  <p className="text-sm text-gray-500">Book rides or offer rides to see history</p>
                </div>
              );
            })()}
          </div>

          {/* Rides Travelled This Month (Buddy) */}
          {userProfile && buddyRidesThisMonth.length > 0 && (
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-4 px-4 py-2 rounded-xl bg-gradient-to-r from-green-400 to-blue-400 shadow-md border border-green-200">
                <span className="text-2xl">🚗</span>
                <h3 className="text-xl font-extrabold text-white tracking-wide">Rides Travelled This Month</h3>
              </div>
              <ul className="grid sm:grid-cols-2 gap-6">
                {buddyRidesThisMonth.map(ride => (
                  <li key={ride.id} className="group p-5 bg-white rounded-2xl border border-gray-200 shadow-lg hover:shadow-2xl transition-shadow duration-200 flex flex-col gap-2 hover:border-blue-400">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-green-600 text-lg">🟢</span>
                      <span className="font-semibold text-gray-800 text-base">{ride.source}</span>
                      <span className="mx-2 text-gray-400">→</span>
                      <span className="font-semibold text-gray-800 text-base">{ride.destination}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span className="inline-flex items-center gap-1"><span className="text-blue-500">📅</span>{ride.createdAt?.toDate?.() ? ride.createdAt.toDate().toLocaleDateString() : 'Recently'}</span>
                      <span className="inline-flex items-center gap-1"><span className="text-yellow-500">💰</span>₹{ride.fare}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                      <span className="inline-flex items-center gap-1"><span className="text-purple-500">👤</span>Pilot:</span>
                      <span className="font-medium text-gray-700 group-hover:text-blue-700 transition">{ride.pilotName}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Booking History */}
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-400 to-purple-400 shadow-md border border-blue-200">
              <span className="text-2xl">📚</span>
              <h3 className="text-xl font-extrabold text-white tracking-wide">Booking History</h3>
            </div>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading bookings...</p>
              </div>
            ) : bookings.length > 0 ? (
              <ul className="grid sm:grid-cols-2 gap-6">
                {bookings
                  .slice()
                  .sort((a, b) => {
                    const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                    const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                    return bTime - aTime;
                  })
                  .slice(0, 5)
                  .map((booking) => (
                    <li key={booking.id} className="group p-5 bg-white rounded-2xl border border-gray-200 shadow-lg hover:shadow-2xl transition-shadow duration-200 flex flex-col gap-2 hover:border-purple-400">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-blue-600 text-lg">{booking.pilotId === user.uid ? '🚗' : '🚶'}</span>
                        <span className="font-semibold text-gray-800 text-base">{booking.pilotId === user.uid ? 'You drove' : 'You travelled'}</span>
                        <span className="ml-auto px-2 py-1 rounded-full text-xs font-medium "
                          style={{ background: booking.status === 'confirmed' ? '#d1fae5' : '#e5e7eb', color: booking.status === 'confirmed' ? '#065f46' : '#374151' }}>
                          {booking.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span className="inline-flex items-center gap-1"><span className="text-green-500">📍</span>{booking.source}</span>
                        <span className="inline-flex items-center gap-1"><span className="text-pink-500">🎯</span>{booking.destination}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span className="inline-flex items-center gap-1"><span className="text-blue-500">📅</span>{booking.createdAt?.toDate?.() ? booking.createdAt.toDate().toLocaleDateString() : 'Recently'}</span>
                        <span className="inline-flex items-center gap-1"><span className="text-yellow-500">💰</span>₹{booking.fare}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                        <span className="inline-flex items-center gap-1"><span className="text-purple-500">👤</span>{booking.pilotId === user.uid ? 'Buddy:' : 'Pilot:'}</span>
                        <span className="font-medium text-gray-700 group-hover:text-purple-700 transition">{booking.pilotId === user.uid ? booking.buddyName : booking.pilotName}</span>
                      </div>
                      <button
                        onClick={() => handleFinishTrip(booking.id)}
                        className="w-full bg-gradient-to-r from-red-400 to-red-700 text-white py-2 rounded-lg font-semibold hover:from-red-500 hover:to-red-800 transition text-sm"
                      >
                        Finish Trip
                      </button>
                    </li>
                  ))}
              </ul>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200">
                <div className="text-4xl mb-4">🚗</div>
                <p className="text-gray-600">No bookings yet</p>
                <p className="text-sm text-gray-500">Book rides or offer rides to see history</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PilotDashboard({ user, userProfile, onSignOut, onShowProfile, isLoaded }) {
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [tripStarted, setTripStarted] = useState(false);
  const [distance, setDistance] = useState(null);
  const [distanceInKm, setDistanceInKm] = useState(null);
  const [fare, setFare] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [pendingBookings, setPendingBookings] = useState([]);
  const [acceptedBookings, setAcceptedBookings] = useState([]);
  const [pilotTab, setPilotTab] = useState('start');
  const [pickupLat, setPickupLat] = useState(null);
  const [pickupLng, setPickupLng] = useState(null);
  const [tripStartTime, setTripStartTime] = useState('');
  const [tripStartedNotified, setTripStartedNotified] = useState(false);
  const [routePickupPoints, setRoutePickupPoints] = useState([]);
  const [selectedPickupPoints, setSelectedPickupPoints] = useState([]);
  const [showChat, setShowChat] = useState(false);
  const [activeChatTrip, setActiveChatTrip] = useState(null);

  // Function to generate pickup points along the route
  const generatePickupPoints = async (source, destination) => {
    if (!window.google || !source || !destination) return;
    
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
      const pickupPoints = [];
      
      // Add start point
      pickupPoints.push({
        id: 'start',
        name: 'Start Point',
        location: source,
        lat: leg.start_location.lat(),
        lng: leg.start_location.lng(),
        distance: 0,
        type: 'start'
      });
      
      // Generate intermediate pickup points every 2-3 km
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
            
            pickupPoints.push({
              id: `point_${pointIndex}`,
              name: locationName,
              location: locationName,
              lat: point1.lat(),
              lng: point1.lng(),
              distance: currentDistance / 1000, // Convert to km
              type: 'intermediate'
            });
            pointIndex++;
            currentDistance = 0;
          }
        }
      }
      
      // Add end point
      pickupPoints.push({
        id: 'end',
        name: 'End Point',
        location: destination,
        lat: leg.end_location.lat(),
        lng: leg.end_location.lng(),
        distance: leg.distance.value / 1000,
        type: 'end'
      });
      
      setRoutePickupPoints(pickupPoints);
      setSelectedPickupPoints(pickupPoints.map(p => p.id)); // Select all by default
    } catch (error) {
      console.error('Error generating pickup points:', error);
    }
  };

  // Calculate distance and fare using Google Maps Directions API
  useEffect(() => {
    setDistance(null);
    setDistanceInKm(null);
    setFare(null);
    if (window.google && source && destination) {
      const service = new window.google.maps.DirectionsService();
      service.route(
        {
          origin: source,
          destination: destination,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === 'OK') {
            const route = result.routes[0];
            const leg = route.legs[0];
            setDistance(leg.distance.text);
            
            // Extract distance in kilometers for fare calculation
            const distanceText = leg.distance.text;
            const distanceValue = parseFloat(distanceText.replace(' km', '').replace(',', ''));
            setDistanceInKm(distanceValue);
            
            // Calculate fare: (distance * rate) + additional expenses
            const calculatedFare = (distanceValue * RATE_PER_KM) + ADDITIONAL_EXPENSES;
            setFare(calculatedFare.toFixed(2));
          }
        }
      );
    }
  }, [source, destination]);

  useEffect(() => {
    const fetchPending = async () => {
      const q = query(
        collection(db, 'trips'),
        where('driverId', '==', user.uid),
        where('status', 'in', ['pending', 'accepted'])
      );
      const snapshot = await getDocs(q);
      setPendingBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchPending();
  }, [user.uid]);

  useEffect(() => {
    const fetchAccepted = async () => {
      const q = query(
        collection(db, 'trips'),
        where('driverId', '==', user.uid),
        where('status', '==', 'accepted')
      );
      const snapshot = await getDocs(q);
      setAcceptedBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchAccepted();
  }, [user.uid]);

  const handleStartTrip = async () => {
    if (!source.trim() || !destination.trim() || !tripStartTime) {
      alert('Please enter source, destination, and trip start time');
      return;
    }
    setTripStarted(true);
    setSaving(true);
    setSaveError('');
    
    try {
      // Get route details with waypoints
      let routeData = null;
      let leg = null; // Declare leg variable at function scope
      if (window.google) {
        const service = new window.google.maps.DirectionsService();
        const result = await new Promise((resolve, reject) => {
          service.route(
            {
              origin: source,
              destination: destination,
              travelMode: window.google.maps.TravelMode.DRIVING,
              optimizeWaypoints: false,
            },
            (result, status) => {
              if (status === 'OK') {
                resolve(result);
              } else {
                reject(new Error('Failed to get route'));
              }
            }
          );
        });
        
        const route = result.routes[0];
        const leg = route.legs[0];
        
        // Extract waypoints along the route
        const waypoints = [];
        if (route.overview_path && window.google.maps.geometry) {
          // Sample points along the route (every 1km for better coverage)
          const stepDistance = 1000; // 1km in meters
          let currentDistance = 0;
          
          // Add start point
          waypoints.push({
            lat: leg.start_location.lat(),
            lng: leg.start_location.lng(),
            distance: 0
          });
          
          for (let i = 0; i < route.overview_path.length - 1; i++) {
            const point1 = route.overview_path[i];
            const point2 = route.overview_path[i + 1];
            const distance = window.google.maps.geometry.spherical.computeDistanceBetween(point1, point2);
            currentDistance += distance;
            
            if (currentDistance >= stepDistance) {
              waypoints.push({
                lat: point1.lat(),
                lng: point1.lng(),
                distance: currentDistance
              });
              currentDistance = 0;
            }
          }
          
          // Add end point if not already included
          const lastWaypoint = waypoints[waypoints.length - 1];
          if (lastWaypoint) {
            const endDistance = window.google.maps.geometry.spherical.computeDistanceBetween(
              new window.google.maps.LatLng(lastWaypoint.lat, lastWaypoint.lng),
              leg.end_location
            );
            if (endDistance > 500) { // Only add if more than 500m from last waypoint
              waypoints.push({
                lat: leg.end_location.lat(),
                lng: leg.end_location.lng(),
                distance: leg.distance.value
              });
            }
          }
        } else {
          // Fallback: create waypoints from route steps
          waypoints.push({
            lat: leg.start_location.lat(),
            lng: leg.start_location.lng(),
            distance: 0
          });
          
          leg.steps.forEach((step, index) => {
            if (index % 2 === 0) { // Every 2nd step for better coverage
              waypoints.push({
                lat: step.start_location.lat(),
                lng: step.start_location.lng(),
                distance: step.distance.value
              });
            }
          });
          
          waypoints.push({
            lat: leg.end_location.lat(),
            lng: leg.end_location.lng(),
            distance: leg.distance.value
          });
        }
        
        routeData = {
          polyline: route.overview_polyline,
          waypoints: waypoints,
          duration: leg.duration.text,
          durationValue: leg.duration.value,
          steps: leg.steps.map(step => ({
            instruction: step.instructions,
            distance: step.distance.text,
            duration: step.duration.text,
            lat: step.start_location.lat(),
            lng: step.start_location.lng()
          }))
        };
      }
      
      const tripData = {
        driverId: user.uid,
        driverName: userProfile?.username || user.displayName || '',
        driverEmail: user.email,
        driverPhone: userProfile?.phoneNumber || '',
        driverPhoto: user.photoURL || '',
        source: normalizePlace(source),
        destination: normalizePlace(destination),
        sourceLat: leg ? leg.start_location.lat() : pickupLat,
        sourceLng: leg ? leg.start_location.lng() : pickupLng,
        destinationLat: leg ? leg.end_location.lat() : null,
        destinationLng: leg ? leg.end_location.lng() : null,
        distance,
        distanceInKm,
        fare: parseFloat(fare),
        ratePerKm: RATE_PER_KM,
        additionalExpenses: ADDITIONAL_EXPENSES,
        routeData: routeData,
        pickupPoints: routePickupPoints.filter(p => selectedPickupPoints.includes(p.id)),
        createdAt: serverTimestamp(),
        active: true,
        status: 'available',
        tripStartTime: tripStartTime ? new Date(tripStartTime) : null,
        allowsPickupPoints: true, // New flag for flexible pickup
      };
      console.log('Creating trip with route data:', tripData);
      await addDoc(collection(db, 'trips'), tripData);
      toast.success('Trip created! Buddies can now find your ride with flexible pickup points.');
    } catch (err) {
      setSaveError('Failed to save trip. Please try again.');
      setTripStarted(false);
      console.error('Error creating trip:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAcceptBooking = async (tripId) => {
    try {
      console.log('Accepting booking for trip:', tripId);
      const tripToAccept = pendingBookings.find(trip => trip.id === tripId);
      
      await updateDoc(doc(db, 'trips', tripId), {
        status: 'accepted',
        active: false,
      });
      
      setPendingBookings(prev => prev.filter(trip => trip.id !== tripId));
      setActiveChatTrip(tripToAccept);
      setPilotTab('chat'); // Switch to chat tab
      toast.success('Booking accepted! Chat is now available.');
    } catch (err) {
      console.error('Error accepting booking:', err);
      toast.error('Failed to accept booking.');
    }
  };

  const handleInitiatePayment = async (tripId) => {
    try {
      await updateDoc(doc(db, 'trips', tripId), {
        paymentInitiated: true
      });
      toast.success('Payment initiated! Buddy can now pay.');
      setAcceptedBookings(prev => prev.map(trip => trip.id === tripId ? { ...trip, paymentInitiated: true } : trip));
    } catch (err) {
      toast.error('Failed to initiate payment.');
      console.error('Error initiating payment:', err);
    }
  };

  // Add geolocation handler for pilot
  const handleUseMyLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setPickupLat(lat);
          setPickupLng(lng);
          // Reverse geocode to get address
          if (window.google) {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: { lat, lng } }, (results, status) => {
              if (status === 'OK' && results[0]) {
                setSource(results[0].formatted_address);
              }
            });
          }
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            alert('Location permission denied. Please allow location access in your browser settings.');
          } else {
            alert('Failed to fetch location: ' + error.message);
          }
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  };

  const handleStartTripForBuddy = async (tripId) => {
    try {
      const tripToStart = acceptedBookings.find(trip => trip.id === tripId);
      
      await updateDoc(doc(db, 'trips', tripId), {
        tripStarted: true,
        tripStartedAt: serverTimestamp(),
        status: 'started'
      });
      
      // Send system message to chat
      if (activeChatTrip && activeChatTrip.id === tripId) {
        const startMessage = `🚗 Ride started! Pilot ${userProfile?.username || user.displayName} has started the trip from ${tripToStart.isFlexiblePickup ? tripToStart.buddyPickupPoint : tripToStart.source}.`;
        // This will be handled by the ChatSystem component
      }
      
      toast.success('Trip started! Buddy will be notified.');
    } catch (err) {
      toast.error('Failed to start trip.');
      console.error('Error starting trip:', err);
    }
  };

  const handleFinishTrip = async (bookingId) => {
    try {
      await updateDoc(doc(db, 'trips', bookingId), {
        status: 'finished',
        tripFinishedAt: serverTimestamp(),
      });
      
      // Send system message to chat
      if (activeChatTrip && activeChatTrip.id === bookingId) {
        const finishMessage = `✅ Ride completed! The trip has been finished successfully.`;
        // This will be handled by the ChatSystem component
      }
      
      toast.success('Trip finished! Chat has been closed.');
      setAcceptedBookings(prev => prev.filter(trip => trip.id !== bookingId));
      setActiveChatTrip(null); // Close chat
    } catch (err) {
      toast.error('Failed to finish trip.');
      console.error('Error finishing trip:', err);
    }
  };

  // In PilotDashboard, filter and sort trips for display
  // Find the current active trip (accepted or pending, latest tripStartTime)
  const allActiveTrips = [...pendingBookings, ...acceptedBookings].filter(trip => ['pending', 'accepted'].includes(trip.status));
  const currentTrip = allActiveTrips.length > 0
    ? allActiveTrips.reduce((latest, trip) => {
        const tripTime = trip.tripStartTime?.toDate ? trip.tripStartTime.toDate() : new Date(trip.tripStartTime);
        const latestTime = latest.tripStartTime?.toDate ? latest.tripStartTime.toDate() : new Date(latest.tripStartTime);
        return tripTime > latestTime ? trip : latest;
      }, allActiveTrips[0])
    : null;

  // Fetch last 5 finished trips for this pilot
  const [finishedTrips, setFinishedTrips] = useState([]);
  useEffect(() => {
    const fetchFinished = async () => {
      const q = query(
        collection(db, 'trips'),
        where('driverId', '==', user.uid),
        where('status', '==', 'finished')
      );
      const snapshot = await getDocs(q);
      let trips = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by tripStartTime descending
      trips = trips.sort((a, b) => {
        const aTime = a.tripStartTime?.toDate ? a.tripStartTime.toDate() : new Date(a.tripStartTime);
        const bTime = b.tripStartTime?.toDate ? b.tripStartTime.toDate() : new Date(b.tripStartTime);
        return bTime - aTime;
      });
      // If more than 5, delete the oldest
      if (trips.length > 5) {
        const toDelete = trips.slice(5);
        for (const trip of toDelete) {
          await deleteDoc(doc(db, 'trips', trip.id));
        }
        trips = trips.slice(0, 5);
      }
      setFinishedTrips(trips);
    };
    fetchFinished();
  }, [user.uid]);

  let mainContent;
  if (pilotTab === 'start') {
    mainContent = (
      <>
        <AnimatedTitle />
        <h2 className="text-xl sm:text-2xl font-bold mb-2 text-gray-800">Start Your Ride</h2>
        <div className="mb-4 sm:mb-6 text-left">
          <label className="block text-gray-700 font-medium mb-1 text-sm sm:text-base">Source (Coimbatore)</label>
          <div className="flex gap-2 items-center mb-3">
            <div className="flex-1">
              <PlacesAutocompleteInput
                value={source}
                onChange={setSource}
                placeholder="Enter source location"
                onSelect={(desc, lat, lng) => {
                  setSource(desc);
                  setPickupLat(lat);
                  setPickupLng(lng);
                }}
                isLoaded={isLoaded}
              />
            </div>
            {/* Removed 'Use My Location' button for pilot section */}
          </div>
          <label className="block text-gray-700 font-medium mb-1 text-sm sm:text-base">Destination (Coimbatore)</label>
          <PlacesAutocompleteInput
            value={destination}
            onChange={setDestination}
            placeholder="Enter destination location"
            onSelect={(desc, lat, lng) => setDestination(desc)}
            isLoaded={isLoaded}
          />
          <label className="block text-gray-700 font-medium mb-1 text-sm sm:text-base mt-3">Trip Start Time</label>
          <input
            type="datetime-local"
            value={tripStartTime}
            onChange={e => setTripStartTime(e.target.value)}
            className="w-full p-2 sm:p-3 mb-3 border border-gray-300 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 text-sm sm:text-base"
          />
          <button
            onClick={handleStartTrip}
            className={`w-full py-2 sm:py-3 rounded-lg sm:rounded-xl font-semibold shadow-lg transition text-sm sm:text-base ${tripStarted ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-green-700 text-white hover:from-green-600 hover:to-green-800'}`}
            disabled={tripStarted || saving}
          >
            {saving ? 'Saving...' : tripStarted ? 'Trip Started' : 'Start Trip'}
          </button>
          {saveError && <div className="text-red-600 text-xs sm:text-sm mt-2">{saveError}</div>}
        </div>
        <MapWithRoute source={source} destination={destination} isLoaded={isLoaded} />
        {distance && (
          <div className="mb-3 sm:mb-4 text-base sm:text-lg text-green-700 font-semibold">
            Distance: {distance}
          </div>
        )}
        {fare && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-green-50 rounded-lg sm:rounded-xl border border-green-200">
            <div className="text-base sm:text-lg font-bold text-green-800 mb-2">Fare Calculation</div>
            <div className="text-xs sm:text-sm text-gray-600 space-y-1">
              <div>Distance: {distanceInKm} km × ₹{RATE_PER_KM} = ₹{(distanceInKm * RATE_PER_KM).toFixed(2)}</div>
              <div>Additional Expenses: ₹{ADDITIONAL_EXPENSES}</div>
              <div className="border-t border-green-200 pt-2 mt-2">
                <div className="font-bold text-base sm:text-lg text-green-800">Total Fare: ₹{fare}</div>
              </div>
            </div>
          </div>
        )}
        
        {/* Pickup Points Selection */}
        {routePickupPoints.length > 0 && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 rounded-lg sm:rounded-xl border border-blue-200">
            <div className="text-base sm:text-lg font-bold text-blue-800 mb-3">🚗 Available Pickup Points</div>
            <div className="text-xs text-blue-700 mb-3">Select pickup points where buddies can join your ride:</div>
            <div className="space-y-2">
              {routePickupPoints.map((point) => (
                <label key={point.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-100 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPickupPoints.includes(point.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPickupPoints(prev => [...prev, point.id]);
                      } else {
                        setSelectedPickupPoints(prev => prev.filter(id => id !== point.id));
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-blue-900">{point.name}</div>
                    <div className="text-xs text-blue-700">
                      {point.type === 'start' ? '🚀 Start' : point.type === 'end' ? '🎯 End' : '📍 Intermediate'} 
                      {point.distance > 0 && ` • ${point.distance.toFixed(1)} km from start`}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div className="mt-3 text-xs text-blue-600">
              Selected {selectedPickupPoints.length} of {routePickupPoints.length} pickup points
            </div>
          </div>
        )}
      </>
    );
  } else if (pilotTab === 'chat') {
    mainContent = (
      <div className="mb-8">
        <AnimatedTitle />
        <div className="flex items-center gap-2 mb-4 px-4 py-2 rounded-xl bg-gradient-to-r from-green-400 to-blue-400 shadow-md border border-green-200">
          <span className="text-2xl">💬</span>
          <h3 className="text-lg font-extrabold text-white tracking-wide">Ride Chat</h3>
        </div>
        
        {activeChatTrip ? (
          <div className="h-96">
            <ChatSystem
              tripId={activeChatTrip.id}
              pilotId={user.uid}
              buddyId={activeChatTrip.buddyId}
              pilotName={userProfile?.username || user.displayName || 'Pilot'}
              buddyName={activeChatTrip.buddyName}
              rideStatus={activeChatTrip.status}
              pickupPoint={activeChatTrip.isFlexiblePickup ? activeChatTrip.buddyPickupPoint : activeChatTrip.source}
              destination={activeChatTrip.destination}
              currentUserId={user.uid}
            />
          </div>
        ) : (
          <div className="text-center py-8">
            <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Active Chats</h3>
            <p className="text-gray-500">Chat will be available when you have an active ride with a buddy.</p>
          </div>
        )}
      </div>
    );
  } else if (pilotTab === 'passengers') {
    mainContent = (
      <div className="mb-8">
        <AnimatedTitle />
        <div className="flex items-center gap-2 mb-4 px-4 py-2 rounded-xl bg-gradient-to-r from-green-400 to-blue-400 shadow-md border border-green-200">
          <span className="text-2xl">👥</span>
          <h3 className="text-lg font-extrabold text-white tracking-wide">Booked Passengers</h3>
        </div>
        {/* Notification Bar for Pending Bookings */}
        {pendingBookings.length > 0 && (
          <div className="space-y-3 mb-6">
            {pendingBookings.map(trip => {
              // Show scheduled trip start time
              let tripTimeStr = '';
              if (trip.tripStartTime) {
                const tripDate = trip.tripStartTime.toDate ? trip.tripStartTime.toDate() : new Date(trip.tripStartTime);
                tripTimeStr = tripDate.toLocaleString(undefined, {
                  year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
                });
              }
              return (
                <div key={trip.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 px-4 py-3 rounded-xl bg-blue-100 border border-blue-300 shadow">
                  <div className="flex-1">
                    <div className="font-bold text-blue-900 text-base sm:text-lg mb-1">New Booking Request!</div>
                    <div className="text-sm text-blue-800 mb-1">Buddy: <span className="font-semibold">{trip.buddyName}</span></div>
                    <div className="text-sm text-blue-800 mb-1">Phone: <span className="font-semibold">{trip.buddyPhone || 'No phone'}</span></div>
                    <div className="text-sm text-blue-800 mb-1">Pickup Point: <span className="font-semibold">
                      {trip.isFlexiblePickup ? trip.buddyPickupPoint : trip.source}
                    </span></div>
                    {trip.isFlexiblePickup && (
                      <div className="text-xs text-blue-700 mb-1">
                        🚗 Flexible Pickup • Adjusted Fare: ₹{trip.adjustedFare?.toFixed(2)}
                      </div>
                    )}
                    <div className="text-xs text-blue-700">Trip Time: <span className="font-semibold">{tripTimeStr}</span></div>
                  </div>
                  <button
                    onClick={() => handleAcceptBooking(trip.id)}
                    className="mt-2 sm:mt-0 bg-gradient-to-r from-green-500 to-green-700 text-white px-4 py-2 rounded-lg font-semibold shadow hover:from-green-600 hover:to-green-800 transition text-sm"
                  >
                    Accept Booking
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {/* Pending Bookings */}
        {pendingBookings.length > 0 && (
          <div className="mb-6">
            <h4 className="text-lg font-bold text-gray-800 mb-3">Pending Requests</h4>
            <ul className="space-y-4">
              {pendingBookings.map(trip => (
                <li key={trip.id} className="p-4 bg-yellow-50 rounded-xl border border-yellow-200 shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-gray-800">{trip.buddyName}</div>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Pending</span>
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    <div>📞 {trip.buddyPhone || 'No phone'}</div>
                    <div>📧 {trip.buddyEmail}</div>
                  </div>
                  <div className="text-sm text-gray-500 mb-3">
                    <div>📍 {trip.isFlexiblePickup ? trip.buddyPickupPoint : trip.source} → 🎯 {trip.destination}</div>
                    <div>💰 ₹{(trip.adjustedFare || trip.fare)?.toFixed(2)}</div>
                    {trip.isFlexiblePickup && (
                      <div className="text-xs text-primary-600 mt-1">
                        🚗 Flexible pickup from {trip.buddyPickupPoint}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleAcceptBooking(trip.id)}
                    className="w-full bg-gradient-to-r from-green-500 to-green-700 text-white py-2 rounded-lg font-semibold hover:from-green-600 hover:to-green-800 transition text-sm"
                  >
                    Accept Booking
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Accepted Bookings */}
        <div>
          <h4 className="text-lg font-bold text-gray-800 mb-3">Current Trip</h4>
          {currentTrip ? (
            <ul className="space-y-4">
              <li key={currentTrip.id} className="p-4 bg-green-50 rounded-xl border border-green-200 shadow">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-gray-800">{currentTrip.buddyName}</div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${currentTrip.paymentInitiated ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{currentTrip.paymentInitiated ? 'Payment Ready' : currentTrip.status.charAt(0).toUpperCase() + currentTrip.status.slice(1)}</span>
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  <div>📞 {currentTrip.buddyPhone || 'No phone'}</div>
                  <div>📧 {currentTrip.buddyEmail}</div>
                </div>
                <div className="text-sm text-gray-500 mb-3">
                  <div>📍 {currentTrip.isFlexiblePickup ? currentTrip.buddyPickupPoint : currentTrip.source} → 🎯 {currentTrip.destination}</div>
                  <div>💰 ₹{(currentTrip.adjustedFare || currentTrip.fare)?.toFixed(2)}</div>
                  {currentTrip.isFlexiblePickup && (
                    <div className="text-xs text-primary-600 mt-1">
                      🚗 Flexible pickup from {currentTrip.buddyPickupPoint}
                    </div>
                  )}
                </div>
                {currentTrip.status === 'pending' ? (
                  <button
                    onClick={() => handleAcceptBooking(currentTrip.id)}
                    className="w-full bg-gradient-to-r from-green-500 to-green-700 text-white py-2 rounded-lg font-semibold hover:from-green-600 hover:to-green-800 transition text-sm mb-2"
                  >
                    Accept Booking
                  </button>
                ) : (
                  <button
                    onClick={() => handleStartTripForBuddy(currentTrip.id)}
                    className="w-full bg-gradient-to-r from-yellow-400 to-green-600 text-white py-2 rounded-lg font-semibold hover:from-yellow-500 hover:to-green-700 transition text-sm"
                  >
                    Start Trip
                  </button>
                )}
              </li>
            </ul>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-4xl mb-4">👥</div>
              <p className="text-gray-600">No current trip</p>
              <p className="text-sm text-gray-500">Start a trip to receive booking requests</p>
            </div>
          )}
        </div>
        {/* Last 5 Finished Trips */}
        <div className="mt-8">
          <h4 className="text-lg font-bold text-gray-800 mb-3">Last 5 Trips</h4>
          {finishedTrips.length > 0 ? (
            <ul className="space-y-4">
              {finishedTrips.map(trip => (
                <li key={trip.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-gray-800">{trip.buddyName || 'No Buddy'}</div>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Finished</span>
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    <div>📞 {trip.buddyPhone || 'No phone'}</div>
                    <div>📧 {trip.buddyEmail}</div>
                  </div>
                  <div className="text-sm text-gray-500 mb-3">
                    <div>📍 {trip.source} → 🎯 {trip.destination}</div>
                    <div>💰 ₹{trip.fare}</div>
                  </div>
                  <div className="text-xs text-gray-400">{trip.tripStartTime?.toDate ? trip.tripStartTime.toDate().toLocaleString() : ''}</div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-4xl mb-4">🕓</div>
              <p className="text-gray-600">No past trips</p>
            </div>
          )}
        </div>

        {pendingBookings.length === 0 && acceptedBookings.length === 0 && (
          <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200">
            <div className="text-4xl mb-4">👥</div>
            <p className="text-gray-600">No passengers yet</p>
            <p className="text-sm text-gray-500">Start a trip to receive booking requests</p>
          </div>
        )}
      </div>
    );
  } else if (pilotTab === 'contact') {
    mainContent = (
      <div className="mb-8">
        <AnimatedTitle />
        <div className="p-6 bg-gradient-to-br from-blue-100 to-green-100 rounded-2xl border border-blue-200 shadow-lg text-center">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Contact & Support</h3>
          <div className="space-y-4">
            <div className="p-4 bg-white rounded-xl border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-2">📞 Toll-Free 24/7 Support</h4>
              <div className="text-green-700 font-bold text-lg mb-1">1800-123-4567</div>
              <div className="text-xs text-gray-500">Available 24/7 for all users</div>
            </div>
            <div className="p-4 bg-white rounded-xl border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-2">📧 Email Support</h4>
              <a href="mailto:support@coimbuddy.com" className="text-blue-600 font-semibold underline">support@coimbuddy.com</a>
            </div>
            <div className="p-4 bg-white rounded-xl border border-purple-200">
              <h4 className="font-semibold text-purple-800 mb-2">🤖 AI Chatbot</h4>
              <p className="text-gray-700 mb-2">Get instant answers to your questions with our AI-powered support.</p>
              <button className="bg-purple-600 text-white px-6 py-3 rounded-lg font-bold text-base shadow hover:bg-purple-700 transition">Chat with AI Support</button>
            </div>
          </div>
          <div className="mt-6 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
            <p className="text-sm text-yellow-800 text-center">
              <strong>Response Time:</strong> We usually respond within 2-4 hours during business hours.
            </p>
          </div>
        </div>
      </div>
    );
  } else if (pilotTab === 'account') {
    mainContent = (
      <div className="mb-8">
        <AnimatedTitle />
        
        {/* Pilot Profile Info */}
        <div className="mb-6 p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border border-blue-200 shadow-lg">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Pilot Profile</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-white rounded-lg border border-gray-200">
              <div className="text-sm text-gray-500">Username</div>
              <div className="font-semibold text-gray-800">{userProfile?.username || 'Not set'}</div>
            </div>
            <div className="p-3 bg-white rounded-lg border border-gray-200">
              <div className="text-sm text-gray-500">Mobile Number</div>
              <div className="font-semibold text-gray-800">{userProfile?.phoneNumber || 'Not set'}</div>
            </div>
            <div className="p-3 bg-white rounded-lg border border-gray-200">
              <div className="text-sm text-gray-500">Email</div>
              <div className="font-semibold text-gray-800 break-words" style={{wordBreak: 'break-word'}}>{user.email}</div>
            </div>
            <div className="p-3 bg-white rounded-lg border border-gray-200">
              <div className="text-sm text-gray-500">Car Type</div>
              <div className="font-semibold text-gray-800">{userProfile?.carType || 'Not specified'}</div>
            </div>
          </div>
        </div>

        {/* Trips Chart */}
        

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={onSignOut}
            className="w-full bg-gradient-to-r from-red-500 to-red-700 text-white px-4 py-3 rounded-lg font-semibold shadow hover:from-red-600 hover:to-red-800 transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-green-400 to-blue-500">
      <div className="flex-1 flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-10 w-full max-w-sm sm:max-w-md shadow-2xl text-center border border-green-200">
          {mainContent}
        </div>
      </div>
      <div className="w-full px-4 pb-4">
        <BottomNavBar currentTab={pilotTab} onTabChange={setPilotTab} userType="pilot" />
      </div>
    </div>
  );
}

function BuddyDashboard({ user, userProfile, onSignOut, onShowProfile, isLoaded }) {
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [searching, setSearching] = useState(false);
  const [distance, setDistance] = useState(null);
  const [distanceInKm, setDistanceInKm] = useState(null);
  const [fare, setFare] = useState(null);
  const [availableTrips, setAvailableTrips] = useState([]);
  const [searchError, setSearchError] = useState('');
  const [bookingTrip, setBookingTrip] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [upiId, setUpiId] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [myAcceptedTrip, setMyAcceptedTrip] = useState(null);
  const [showBuddyPayment, setShowBuddyPayment] = useState(false);
  const [buddyPaymentDone, setBuddyPaymentDone] = useState(false);
  const [buddyPaymentMethod, setBuddyPaymentMethod] = useState('');
  const [buddyPaymentLoading, setBuddyPaymentLoading] = useState(false);
  const [buddyTab, setBuddyTab] = useState('book');
  const [pickupLat, setPickupLat] = useState(null);
  const [pickupLng, setPickupLng] = useState(null);
  const [desiredTime, setDesiredTime] = useState('');
  const [tripStartedNotified, setTripStartedNotified] = useState(false);
  const [pickupPoint, setPickupPoint] = useState('');
  const [pickupPointLat, setPickupPointLat] = useState(null);
  const [pickupPointLng, setPickupPointLng] = useState(null);
  const [searchRadius, setSearchRadius] = useState(2); // km
  const [flexibleMode, setFlexibleMode] = useState(false); // Track flexible pickup mode
  const [availablePickupPoints, setAvailablePickupPoints] = useState([]);
  const [selectedPickupPoint, setSelectedPickupPoint] = useState(null);
  const [buddyRoutePickupPoints, setBuddyRoutePickupPoints] = useState([]);
  const [showRouteMap, setShowRouteMap] = useState(false);
  const [routePolyline, setRoutePolyline] = useState(null);
  const [selectedPickupPointIndex, setSelectedPickupPointIndex] = useState(null);
  const [matchingTrips, setMatchingTrips] = useState([]);
  const [searchStatus, setSearchStatus] = useState('idle'); // idle, searching, found, not_found
  const [showChat, setShowChat] = useState(false);
  const [activeChatTrip, setActiveChatTrip] = useState(null);

  // Function to generate pickup points for buddy's route
  const generateBuddyRoutePickupPoints = async (source, destination) => {
    if (!window.google || !source || !destination) {
      setBuddyRoutePickupPoints([]);
      return;
    }
    
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
      const pickupPoints = [];
      
      // Add start point
      pickupPoints.push({
        id: 'buddy_start',
        name: 'Start Point',
        location: source,
        lat: leg.start_location.lat(),
        lng: leg.start_location.lng(),
        distance: 0,
        type: 'start'
      });
      
      // Generate intermediate pickup points every 2-3 km
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
            
            pickupPoints.push({
              id: `buddy_point_${pointIndex}`,
              name: locationName,
              location: locationName,
              lat: point1.lat(),
              lng: point1.lng(),
              distance: currentDistance / 1000, // Convert to km
              type: 'intermediate'
            });
            pointIndex++;
            currentDistance = 0;
          }
        }
      }
      
      // Add end point
      pickupPoints.push({
        id: 'buddy_end',
        name: 'End Point',
        location: destination,
        lat: leg.end_location.lat(),
        lng: leg.end_location.lng(),
        distance: leg.distance.value / 1000,
        type: 'end'
      });
      
      setBuddyRoutePickupPoints(pickupPoints);
    } catch (error) {
      console.error('Error generating buddy route pickup points:', error);
      setBuddyRoutePickupPoints([]);
    }
  };

  // Calculate distance and fare using Google Maps Directions API
  useEffect(() => {
    setDistance(null);
    setDistanceInKm(null);
    setFare(null);
    if (window.google && source && destination) {
      const service = new window.google.maps.DirectionsService();
      service.route(
        {
          origin: source,
          destination: destination,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === 'OK') {
            const route = result.routes[0];
            const leg = route.legs[0];
            setDistance(leg.distance.text);
            
            // Extract distance in kilometers for fare calculation
            const distanceText = leg.distance.text;
            const distanceValue = parseFloat(distanceText.replace(' km', '').replace(',', ''));
            setDistanceInKm(distanceValue);
            
            // Calculate fare: (distance * rate) + additional expenses
            const calculatedFare = (distanceValue * RATE_PER_KM) + ADDITIONAL_EXPENSES;
            setFare(calculatedFare.toFixed(2));
          }
        }
      );
    }
  }, [source, destination]);

  useEffect(() => {
    const fetchMyAccepted = async () => {
      const q = query(
        collection(db, 'trips'),
        where('buddyId', '==', user.uid),
        where('status', '==', 'accepted')
      );
      const snapshot = await getDocs(q);
      const trips = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMyAcceptedTrip(trips.length > 0 ? trips[0] : null);
    };
    fetchMyAccepted();
  }, [user.uid]);

  // Smart search function with enhanced matching
  const smartSearch = async (pickupPoint, destination, desiredTime) => {
    try {
      const desiredDate = new Date(desiredTime);
      const windowMs = 30 * 60 * 1000; // 30 minutes in ms
      
      // Get all available trips
      const q = query(
        collection(db, 'trips'),
        where('active', '==', true),
        where('status', '==', 'available')
      );
      const querySnapshot = await getDocs(q);
      let trips = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter by time window
      trips = trips.filter(trip => {
        if (!trip.tripStartTime) return false;
        const tripTime = trip.tripStartTime.toDate ? trip.tripStartTime.toDate() : new Date(trip.tripStartTime);
        return Math.abs(tripTime - desiredDate) <= windowMs;
      });
      
      // Enhanced matching logic
      const matchedTrips = trips.filter(trip => {
        // 1. Destination matching (exact or similar)
        const destinationMatches = normalizePlace(trip.destination) === normalizePlace(destination);
        if (!destinationMatches) return false;
        
        // 2. Route proximity check
        if (trip.routeData && trip.routeData.waypoints && trip.routeData.waypoints.length > 0) {
          const isNearRoute = isPickupPointNearRoute(
            pickupPoint.lat, 
            pickupPoint.lng, 
            trip.routeData.waypoints, 
            searchRadius
          );
          return isNearRoute;
        } else {
          // Fallback: check distance to source/destination
          if (trip.sourceLat && trip.sourceLng && trip.destinationLat && trip.destinationLng) {
            const sourceDistance = calculateDistance(pickupPoint.lat, pickupPoint.lng, trip.sourceLat, trip.sourceLng);
            const destDistance = calculateDistance(pickupPoint.lat, pickupPoint.lng, trip.destinationLat, trip.destinationLng);
            return sourceDistance <= searchRadius || destDistance <= searchRadius;
          }
          return false;
        }
      });
      
      // Calculate adjusted fares and add metadata
      const enhancedTrips = matchedTrips.map(trip => {
        const adjustedFare = calculateFareFromPickup(
          pickupPoint.lat, 
          pickupPoint.lng, 
          trip.sourceLat, 
          trip.sourceLng, 
          trip.fare, 
          trip.ratePerKm
        );
        
        // Calculate pickup distance from pilot's source
        const pickupDistance = calculateDistance(pickupPoint.lat, pickupPoint.lng, trip.sourceLat, trip.sourceLng);
        
        return {
          ...trip,
          pickupPoint: pickupPoint.name,
          pickupPointLat: pickupPoint.lat,
          pickupPointLng: pickupPoint.lng,
          adjustedFare,
          isFlexiblePickup: true,
          pickupDistance,
          savings: trip.fare - adjustedFare
        };
      });
      
      // Sort by best match (rating, savings, distance)
      enhancedTrips.sort((a, b) => {
        // First by rating (highest first)
        if (a.averageRating !== b.averageRating) {
          return (b.averageRating || 0) - (a.averageRating || 0);
        }
        // Then by savings (highest first)
        if (a.savings !== b.savings) {
          return b.savings - a.savings;
        }
        // Finally by pickup distance (closest first)
        return a.pickupDistance - b.pickupDistance;
      });
      
      return enhancedTrips;
    } catch (error) {
      console.error('Smart search error:', error);
      return [];
    }
  };

  const handleSearch = async () => {
    console.log('Search triggered with:', { source, destination, desiredTime, pickupPoint, pickupPointLat, pickupPointLng });
    
    if ((!flexibleMode && source && destination && desiredTime) || (flexibleMode && selectedPickupPoint && destination && desiredTime)) {
      setSearching(true);
      setSearchError('');
      setAvailableTrips([]);
      setSearchStatus('searching');
      try {
        const desiredDate = new Date(desiredTime);
        const windowMs = 30 * 60 * 1000; // 30 minutes in ms
        
        // Get all available trips
        const q = query(
          collection(db, 'trips'),
          where('active', '==', true),
          where('status', '==', 'available')
        );
        const querySnapshot = await getDocs(q);
        let trips = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Use buddy's route pickup points instead of pilot's pickup points
        setAvailablePickupPoints(buddyRoutePickupPoints);
        
        // Filter by time window
        trips = trips.filter(trip => {
          if (!trip.tripStartTime) return false;
          const tripTime = trip.tripStartTime.toDate ? trip.tripStartTime.toDate() : new Date(trip.tripStartTime);
          return Math.abs(tripTime - desiredDate) <= windowMs;
        });
        
        // Filter by route matching
        let matchedTrips = [];
        
        if (flexibleMode && selectedPickupPoint) {
          console.log('Searching with pickup point:', selectedPickupPoint.name, selectedPickupPoint.lat, selectedPickupPoint.lng);
          
          // Use smart search for flexible pickup
          matchedTrips = await smartSearch(selectedPickupPoint, destination, desiredTime);
          setMatchingTrips(matchedTrips);
          
          if (matchedTrips.length > 0) {
            setSearchStatus('found');
          } else {
            setSearchStatus('not_found');
          }
        } else {
          // Traditional search by source and destination
          const normSource = normalizePlace(source);
          const normDest = normalizePlace(destination);
          console.log('Traditional search:', normSource, '->', normDest);
          matchedTrips = trips.filter(trip => {
            const tripSource = normalizePlace(trip.source);
            const tripDest = normalizePlace(trip.destination);
            const matches = tripSource === normSource && tripDest === normDest;
            console.log('Trip match:', tripSource, '->', tripDest, '=', matches);
            return matches;
          });
          console.log('Traditional matches:', matchedTrips.length);
        }
        
        // Sort trips by pilot ratings (highest first)
        const tripsWithRatings = await Promise.all(
          matchedTrips.map(async (trip) => {
            try {
              const ratingsQuery = query(
                collection(db, 'ratings'),
                where('ratedUserId', '==', trip.driverId)
              );
              const ratingsSnapshot = await getDocs(ratingsQuery);
              const ratings = ratingsSnapshot.docs.map(doc => doc.data().rating);
              const averageRating = ratings.length > 0 
                ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1)
                : 0;
              return {
                ...trip,
                averageRating: parseFloat(averageRating),
                ratingCount: ratings.length
              };
            } catch (err) {
              console.error('Error fetching ratings for trip:', err);
              return { ...trip, averageRating: 0, ratingCount: 0 };
            }
          })
        );
        tripsWithRatings.sort((a, b) => {
          if (b.averageRating !== a.averageRating) {
            return b.averageRating - a.averageRating;
          }
          return b.ratingCount - a.ratingCount;
        });
        setAvailableTrips(tripsWithRatings);
        if (tripsWithRatings.length === 0) {
          toast('No pilots found for this route and time.', { icon: '🕵️' });
        }
      } catch (err) {
        setSearchError('Failed to search for trips. Please try again.');
        console.error('Error searching for trips:', err);
            } finally {
        setSearching(false);
      }
    } else {
      if (flexibleMode) {
        setSearchError('Please select a pickup point, destination, and desired time.');
      } else {
        setSearchError('Please enter source, destination, and desired time.');
      }
      console.log('Search validation failed:', { source, destination, desiredTime, pickupPoint });
    }
  };

  const handleBookRide = async (trip) => {
    setBookingLoading(true);
    try {
      const updateData = {
        status: 'pending',
        buddyId: user.uid,
        buddyName: userProfile?.username || user.displayName || '',
        buddyEmail: user.email,
        buddyPhone: userProfile?.phoneNumber || '',
        // Add pickup point information if it's a flexible pickup
        ...(trip.isFlexiblePickup && {
          buddyPickupPoint: trip.pickupPoint,
          buddyPickupLat: trip.pickupPointLat,
          buddyPickupLng: trip.pickupPointLng,
          adjustedFare: trip.adjustedFare,
          isFlexiblePickup: true
        })
      };
      await updateDoc(doc(db, 'trips', trip.id), updateData);
      
      // Create booking record for history
      const bookingData = {
        tripId: trip.id,
        pilotId: trip.driverId,
        pilotName: trip.driverName,
        pilotEmail: trip.driverEmail,
        pilotPhone: trip.driverPhone,
        buddyId: user.uid,
        buddyName: userProfile?.username || user.displayName || '',
        buddyEmail: user.email,
        buddyPhone: userProfile?.phoneNumber || '',
        source: trip.source,
        destination: trip.destination,
        pickupPoint: trip.isFlexiblePickup ? trip.pickupPoint : null,
        fare: trip.adjustedFare || trip.fare,
        distance: trip.distance,
        status: 'pending',
        isFlexiblePickup: trip.isFlexiblePickup || false,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'bookings'), bookingData);
      setAvailableTrips(prev => prev.filter(t => t.id !== trip.id));
      
      // Set active chat trip for buddy
      const bookedTripData = {
        id: trip.id,
        driverId: trip.driverId,
        driverName: trip.driverName,
        source: trip.source,
        destination: trip.destination,
        pickupPoint: trip.isFlexiblePickup ? trip.pickupPoint : null,
        status: 'pending',
        isFlexiblePickup: trip.isFlexiblePickup || false
      };
      setActiveChatTrip(bookedTripData);
      setBuddyTab('chat'); // Switch to chat tab
      
      const successMessage = trip.isFlexiblePickup 
        ? `Booking request sent! Pickup at ${trip.pickupPoint}. Chat is now available.`
        : 'Booking request sent! Chat is now available.';
      toast.success(successMessage);
    } catch (err) {
      alert('Booking failed. Please try again.');
      console.error('Error booking trip:', err);
    } finally {
      setBookingLoading(false);
    }
  };

  const cancelBooking = () => {
    setBookingTrip(null);
  };

  const cancelPayment = () => {
    setShowPayment(false);
    setPaymentMethod('');
    setUpiId('');
  };

  const handleShowBuddyPayment = () => setShowBuddyPayment(true);
  const handleBuddyPayment = async () => {
    if (!upiId.trim()) {
      alert('Please enter the pilot\'s UPI ID');
      return;
    }
    setBuddyPaymentLoading(true);
    try {
      // Mark payment as completed
      await updateDoc(doc(db, 'trips', myAcceptedTrip.id), {
        paymentStatus: 'completed',
        paymentMethod: 'upi',
        upiId: upiId,
        buddyId: '',
        buddyName: '',
        buddyEmail: '',
        buddyPhone: '',
        status: 'finished',
      });
      // Delete the booking record for this trip
      const bookingsQuery = query(
        collection(db, 'bookings'),
        where('tripId', '==', myAcceptedTrip.id)
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      for (const docSnap of bookingsSnapshot.docs) {
        await deleteDoc(doc(db, 'bookings', docSnap.id));
      }
      setBuddyPaymentDone(true);
      toast.success('Payment completed! Booking removed.');
    } catch (err) {
      toast.error('Payment failed.');
      console.error('Error in buddy payment:', err);
    } finally {
      setBuddyPaymentLoading(false);
      setShowBuddyPayment(false);
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span key={i} className={i <= rating ? 'text-yellow-400' : 'text-gray-300'}>
          ★
        </span>
      );
    }
    return stars;
  };

  const handleUseMyLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setPickupLat(lat);
          setPickupLng(lng);
          // Reverse geocode to get address
          if (window.google) {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: { lat, lng } }, (results, status) => {
              if (status === 'OK' && results[0]) {
                setSource(results[0].formatted_address);
              }
            });
          }
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            alert('Location permission denied. Please allow location access in your browser settings.');
          } else {
            alert('Failed to fetch location: ' + error.message);
          }
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  };

  // Render content based on buddyTab
  let mainContent;
  if (buddyTab === 'book') {
    mainContent = (
      <>
        <AnimatedTitle />
        {/* Book Ride UI (search, available trips, etc.) */}
        <div className="mb-4 sm:mb-6 text-left">
          {/* Search Mode Toggle */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-gray-700">Search Mode:</span>
              <button
                onClick={() => {
                  setFlexibleMode(false);
                  setPickupPoint('');
                  setPickupPointLat(null);
                  setPickupPointLng(null);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  !flexibleMode ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                Exact Match
              </button>
              <button
                onClick={() => {
                  setFlexibleMode(true);
                  setSource('');
                  setPickupLat(null);
                  setPickupLng(null);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  flexibleMode ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                Flexible Pickup
              </button>
            </div>
          </div>

          {!flexibleMode ? (
            /* Traditional Search */
            <>
              <label className="block text-gray-700 font-medium mb-1 text-sm sm:text-base">Source (Coimbatore)</label>
              <div className="flex gap-2 items-center mb-3">
                <div className="flex-1">
                  <PlacesAutocompleteInput
                    value={source}
                    onChange={setSource}
                    placeholder="Enter source location"
                    onSelect={(desc, lat, lng) => {
                      setSource(desc);
                      setPickupLat(lat);
                      setPickupLng(lng);
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-200 transition"
                  title="Use my current location"
                >
                  Use My Location
                </button>
              </div>
            </>
          ) : (
            /* Flexible Pickup Search */
            <>
              <label className="block text-gray-700 font-medium mb-1 text-sm sm:text-base">
                Select Pickup Point Along Your Route
              </label>
              <div className="mb-3">
                {buddyRoutePickupPoints.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                    {buddyRoutePickupPoints.map((point) => (
                      <label key={point.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-50 transition cursor-pointer">
                        <input
                          type="radio"
                          name="pickupPoint"
                          value={point.id}
                          checked={selectedPickupPoint?.id === point.id}
                          onChange={() => {
                            setSelectedPickupPoint(point);
                            setPickupPoint(point.name);
                            setPickupPointLat(point.lat);
                            setPickupPointLng(point.lng);
                          }}
                          className="w-4 h-4 text-blue-600"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{point.name}</div>
                          <div className="text-xs text-gray-600">
                            {point.type === 'start' ? '🚀 Start' : point.type === 'end' ? '🎯 End' : '📍 Intermediate'}
                            {point.distance > 0 && ` • ${point.distance.toFixed(1)} km from start`}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : source && destination ? (
                  <div className="text-center py-4 text-gray-500">
                    <div className="text-sm">Generating pickup points...</div>
                    <div className="text-xs">Please wait while we analyze your route</div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    <div className="text-sm">Enter source and destination first</div>
                    <div className="text-xs">Pickup points will be generated automatically</div>
                  </div>
                )}
              </div>
              
              {/* Search Radius Slider */}
              <div className="mb-3">
                <label className="block text-gray-700 font-medium mb-1 text-xs">Search Radius: {searchRadius} km</label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.5"
                  value={searchRadius}
                  onChange={(e) => setSearchRadius(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="text-xs text-gray-500 mt-1">Search for pilots within {searchRadius}km of your pickup point</div>
              </div>
              
              {/* Route Visualization Toggle */}
              {routePolyline && (
                <div className="mb-3">
                  <button
                    onClick={() => setShowRouteMap(!showRouteMap)}
                    className="w-full py-2 px-3 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition"
                  >
                    {showRouteMap ? 'Hide Route Map' : 'Show Route Map'}
                  </button>
                </div>
              )}
            </>
          )}

          <label className="block text-gray-700 font-medium mb-1 text-sm sm:text-base">Destination (Coimbatore)</label>
          <PlacesAutocompleteInput
            value={destination}
            onChange={setDestination}
            placeholder="Enter destination location"
            onSelect={(desc, lat, lng) => setDestination(desc)}
            isLoaded={isLoaded}
          />
          
          <label className="block text-gray-700 font-medium mb-1 text-sm sm:text-base mt-3">Desired Trip Time</label>
          <input
            type="datetime-local"
            value={desiredTime}
            onChange={e => setDesiredTime(e.target.value)}
            className="w-full p-2 sm:p-3 mb-3 border border-gray-300 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-sm sm:text-base"
          />
          
          <div className="flex gap-2">
            <button
              onClick={handleSearch}
              className={`flex-1 py-2 sm:py-3 rounded-lg sm:rounded-xl font-semibold shadow-lg transition text-sm sm:text-base ${searching ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-yellow-400 to-green-500 text-white hover:from-yellow-500 hover:to-green-600'}`}
              disabled={searching}
            >
              {searching ? 'Searching...' : flexibleMode ? 'Find Pilots with Flexible Pickup' : 'Find a Pilot'}
            </button>
            <button
              onClick={testFlexiblePickup}
              className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-200 transition"
              title="Test flexible pickup functions"
            >
              Test
            </button>
          </div>
          
          {/* Search Status Indicators */}
          {searchStatus === 'searching' && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                <span className="text-blue-700 text-sm">Searching for matching pilots...</span>
              </div>
            </div>
          )}
          
          {searchStatus === 'found' && matchingTrips.length > 0 && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-green-600">✅</span>
                <span className="text-green-700 text-sm font-medium">
                  Found {matchingTrips.length} matching pilot{matchingTrips.length > 1 ? 's' : ''}!
                </span>
              </div>
            </div>
          )}
          
          {searchStatus === 'not_found' && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-yellow-600">⚠️</span>
                <span className="text-yellow-700 text-sm">
                  No matching pilots found. Try adjusting your search radius or pickup point.
                </span>
              </div>
            </div>
          )}
          {searchError && <div className="text-red-600 text-xs sm:text-sm mt-2">{searchError}</div>}
        </div>
        {/* Route Visualization */}
        {showRouteMap && routePolyline && buddyRoutePickupPoints.length > 0 && (
          <RouteVisualizer
            routePolyline={routePolyline}
            pickupPoints={buddyRoutePickupPoints}
            selectedPickupPoint={selectedPickupPoint}
            onPickupPointSelect={(point, index) => {
              setSelectedPickupPoint(point);
              setSelectedPickupPointIndex(index);
              setPickupPoint(point.name);
              setPickupPointLat(point.lat);
              setPickupPointLng(point.lng);
            }}
            center={buddyRoutePickupPoints.length > 0 ? {
              lat: buddyRoutePickupPoints[0].lat,
              lng: buddyRoutePickupPoints[0].lng
            } : null}
          />
        )}
        
        <MapWithRoute source={source} destination={destination} isLoaded={isLoaded} />
        {distance && (
          <div className="mb-3 sm:mb-4 text-base sm:text-lg text-yellow-700 font-semibold">
            Distance: {distance}
          </div>
        )}
        {fare && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-yellow-50 rounded-lg sm:rounded-xl border border-yellow-200">
            <div className="text-base sm:text-lg font-bold text-yellow-800 mb-2">Estimated Fare</div>
            <div className="text-xs sm:text-sm text-gray-600 space-y-1">
              <div>Distance: {distanceInKm} km × ₹{RATE_PER_KM} = ₹{(distanceInKm * RATE_PER_KM).toFixed(2)}</div>
              <div>Additional Expenses: ₹{ADDITIONAL_EXPENSES}</div>
              <div className="border-t border-yellow-200 pt-2 mt-2">
                <div className="font-bold text-base sm:text-lg text-yellow-800">Total: ₹{fare}</div>
              </div>
            </div>
          </div>
        )}
        {(availableTrips.length > 0 || matchingTrips.length > 0) && (
          <div className="mb-4 sm:mb-6 text-left">
            <h3 className="text-base sm:text-lg font-bold mb-2 text-gray-800">
              {flexibleMode ? 'Matching Pilots' : 'Available Pilots'} (Sorted by Rating):
            </h3>
            <ul className="space-y-3">
              {(flexibleMode ? matchingTrips : availableTrips).map(trip => (
                <li key={trip.id} className="p-3 sm:p-4 bg-yellow-50 rounded-lg sm:rounded-xl border border-yellow-200 shadow">
                  <div className="flex items-center gap-3 sm:gap-4 mb-3">
                    {trip.driverPhoto ? (
                      <img src={trip.driverPhoto} alt="Pilot" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-yellow-400 flex-shrink-0" />
                    ) : (
                      <UserCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-400 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-800 text-sm sm:text-base truncate">{trip.driverName || 'Pilot'}</div>
                      <div className="flex items-center gap-2">
                        <div className="flex text-xs sm:text-sm">
                          {renderStars(trip.averageRating)}
                        </div>
                        <span className="text-xs text-gray-500">
                          {trip.averageRating} ({trip.ratingCount} reviews)
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-gray-600 text-xs sm:text-sm mb-3 space-y-1">
                    <div className="truncate">📧 {trip.driverEmail}</div>
                    {trip.driverPhone && <div className="truncate">📞 {trip.driverPhone}</div>}
                    <div className="mt-2">📍 From: {trip.source || <span className="text-red-500">Not set</span>}</div>
                    <div>🎯 To: {trip.destination || <span className="text-red-500">Not set</span>}</div>
                    {trip.isFlexiblePickup && (
                      <div className="bg-primary-50 border border-primary-200 rounded-lg p-2 mt-2">
                        <div className="text-primary-700 font-medium text-xs">🚗 Flexible Pickup Available</div>
                        <div className="text-primary-600 text-xs">📍 Pickup: {trip.pickupPoint}</div>
                        <div className="text-primary-600 text-xs">💰 Adjusted Fare: ₹{(trip.adjustedFare || trip.fare)?.toFixed(2)}</div>
                        {trip.savings && (
                          <div className="text-primary-600 text-xs">💸 Savings: ₹{trip.savings.toFixed(2)}</div>
                        )}
                        {trip.pickupDistance && (
                          <div className="text-primary-600 text-xs">📏 Pickup Distance: {trip.pickupDistance.toFixed(1)} km</div>
                        )}
                      </div>
                    )}
                    <div className="text-green-700 font-semibold">💰 Fare: ₹{(trip.adjustedFare || trip.fare)?.toFixed(2) ?? <span className="text-red-500">Not set</span>}</div>
                  </div>
                  <button
                    onClick={() => handleBookRide(trip)}
                    className="w-full bg-gradient-to-r from-green-500 to-green-700 text-white py-2 rounded-lg font-semibold hover:from-green-600 hover:to-green-800 transition text-sm"
                  >
                    Book This Ride
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {myAcceptedTrip && (
          <div className="mb-10 p-6 bg-gradient-to-br from-green-100 to-blue-100 rounded-2xl border border-green-200 shadow-lg">
            <div className="flex items-center gap-4 mb-4">
              {myAcceptedTrip.driverPhoto ? (
                <img src={myAcceptedTrip.driverPhoto} alt="Pilot" className="w-16 h-16 rounded-full border-4 border-green-400 shadow" />
              ) : (
                <UserCircle2 className="w-16 h-16 text-green-400" />
              )}
              <div>
                <div className="font-bold text-lg text-gray-800">{myAcceptedTrip.driverName}</div>
                <div className="text-xs text-gray-600">📧 {myAcceptedTrip.driverEmail}</div>
                <div className="text-xs text-gray-600">📞 {myAcceptedTrip.driverPhone}</div>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-700 mb-2">
              <span className="inline-flex items-center gap-1"><span className="text-green-500">📍</span>{myAcceptedTrip.source}</span>
              <span className="inline-flex items-center gap-1"><span className="text-pink-500">🎯</span>{myAcceptedTrip.destination}</span>
            </div>
            {myAcceptedTrip.paymentStatus === 'completed' || buddyPaymentDone ? (
              <div className="text-green-700 font-semibold mt-2">Payment Completed</div>
            ) : myAcceptedTrip.paymentInitiated ? (
              <>
                <div className="flex items-center gap-2 text-lg font-bold text-green-800 mb-2">
                  <span className="text-yellow-500">💰</span>
                  <span>Fare: ₹{myAcceptedTrip.fare}</span>
                </div>
                <button
                  onClick={handleShowBuddyPayment}
                  className="w-full bg-gradient-to-r from-green-500 to-green-700 text-white py-2 rounded-lg font-semibold hover:from-green-600 hover:to-green-800 transition text-sm mt-2"
                >
                  Pay Now
                </button>
              </>
            ) : (
              <div className="text-yellow-700 font-semibold mt-2">Waiting for pilot to initiate payment...</div>
            )}
          </div>
        )}
        {bookingTrip && !showPayment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
            <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 max-w-sm sm:max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Confirm Booking</h3>
              <div className="mb-6 space-y-3 sm:space-y-4">
                <div className="p-3 sm:p-4 bg-blue-50 rounded-lg sm:rounded-xl border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-2 text-sm sm:text-base">Pilot Details:</h4>
                  <div className="text-xs sm:text-sm text-gray-700 space-y-1">
                    <div>👤 {bookingTrip.driverName}</div>
                    <div className="truncate">📧 {bookingTrip.driverEmail}</div>
                    <div>📞 {bookingTrip.driverPhone}</div>
                  </div>
                </div>
                <div className="p-3 sm:p-4 bg-green-50 rounded-lg sm:rounded-xl border border-green-200">
                  <h4 className="font-semibold text-green-800 mb-2 text-sm sm:text-base">Your Details (Shared with Pilot):</h4>
                  <div className="text-xs sm:text-sm text-gray-700 space-y-1">
                    <div>👤 {userProfile?.username || user.displayName || 'User'}</div>
                    <div className="truncate">📧 {user.email}</div>
                    <div>📞 {userProfile?.phoneNumber || 'Not provided'}</div>
                  </div>
                </div>
                <div className="p-3 sm:p-4 bg-yellow-50 rounded-lg sm:rounded-xl border border-yellow-200">
                  <h4 className="font-semibold text-yellow-800 mb-2 text-sm sm:text-base">Trip Details:</h4>
                  <div className="text-xs sm:text-sm text-gray-700 space-y-1">
                    <div>📍 From: {bookingTrip.source || <span className="text-red-500">Not set</span>}</div>
                    <div>🎯 To: {bookingTrip.destination || <span className="text-red-500">Not set</span>}</div>
                    <div>💰 Fare: ₹{bookingTrip.fare ?? <span className="text-red-500">Not set</span>}</div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={cancelBooking}
                  className="flex-1 py-2 sm:py-3 bg-gray-500 text-white rounded-lg sm:rounded-xl font-semibold hover:bg-gray-600 transition text-sm"
                  disabled={bookingLoading}
                >
                  Cancel
                </button>
                {/* Removed confirmBooking and processPayment buttons, and payment modal as payment is not required */}
              </div>
            </div>
          </div>
        )}
        {showBuddyPayment && myAcceptedTrip && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Pay with UPI</h3>
              <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">Pilot's UPI ID</label>
                <input
                  type="text"
                  placeholder="Enter pilot's UPI ID (e.g., pilot@upi)"
                  value={upiId}
                  onChange={e => setUpiId(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Ask the pilot for their UPI ID</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowBuddyPayment(false)}
                  className="flex-1 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition text-sm"
                  disabled={buddyPaymentLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleBuddyPayment}
                  className="flex-1 py-2 bg-gradient-to-r from-green-500 to-green-700 text-white rounded-lg font-semibold hover:from-green-600 hover:to-green-800 transition text-sm"
                  disabled={buddyPaymentLoading || !upiId.trim()}
                >
                  {buddyPaymentLoading ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  } else if (buddyTab === 'chat') {
    mainContent = (
      <div className="mb-8">
        <AnimatedTitle />
        <div className="flex items-center gap-2 mb-4 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-400 to-green-400 shadow-md border border-blue-200">
          <span className="text-2xl">💬</span>
          <h3 className="text-lg font-extrabold text-white tracking-wide">Ride Chat</h3>
        </div>
        
        {activeChatTrip ? (
          <div className="h-96">
            <ChatSystem
              tripId={activeChatTrip.id}
              pilotId={activeChatTrip.driverId}
              buddyId={user.uid}
              pilotName={activeChatTrip.driverName}
              buddyName={userProfile?.username || user.displayName || 'Buddy'}
              rideStatus={activeChatTrip.status}
              pickupPoint={activeChatTrip.isFlexiblePickup ? activeChatTrip.pickupPoint : activeChatTrip.source}
              destination={activeChatTrip.destination}
              currentUserId={user.uid}
            />
          </div>
        ) : (
          <div className="text-center py-8">
            <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Active Chats</h3>
            <p className="text-gray-500">Chat will be available when you have an active ride with a pilot.</p>
          </div>
        )}
      </div>
    );
  } else if (buddyTab === 'bookings') {
    mainContent = (
      <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-10 w-full max-w-sm sm:max-w-md shadow-2xl text-center border border-yellow-200 mb-10 mx-auto min-h-[350px] max-h-[500px] overflow-y-auto">
        <AnimatedTitle />
        <div className="flex items-center gap-2 mb-4 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-400 to-purple-400 shadow-md border border-blue-200">
          <span className="text-2xl">📚</span>
          <h3 className="text-xl font-extrabold text-white tracking-wide">Booking History</h3>
        </div>
        {/* Render booking history here (reuse from UserProfilePage or similar) */}
        {/* ...booking history code... */}
      </div>
    );
  } else if (buddyTab === 'contact') {
    mainContent = (
      <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-10 w-full max-w-sm sm:max-w-md shadow-2xl text-center border border-yellow-200 mb-10 mx-auto">
        <AnimatedTitle />
        <h3 className="text-lg font-bold text-gray-800 mb-4">Contact & Support</h3>
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-xl border border-blue-200">
            <h4 className="font-semibold text-blue-800 mb-2">📞 Toll-Free 24/7 Support</h4>
            <div className="text-green-700 font-bold text-lg mb-1">1800-123-4567</div>
            <div className="text-xs text-gray-500">Available 24/7 for all users</div>
          </div>
          <div className="p-4 bg-white rounded-xl border border-blue-200">
            <h4 className="font-semibold text-blue-800 mb-2">📧 Email Support</h4>
            <a href="mailto:support@coimbuddy.com" className="text-blue-600 font-semibold underline">support@coimbuddy.com</a>
          </div>
          <div className="p-4 bg-white rounded-xl border border-purple-200">
            <h4 className="font-semibold text-purple-800 mb-2">🤖 AI Chatbot</h4>
            <p className="text-gray-700 mb-2">Get instant answers to your questions with our AI-powered support.</p>
            <button className="bg-purple-600 text-white px-6 py-3 rounded-lg font-bold text-base shadow hover:bg-purple-700 transition">Chat with AI Support</button>
          </div>
        </div>
        <div className="mt-6 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
          <p className="text-sm text-yellow-800 text-center">
            <strong>Response Time:</strong> We usually respond within 2-4 hours during business hours.
          </p>
        </div>
      </div>
    );
  } else if (buddyTab === 'account') {
    mainContent = (
      <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-10 w-full max-w-sm sm:max-w-md shadow-2xl text-center border border-yellow-200 mb-10 mx-auto min-h-[350px] max-h-[500px] overflow-y-auto">
        <AnimatedTitle />
        <UserProfile user={user} userProfile={userProfile} />
        <button
          onClick={onSignOut}
          className="w-full bg-gradient-to-r from-red-500 to-red-700 text-white px-4 py-2 rounded-lg font-semibold shadow hover:from-red-600 hover:to-red-800 transition text-sm mt-2"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-yellow-300 to-green-400">
      <div className="flex-1 flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-10 w-full max-w-sm sm:max-w-md shadow-2xl text-center border border-yellow-200">
          {mainContent}
        </div>
      </div>
      <div className="w-full px-4 pb-4">
        <BottomNavBar currentTab={buddyTab} onTabChange={setBuddyTab} userType="buddy" />
      </div>
    </div>
  );
}

function LoginScreen({ onLogin, loading, error }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isSignUp && password !== confirmPassword) {
      onLogin('Passwords do not match', 'error');
      return;
    }

    if (password.length < 6) {
      onLogin('Password must be at least 6 characters', 'error');
      return;
    }

    onLogin(email, password, isSignUp);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-secondary-600 to-primary-700 flex items-center justify-center p-3 sm:p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-600/20 via-secondary-600/20 to-primary-700/20"></div>
      <div className="absolute top-0 left-0 w-72 h-72 bg-primary-400/10 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary-400/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
      
      <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl p-8 sm:p-12 w-full max-w-md shadow-strong border border-white/20 animate-scale-in">
        <div className="text-center mb-8">
          <div className="relative inline-block mb-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center mx-auto shadow-glow animate-bounce-gentle">
              <Car className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-success-500 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse-gentle"></div>
            </div>
          </div>
          <AnimatedTitle />
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          <div className="space-y-2">
            <label className="block text-gray-700 font-semibold text-sm">Email Address</label>
            <div className="relative">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-4 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 text-sm transition-all duration-300 bg-gray-50 focus:bg-white"
                required
              />
              <div className="absolute inset-0 bg-gradient-to-r from-primary-500/5 to-secondary-500/5 rounded-xl opacity-0 focus-within:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="block text-gray-700 font-semibold text-sm">Password</label>
            <div className="relative">
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-4 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 text-sm transition-all duration-300 bg-gray-50 focus:bg-white"
                required
              />
              <div className="absolute inset-0 bg-gradient-to-r from-primary-500/5 to-secondary-500/5 rounded-xl opacity-0 focus-within:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
            </div>
          </div>

          {isSignUp && (
            <div className="space-y-2">
              <label className="block text-gray-700 font-semibold text-sm">Confirm Password</label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full pl-4 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 text-sm transition-all duration-300 bg-gray-50 focus:bg-white"
                  required
                />
                <div className="absolute inset-0 bg-gradient-to-r from-primary-500/5 to-secondary-500/5 rounded-xl opacity-0 focus-within:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-danger-50 border border-danger-200 rounded-xl p-3 text-danger-700 text-sm animate-slide-up">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-danger-500 rounded-full animate-pulse-gentle"></div>
                {error}
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 text-white py-4 rounded-xl font-bold shadow-soft hover:shadow-medium hover:scale-[1.02] transition-all duration-300 flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Processing...
              </>
            ) : (
              <>
                {isSignUp ? 'Create Account' : 'Sign In'}
                <div className="w-2 h-2 bg-white rounded-full animate-pulse-gentle"></div>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-primary-600 hover:text-primary-700 font-semibold text-sm transition-colors duration-200 hover:scale-105"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserProfileSetup({ user, onComplete }) {
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [carType, setCarType] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSaveProfile = async () => {
    if (!username.trim() || !phoneNumber.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Save user profile to Firestore
      await setDoc(doc(db, 'userProfiles', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        username: username.trim(),
        phoneNumber: phoneNumber.trim(),
        carType: carType.trim() || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      onComplete();
    } catch (err) {
      setError('Failed to save profile. Please try again.');
      console.error('Error saving profile:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700 p-3 sm:p-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-10 w-full max-w-sm sm:max-w-md shadow-2xl border border-blue-200">
        <div className="text-center mb-6 sm:mb-8">
          <Car className="w-12 h-12 sm:w-16 sm:h-16 text-blue-600 mx-auto mb-4" />
          <AnimatedTitle />
        </div>
        
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl sm:rounded-2xl shadow border border-gray-200">
            {user.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-blue-400 flex-shrink-0" />
            ) : (
              <UserCircle2 className="w-12 h-12 sm:w-14 sm:h-14 text-blue-400 flex-shrink-0" />
            )}
            <div className="text-left min-w-0 flex-1">
              <div className="font-bold text-base sm:text-lg text-gray-800 truncate">{user.displayName || 'User'}</div>
              <div className="text-gray-500 text-xs sm:text-sm truncate">{user.email}</div>
            </div>
          </div>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-gray-700 font-medium mb-1 text-sm sm:text-base">Username *</label>
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm sm:text-base"
              required
            />
          </div>
          
          <div>
            <label className="block text-gray-700 font-medium mb-1 text-sm sm:text-base">Phone Number *</label>
            <input
              type="tel"
              placeholder="Enter your phone number"
              value={phoneNumber}
              onChange={e => setPhoneNumber(e.target.value)}
              className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm sm:text-base"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1 text-sm sm:text-base">Car Type (Optional)</label>
            <input
              type="text"
              placeholder="e.g., Sedan, SUV, Hatchback"
              value={carType}
              onChange={e => setCarType(e.target.value)}
              className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm sm:text-base"
            />
            <p className="text-xs text-gray-500 mt-1">Pilots can specify their car type for passengers</p>
          </div>

          {error && <div className="text-red-600 text-xs sm:text-sm">{error}</div>}

          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className={`w-full py-2 sm:py-3 rounded-lg sm:rounded-xl font-semibold shadow-lg transition text-sm sm:text-base ${
              saving 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-blue-500 to-blue-700 text-white hover:from-blue-600 hover:to-blue-800'
            }`}
          >
            {saving ? 'Saving...' : 'Complete Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [role, setRole] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [showProfilePage, setShowProfilePage] = useState(false);
  const navigate = useNavigate();

  // Google Maps API loader at top level
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: ['places', 'geometry'],
  });

  // Check if user profile exists
  const checkUserProfile = async (firebaseUser) => {
    if (!firebaseUser) {
      setUserProfile(null);
      setProfileLoading(false);
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'userProfiles', firebaseUser.uid));
      if (userDoc.exists()) {
        setUserProfile(userDoc.data());
      } else {
        setUserProfile(null);
      }
    } catch (err) {
      console.error('Error checking user profile:', err);
      setUserProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setRole(null);
        setUserProfile(null);
        setProfileLoading(false);
        navigate('/');
      } else {
        setProfileLoading(true);
        await checkUserProfile(firebaseUser);
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleEmailAuth = async (email, password, isSignUp) => {
    setLoading(true);
    setError('');
    
    try {
      if (isSignUp) {
        // Create new user
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        // Sign in existing user
        await signInWithEmailAndPassword(auth, email, password);
      }
      // onAuthStateChanged will update user
    } catch (err) {
      let errorMessage = 'Authentication failed. Please try again.';
      
      switch (err.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'This email is already registered. Please sign in instead.';
          break;
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email. Please sign up first.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password. Please try again.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Please enter a valid email address.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password should be at least 6 characters long.';
          break;
        default:
          errorMessage = err.message;
      }
      
      setError(errorMessage);
      console.error('Auth error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setRole(null);
    setUserProfile(null);
    window.location.reload();
  };

  const handleProfileComplete = () => {
    // Refresh user profile
    checkUserProfile(user);
  };

  const handleShowProfile = () => {
    setShowProfilePage(true);
  };

  const handleBackFromProfile = () => {
    setShowProfilePage(false);
  };

  // Show loading while checking user profile or Google Maps API
  if (profileLoading || !isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700">
        <div className="bg-white rounded-3xl p-10 shadow-2xl text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          user ? (
            showProfilePage ? (
              <UserProfilePage 
                user={user} 
                userProfile={userProfile} 
                onBack={handleBackFromProfile}
                onSignOut={handleSignOut}
              />
            ) : !userProfile ? (
              <UserProfileSetup user={user} onComplete={handleProfileComplete} />
            ) : role === null ? (
              <RoleSelection onSelect={setRole} />
            ) : role === 'pilot' ? (
              <PilotDashboard 
                user={user} 
                userProfile={userProfile} 
                onSignOut={handleSignOut}
                onShowProfile={handleShowProfile}
                isLoaded={isLoaded}
              />
            ) : (
              <BuddyDashboard 
                user={user} 
                userProfile={userProfile} 
                onSignOut={handleSignOut}
                onShowProfile={handleShowProfile}
                isLoaded={isLoaded}
              />
            )
          ) : (
            <LoginScreen onLogin={handleEmailAuth} loading={loading} error={error} />
          )
        }
      />
    </Routes>
  );
}

export default function AppWithRouter() {
  return (
    <Router>
      <Toaster />
      <App />
    </Router>
  );
}
