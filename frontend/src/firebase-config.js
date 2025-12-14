// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCB2RMnZKYHgehMd5p_zx1qLNlqLm5Gero",
  authDomain: "iot-smartlock-1f6d5.firebaseapp.com",
  databaseURL:
    "https://iot-smartlock-1f6d5-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "iot-smartlock-1f6d5",
  storageBucket: "iot-smartlock-1f6d5.firebasestorage.app",
  messagingSenderId: "1039925264410",
  appId: "1:1039925264410:web:37443ef66118a4cef311a3",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);
