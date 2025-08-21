// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCm7f1e25LYjUVupY0Iy9b7q5lfyWG2K7Y",
  authDomain: "car-pooling-7cabf.firebaseapp.com",
  projectId: "car-pooling-7cabf",
  storageBucket: "car-pooling-7cabf.firebasestorage.app",
  messagingSenderId: "623408792304",
  appId: "1:623408792304:web:a3b62bd358d0268529f835",
  measurementId: "G-CEXMTTWV9W"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'Car Pooling';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: payload.data?.tag || 'default',
    data: payload.data,
    actions: payload.data?.actions ? JSON.parse(payload.data.actions) : [],
    requireInteraction: payload.data?.requireInteraction === 'true',
    silent: payload.data?.silent === 'true'
  };

  // Show notification
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  event.notification.close();

  // Handle notification actions
  if (event.action) {
    handleNotificationAction(event.action, event.notification.data);
    return;
  }

  // Default click behavior
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window/tab open with the target URL
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no window/tab is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
  
  // Track notification close for analytics
  if (event.notification.data?.analytics) {
    trackNotificationEvent('close', event.notification.data);
  }
});

// Handle notification action
function handleNotificationAction(action, data) {
  switch (action) {
    case 'accept_booking':
      // Open chat or booking page
      const chatUrl = `/chat?tripId=${data.tripId}`;
      clients.openWindow(chatUrl);
      break;
      
    case 'view_trip':
      // Open trip details
      const tripUrl = `/trip/${data.tripId}`;
      clients.openWindow(tripUrl);
      break;
      
    case 'rate_trip':
      // Open rating page
      const ratingUrl = `/rate?tripId=${data.tripId}`;
      clients.openWindow(ratingUrl);
      break;
      
    case 'dismiss':
      // Just dismiss the notification
      break;
      
    default:
      // Default action - open main app
      clients.openWindow('/');
  }
}

// Track notification events for analytics
function trackNotificationEvent(eventType, data) {
  // Send analytics data to your backend
  fetch('/api/analytics/notification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      eventType,
      data,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    })
  }).catch(error => {
    console.error('Error tracking notification event:', error);
  });
}

// Handle push subscription changes
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('Push subscription changed:', event);
  
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: 'YOUR_VAPID_PUBLIC_KEY' // Replace with your VAPID key
    }).then((subscription) => {
      // Send new subscription to server
      return fetch('/api/fcm/update-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription)
      });
    })
  );
});

// Handle service worker installation
self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
  self.skipWaiting();
});

// Handle service worker activation
self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(self.clients.claim());
});

// Handle message from main thread
self.addEventListener('message', (event) => {
  console.log('Message received in service worker:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
