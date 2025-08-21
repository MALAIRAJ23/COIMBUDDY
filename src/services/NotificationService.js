import { getMessaging, getToken, onMessage, deleteToken } from 'firebase/messaging';
import { app } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../firebase/collections';
import toast from 'react-hot-toast';

class NotificationService {
  constructor() {
    this.messaging = null;
    this.currentToken = null;
    this.isSupported = this.checkSupport();
    
    if (this.isSupported) {
      this.initializeMessaging();
    }
  }

  // Check if notifications are supported
  checkSupport() {
    return 'Notification' in window && 
           'serviceWorker' in navigator && 
           'PushManager' in window;
  }

  // Initialize Firebase Messaging
  initializeMessaging() {
    try {
      this.messaging = getMessaging(app);
      this.setupMessageListener();
    } catch (error) {
      console.error('Error initializing messaging:', error);
    }
  }

  // Request notification permission
  async requestPermission() {
    if (!this.isSupported) {
      console.warn('Notifications not supported');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        console.log('Notification permission granted');
        return true;
      } else {
        console.log('Notification permission denied');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  // Get FCM token
  async getToken() {
    if (!this.messaging || !this.isSupported) {
      return null;
    }

    try {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        return null;
      }

      const token = await getToken(this.messaging, {
        vapidKey: 'YOUR_VAPID_PUBLIC_KEY' // Replace with your VAPID key
      });

      if (token) {
        this.currentToken = token;
        console.log('FCM Token:', token);
        return token;
      } else {
        console.log('No registration token available');
        return null;
      }
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  // Save token to Firestore
  async saveTokenToFirestore(userId, token) {
    if (!token || !userId) return;

    try {
      const tokenData = {
        userId,
        token,
        platform: 'web',
        userAgent: navigator.userAgent,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isActive: true
      };

      // Check if token already exists
      const existingTokenQuery = await db
        .collection(COLLECTIONS.FCM_TOKENS)
        .where('userId', '==', userId)
        .where('token', '==', token)
        .get();

      if (existingTokenQuery.empty) {
        // Add new token
        await addDoc(collection(db, COLLECTIONS.FCM_TOKENS), tokenData);
        console.log('FCM token saved to Firestore');
      } else {
        // Update existing token
        const existingToken = existingTokenQuery.docs[0];
        await updateDoc(doc(db, COLLECTIONS.FCM_TOKENS, existingToken.id), {
          updatedAt: serverTimestamp(),
          isActive: true
        });
        console.log('FCM token updated in Firestore');
      }
    } catch (error) {
      console.error('Error saving FCM token to Firestore:', error);
    }
  }

  // Delete token
  async deleteToken() {
    if (!this.messaging) return;

    try {
      await deleteToken(this.messaging);
      this.currentToken = null;
      console.log('FCM token deleted');
    } catch (error) {
      console.error('Error deleting FCM token:', error);
    }
  }

  // Setup message listener for foreground messages
  setupMessageListener() {
    if (!this.messaging) return;

    onMessage(this.messaging, (payload) => {
      console.log('Foreground message received:', payload);
      
      // Show toast notification
      this.showToastNotification(payload);
      
      // Handle different message types
      this.handleMessageType(payload);
    });
  }

  // Show toast notification
  showToastNotification(payload) {
    const title = payload.notification?.title || 'Car Pooling';
    const body = payload.notification?.body || 'You have a new notification';
    
    toast.success(`${title}: ${body}`, {
      duration: 5000,
      position: 'top-right',
      icon: '🚗'
    });
  }

  // Handle different message types
  handleMessageType(payload) {
    const messageType = payload.data?.type;
    
    switch (messageType) {
      case 'booking_request':
        this.handleBookingRequest(payload);
        break;
      case 'trip_started':
        this.handleTripStarted(payload);
        break;
      case 'trip_completed':
        this.handleTripCompleted(payload);
        break;
      case 'payment_required':
        this.handlePaymentRequired(payload);
        break;
      case 'rating_reminder':
        this.handleRatingReminder(payload);
        break;
      default:
        console.log('Unknown message type:', messageType);
    }
  }

  // Handle booking request notification
  handleBookingRequest(payload) {
    const tripId = payload.data?.tripId;
    const buddyName = payload.data?.buddyName;
    
    toast.success(`New booking request from ${buddyName}!`, {
      duration: 8000,
      position: 'top-right',
      icon: '👤',
      onClick: () => {
        // Navigate to booking page
        window.location.href = `/bookings?tripId=${tripId}`;
      }
    });
  }

  // Handle trip started notification
  handleTripStarted(payload) {
    const pilotName = payload.data?.pilotName;
    
    toast.success(`Trip started by ${pilotName}!`, {
      duration: 6000,
      position: 'top-right',
      icon: '🚗'
    });
  }

  // Handle trip completed notification
  handleTripCompleted(payload) {
    toast.success('Trip completed! Please rate your experience.', {
      duration: 8000,
      position: 'top-right',
      icon: '✅',
      onClick: () => {
        const tripId = payload.data?.tripId;
        window.location.href = `/rate?tripId=${tripId}`;
      }
    });
  }

  // Handle payment required notification
  handlePaymentRequired(payload) {
    const amount = payload.data?.amount;
    
    toast.success(`Payment of ₹${amount} is required.`, {
      duration: 8000,
      position: 'top-right',
      icon: '💰',
      onClick: () => {
        const tripId = payload.data?.tripId;
        window.location.href = `/payment?tripId=${tripId}`;
      }
    });
  }

  // Handle rating reminder notification
  handleRatingReminder(payload) {
    toast.success('Please rate your recent trip!', {
      duration: 8000,
      position: 'top-right',
      icon: '⭐',
      onClick: () => {
        const tripId = payload.data?.tripId;
        window.location.href = `/rate?tripId=${tripId}`;
      }
    });
  }

  // Subscribe to topics
  async subscribeToTopic(topic) {
    if (!this.currentToken) {
      console.warn('No FCM token available');
      return false;
    }

    try {
      // In a real implementation, you would call your backend to subscribe to topics
      // For now, we'll just log the subscription
      console.log(`Subscribing to topic: ${topic}`);
      
      // Save topic subscription to Firestore
      await addDoc(collection(db, 'topicSubscriptions'), {
        userId: this.getCurrentUserId(),
        token: this.currentToken,
        topic,
        subscribedAt: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error subscribing to topic:', error);
      return false;
    }
  }

  // Unsubscribe from topics
  async unsubscribeFromTopic(topic) {
    if (!this.currentToken) {
      console.warn('No FCM token available');
      return false;
    }

    try {
      console.log(`Unsubscribing from topic: ${topic}`);
      
      // Remove topic subscription from Firestore
      const subscriptionQuery = await db
        .collection('topicSubscriptions')
        .where('userId', '==', this.getCurrentUserId())
        .where('topic', '==', topic)
        .get();

      for (const doc of subscriptionQuery.docs) {
        await doc.ref.delete();
      }
      
      return true;
    } catch (error) {
      console.error('Error unsubscribing from topic:', error);
      return false;
    }
  }

  // Get current user ID (implement based on your auth system)
  getCurrentUserId() {
    // This should return the current user's ID
    // Implement based on your authentication system
    return localStorage.getItem('userId') || null;
  }

  // Initialize notifications for a user
  async initializeForUser(userId) {
    if (!this.isSupported) {
      console.warn('Notifications not supported');
      return false;
    }

    try {
      const token = await this.getToken();
      if (token) {
        await this.saveTokenToFirestore(userId, token);
        
        // Subscribe to user-specific topics
        await this.subscribeToTopic(`user_${userId}`);
        
        console.log('Notifications initialized for user:', userId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error initializing notifications for user:', error);
      return false;
    }
  }

  // Cleanup notifications
  async cleanup() {
    try {
      await this.deleteToken();
      console.log('Notifications cleaned up');
    } catch (error) {
      console.error('Error cleaning up notifications:', error);
    }
  }
}

// Create singleton instance
const notificationService = new NotificationService();

export default notificationService;
