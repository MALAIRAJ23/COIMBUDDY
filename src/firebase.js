// src/firebase.js

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Replace with your own Firebase project config
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
const app = initializeApp(firebaseConfig);

// Initialize Auth
const auth = getAuth(app);

// Initialize Firestore
const db = getFirestore(app);

// Optional: disable app verification in development
if (process.env.NODE_ENV === "development") {
  auth.settings.appVerificationDisabledForTesting = true;
}

export { auth, db };
