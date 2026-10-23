// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your web app's Firebase configuration
// TODO: Replace with your actual Firebase project configuration
const firebaseConfig = {
    apiKey: "AIzaSyCwfm6t9UxXc_2sLZtMx46wxiKOkoc3REo",
    authDomain: "symbiosisai-e3ed3.firebaseapp.com",
    databaseURL: "https://symbiosisai-e3ed3-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "symbiosisai-e3ed3",
    storageBucket: "symbiosisai-e3ed3.firebasestorage.app",
    messagingSenderId: "568798717688",
    appId: "1:568798717688:web:323303084dd301aae9bd0d"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
