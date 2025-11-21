import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyA44xMyP25x9dgJLeW1gEQGqHbLTbTyJnY",
  authDomain: "po221-ebe22.firebaseapp.com",
  projectId: "po221-ebe22",
  storageBucket: "po221-ebe22.firebasestorage.app",
  messagingSenderId: "376729413249",
  appId: "1:376729413249:web:f0d7e9a742b0a5c0550f80",
  measurementId: "G-D50KRD6BEJ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
