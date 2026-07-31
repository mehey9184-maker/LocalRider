importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Initialize Firebase App in service worker
const firebaseConfig = {
  authDomain: "localeats-5e26e.firebaseapp.com",
  projectId: "localeats-5e26e",
  storageBucket: "localeats-5e26e.firebasestorage.app",
  messagingSenderId: "281496568360",
  appId: "1:281496568360:web:localeats"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  
  const notificationTitle = payload?.notification?.title || payload?.data?.title || '🚨 New Delivery Mission Offered!';
  const notificationOptions = {
    body: payload?.notification?.body || payload?.data?.body || 'You have a new dispatch alert in LocalEats Rider.',
    icon: '/app-icon.svg',
    badge: '/app-icon.svg',
    vibrate: [200, 100, 200, 100, 200],
    data: payload?.data || {},
    tag: payload?.data?.order_id || 'localeats-notification',
    renotify: true
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});
