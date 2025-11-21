// Import Firebase SDK
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA44xMyP25x9dgJLeW1gEQGqHbLTbTyJnY",
  authDomain: "po221-ebe22.firebaseapp.com",
  projectId: "po221-ebe22",
  storageBucket: "po221-ebe22.firebasestorage.app",
  messagingSenderId: "376729413249",
  appId: "1:376729413249:web:f0d7e9a742b0a5c0550f80",
  measurementId: "G-D50KRD6BEJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Services
const auth = getAuth(app);        // Authentication
const db = getFirestore(app);     // Firestore Database
const storage = getStorage(app);  // File Storage
const functions = getFunctions(app); // Cloud Functions

// Export
export { auth, db, storage, functions };
