import React, { useState, useEffect, useCallback } from 'react';
import { Car, UserCircle2 } from 'lucide-react';
import { auth, db } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate
} from 'react-router-dom';
import { GoogleMap, useJsApiLoader, DirectionsRenderer } from '@react-google-maps/api';
import { collection, addDoc, query, where, getDocs, serverTimestamp, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
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

// --- Input Normalization Helper ---
function normalizePlace(str) {
  return str.trim().toLowerCase();
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

function MapWithRoute({ source, destination }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: ['places'],
  });
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-700 to-purple-900 p-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-10 w-full max-w-sm sm:max-w-md shadow-2xl text-center border border-blue-200">
        <Car className="w-12 h-12 sm:w-14 sm:h-14 text-blue-700 mx-auto mb-4" />
        <AnimatedTitle />
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-6 text-gray-800">Choose Your Role</h2>
        <button
          className="w-full bg-gradient-to-r from-green-400 to-green-600 text-white py-3 sm:py-3 rounded-xl font-semibold mb-4 shadow-lg hover:from-green-500 hover:to-green-700 transition text-base sm:text-lg"
          onClick={() => onSelect('pilot')}
        >
          I am a Pilot
        </button>
        <button
          className="w-full bg-gradient-to-r from-blue-400 to-blue-600 text-white py-3 sm:py-3 rounded-xl font-semibold shadow-lg hover:from-blue-500 hover:to-blue-700 transition text-base sm:text-lg"
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={onBack}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back
            </button>
            <AnimatedTitle />
            <button
              onClick={onSignOut}
              className="text-red-600 hover:text-red-800 font-medium"
            >
              Sign Out
            </button>
          </div>

          {/* Profile Info */}
          <div className="mb-8">
            <div className="flex items-center gap-6 mb-6 p-6 bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl shadow border border-gray-200">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-20 h-20 rounded-full border-4 border-blue-400" />
              ) : (
                <UserCircle2 className="w-20 h-20 text-blue-400" />
              )}
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
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
                {bookings.map((booking) => (
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
        where('status', '==', 'pending')
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
      const tripData = {
        driverId: user.uid,
        driverName: userProfile?.username || user.displayName || '',
        driverEmail: user.email,
        driverPhone: userProfile?.phoneNumber || '',
        driverPhoto: user.photoURL || '',
        source: normalizePlace(source),
        destination: normalizePlace(destination),
        distance,
        distanceInKm,
        fare: parseFloat(fare),
        ratePerKm: RATE_PER_KM,
        additionalExpenses: ADDITIONAL_EXPENSES,
        createdAt: serverTimestamp(),
        active: true,
        status: 'available',
        tripStartTime: tripStartTime ? new Date(tripStartTime) : null,
      };
      console.log('Creating trip:', tripData);
      await addDoc(collection(db, 'trips'), tripData);
      toast.success('Trip created! Buddies can now find your ride.');
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
      await updateDoc(doc(db, 'trips', tripId), {
        status: 'accepted',
        active: false,
      });
      setPendingBookings(prev => prev.filter(trip => trip.id !== tripId));
      toast.success('Booking accepted!');
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
      await updateDoc(doc(db, 'trips', tripId), {
        tripStarted: true,
        tripStartedAt: serverTimestamp(),
      });
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
        buddyId: '',
        buddyName: '',
        buddyEmail: '',
        buddyPhone: '',
      });
      toast.success('Trip finished and buddy details removed.');
    } catch (err) {
      toast.error('Failed to finish trip.');
      console.error('Error finishing trip:', err);
    }
  };

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
            <button
              type="button"
              onClick={handleUseMyLocation}
              className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-200 transition"
              title="Use my current location"
            >
              Use My Location
            </button>
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
      </>
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
                    <div className="text-sm text-blue-800 mb-1">Pickup Point: <span className="font-semibold">{trip.source}</span></div>
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
                    <div>📍 {trip.source} → 🎯 {trip.destination}</div>
                    <div>💰 ₹{trip.fare}</div>
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
        {acceptedBookings.length > 0 && (
          <div>
            <h4 className="text-lg font-bold text-gray-800 mb-3">Active Passengers</h4>
            <ul className="space-y-4">
              {acceptedBookings.map(trip => (
                <li key={trip.id} className="p-4 bg-green-50 rounded-xl border border-green-200 shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-gray-800">{trip.buddyName}</div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${trip.paymentInitiated ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                      {trip.paymentInitiated ? 'Payment Ready' : 'Accepted'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    <div>📞 {trip.buddyPhone || 'No phone'}</div>
                    <div>📧 {trip.buddyEmail}</div>
                  </div>
                  <div className="text-sm text-gray-500 mb-3">
                    <div>📍 {trip.source} → 🎯 {trip.destination}</div>
                    <div>💰 ₹{trip.fare}</div>
                  </div>
                  {!trip.paymentInitiated && (
                    <button
                      onClick={() => handleInitiatePayment(trip.id)}
                      className="w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white py-2 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-800 transition text-sm mb-2"
                    >
                      Initiate Payment
                    </button>
                  )}
                  <button
                    onClick={() => handleStartTripForBuddy(trip.id)}
                    className="w-full bg-gradient-to-r from-yellow-400 to-green-600 text-white py-2 rounded-lg font-semibold hover:from-yellow-500 hover:to-green-700 transition text-sm"
                  >
                    Start Trip
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

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
              <div className="font-semibold text-gray-800">{user.email}</div>
            </div>
            <div className="p-3 bg-white rounded-lg border border-gray-200">
              <div className="text-sm text-gray-500">Car Type</div>
              <div className="font-semibold text-gray-800">{userProfile?.carType || 'Not specified'}</div>
            </div>
          </div>
        </div>

        {/* Trips Chart */}
        <div className="mb-6 p-6 bg-white rounded-2xl border border-gray-200 shadow-lg">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Trips in Last 5 Days</h3>
          <TripChart tripData={[3, 5, 2, 7, 4]} />
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={onShowProfile}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white px-4 py-3 rounded-lg font-semibold shadow hover:from-blue-600 hover:to-blue-800 transition"
          >
            View Full Profile
          </button>
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
          <div className="mt-6">
            <BottomNavBar currentTab={pilotTab} onTabChange={setPilotTab} userType="pilot" />
          </div>
        </div>
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

  const handleSearch = async () => {
    if (source && destination && desiredTime) {
      setSearching(true);
      setSearchError('');
      setAvailableTrips([]);
      try {
        const normSource = normalizePlace(source);
        const normDest = normalizePlace(destination);
        const desiredDate = new Date(desiredTime);
        const windowMs = 30 * 60 * 1000; // 30 minutes in ms
        const q = query(
          collection(db, 'trips'),
          where('source', '==', normSource),
          where('destination', '==', normDest),
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
        // Sort trips by pilot ratings (highest first)
        const tripsWithRatings = await Promise.all(
          trips.map(async (trip) => {
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
      alert('Please enter source, destination, and desired time');
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
        fare: trip.fare,
        distance: trip.distance,
        status: 'pending',
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'bookings'), bookingData);
      setAvailableTrips(prev => prev.filter(t => t.id !== trip.id));
      toast.success('Booking request sent! Waiting for pilot to accept.');
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
      await updateDoc(doc(db, 'trips', myAcceptedTrip.id), {
        paymentStatus: 'completed',
        paymentMethod: 'upi',
        upiId: upiId
      });
      setBuddyPaymentDone(true);
      toast.success('Payment completed!');
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
            <button
              type="button"
              onClick={handleUseMyLocation}
              className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-200 transition"
              title="Use my current location"
            >
              Use My Location
            </button>
          </div>
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
          <button
            onClick={handleSearch}
            className={`w-full py-2 sm:py-3 rounded-lg sm:rounded-xl font-semibold shadow-lg transition text-sm sm:text-base ${searching ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-yellow-400 to-green-500 text-white hover:from-yellow-500 hover:to-green-600'}`}
            disabled={searching}
          >
            {searching ? 'Searching...' : 'Find a Pilot'}
          </button>
          {searchError && <div className="text-red-600 text-xs sm:text-sm mt-2">{searchError}</div>}
        </div>
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
        {availableTrips.length > 0 && (
          <div className="mb-4 sm:mb-6 text-left">
            <h3 className="text-base sm:text-lg font-bold mb-2 text-gray-800">Available Pilots (Sorted by Rating):</h3>
            <ul className="space-y-3">
              {availableTrips.map(trip => (
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
                    <div className="text-green-700 font-semibold">💰 Fare: ₹{trip.fare ?? <span className="text-red-500">Not set</span>}</div>
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
                <button
                  onClick={confirmBooking}
                  className="flex-1 py-2 sm:py-3 bg-gradient-to-r from-green-500 to-green-700 text-white rounded-lg sm:rounded-xl font-semibold hover:from-green-600 hover:to-green-800 transition text-sm"
                  disabled={bookingLoading}
                >
                  {bookingLoading ? 'Processing...' : 'Proceed to Payment'}
                </button>
              </div>
            </div>
          </div>
        )}
        {showPayment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
            <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 max-w-sm sm:max-w-md w-full shadow-2xl">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">UPI Payment</h3>
              
              <div className="mb-6 p-4 bg-blue-50 rounded-lg sm:rounded-xl border border-blue-200">
                <div className="text-center mb-4">
                  <div className="text-2xl font-bold text-blue-800">₹{bookingTrip?.fare}</div>
                  <div className="text-sm text-gray-600">Amount to be paid</div>
                </div>
                <div className="text-xs sm:text-sm text-gray-700 space-y-1">
                  <div>📍 From: {bookingTrip?.source || <span className="text-red-500">Not set</span>}</div>
                  <div>🎯 To: {bookingTrip?.destination || <span className="text-red-500">Not set</span>}</div>
                  <div>👤 Pilot: {bookingTrip?.driverName}</div>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">Select UPI App</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm sm:text-base"
                  >
                    <option value="">Choose UPI App</option>
                    <option value="gpay">Google Pay</option>
                    <option value="phonepe">PhonePe</option>
                    <option value="paytm">Paytm</option>
                    <option value="amazonpay">Amazon Pay</option>
                    <option value="bhim">BHIM</option>
                    <option value="other">Other UPI Apps</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">Pilot's UPI ID</label>
                  <input
                    type="text"
                    placeholder="Enter pilot's UPI ID (e.g., pilot@upi)"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm sm:text-base"
                  />
                  <p className="text-xs text-gray-500 mt-1">Ask the pilot for their UPI ID</p>
                </div>
              </div>

              <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 mb-6">
                <div className="text-xs sm:text-sm text-yellow-800">
                  <strong>Payment Instructions:</strong>
                  <ol className="list-decimal list-inside mt-2 space-y-1">
                    <li>Select your preferred UPI app</li>
                    <li>Enter the pilot's UPI ID</li>
                    <li>Pay ₹{bookingTrip?.fare} to the pilot</li>
                    <li>Confirm payment to complete booking</li>
                  </ol>
                </div>
              </div>

              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={cancelPayment}
                  className="flex-1 py-2 sm:py-3 bg-gray-500 text-white rounded-lg sm:rounded-xl font-semibold hover:bg-gray-600 transition text-sm"
                  disabled={paymentLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={processPayment}
                  className="flex-1 py-2 sm:py-3 bg-gradient-to-r from-green-500 to-green-700 text-white rounded-lg sm:rounded-xl font-semibold hover:from-green-600 hover:to-green-800 transition text-sm"
                  disabled={paymentLoading || !paymentMethod || !upiId.trim()}
                >
                  {paymentLoading ? 'Processing Payment...' : 'Confirm Payment'}
                </button>
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
  } else if (buddyTab === 'bookings') {
    mainContent = (
      <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-10 w-full max-w-sm sm:max-w-md shadow-2xl text-center border border-yellow-200 mb-10 mx-auto">
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
      <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-10 w-full max-w-sm sm:max-w-md shadow-2xl text-center border border-yellow-200 mb-10 mx-auto">
        <AnimatedTitle />
        <UserProfile user={user} userProfile={userProfile} />
        <button
          onClick={onShowProfile}
          className="w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white px-4 py-2 rounded-lg font-semibold shadow hover:from-blue-600 hover:to-blue-800 transition text-sm mt-2"
        >
          View Full Profile
        </button>
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
          <div className="mt-6">
            <BottomNavBar currentTab={buddyTab} onTabChange={setBuddyTab} userType="buddy" />
          </div>
        </div>
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
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-10 w-full max-w-sm sm:max-w-md shadow-2xl border border-blue-200">
        <div className="text-center mb-6 sm:mb-8">
          <Car className="w-12 h-12 sm:w-16 sm:h-16 text-blue-600 mx-auto mb-4" />
          <AnimatedTitle />
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-gray-700 font-medium mb-1 text-sm sm:text-base">Email Address</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm sm:text-base"
              required
            />
          </div>
          
          <div>
            <label className="block text-gray-700 font-medium mb-1 text-sm sm:text-base">Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm sm:text-base"
              required
            />
          </div>

          {isSignUp && (
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-sm sm:text-base">Confirm Password</label>
              <input
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm sm:text-base"
                required
              />
            </div>
          )}

          {error && <div className="text-red-600 text-xs sm:text-sm">{error}</div>}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white py-2 sm:py-3 rounded-lg sm:rounded-xl font-semibold shadow-lg hover:from-blue-600 hover:to-blue-800 transition flex items-center justify-center gap-2 text-sm sm:text-base"
            disabled={loading}
          >
            {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <div className="mt-4 sm:mt-6 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-blue-600 hover:text-blue-800 font-medium text-sm sm:text-base"
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
    libraries: ['places'],
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
