// Firebase Collections Structure
export const COLLECTIONS = {
  // User profiles with extended data
  USER_PROFILES: 'userProfiles',
  
  // Trips with enhanced pickup points
  TRIPS: 'trips',
  
  // Pickup points along routes
  PICKUP_POINTS: 'pickupPoints',
  
  // Bookings with flexible pickup
  BOOKINGS: 'bookings',
  
  // Real-time chat messages
  CHATS: 'chats',
  MESSAGES: 'messages',
  
  // Payment transactions
  PAYMENTS: 'payments',
  
  // Ratings and reviews
  RATINGS: 'ratings',
  
  // Analytics data
  ANALYTICS: 'analytics',
  
  // FCM tokens for notifications
  FCM_TOKENS: 'fcmTokens',
  
  // Trip events for analytics
  TRIP_EVENTS: 'tripEvents'
};

// Trip status constants
export const TRIP_STATUS = {
  AVAILABLE: 'available',
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  STARTED: 'started',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// Payment status constants
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  INITIATED: 'initiated',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

// Rating triggers
export const RATING_TRIGGERS = {
  TRIP_COMPLETED: 'trip_completed',
  PAYMENT_COMPLETED: 'payment_completed'
};
