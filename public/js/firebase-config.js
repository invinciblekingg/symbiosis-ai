/**
 * Firebase Configuration for Symbiosis.ai
 * 
 * IMPORTANT: Replace the configuration below with your own Firebase credentials
 * from the Firebase Console (https://console.firebase.google.com)
 * 
 * To get your config:
 * 1. Go to Firebase Console
 * 2. Select your project (or create one)
 * 3. Click the gear icon > Project settings
 * 4. Scroll down to "Your apps" section
 * 5. Click the </> (web) icon to create a web app
 * 6. Copy the firebaseConfig object
 */

// Firebase configuration
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
let db = null;
let firebaseInitialized = false;

try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    firebaseInitialized = true;
    console.log('✅ Firebase initialized successfully');
} catch (error) {
    console.warn('⚠️ Firebase not configured. Using local storage fallback.');
    console.log('To enable Firebase, update firebase-config.js with your credentials.');
}

// Database references
const getRef = (path) => {
    if (db) {
        return db.ref(path);
    }
    return null;
};

// Utility functions for database operations
const dbOperations = {
    // Write data
    async set(path, data) {
        if (db) {
            return db.ref(path).set(data);
        }
        // Fallback to localStorage
        localStorage.setItem(`symbiosis_${path}`, JSON.stringify(data));
        return Promise.resolve();
    },

    // Read data
    async get(path) {
        if (db) {
            const snapshot = await db.ref(path).once('value');
            return snapshot.val();
        }
        // Fallback to localStorage
        const data = localStorage.getItem(`symbiosis_${path}`);
        return data ? JSON.parse(data) : null;
    },

    // Update data
    async update(path, data) {
        if (db) {
            return db.ref(path).update(data);
        }
        // Fallback to localStorage
        const existing = await this.get(path) || {};
        const updated = { ...existing, ...data };
        localStorage.setItem(`symbiosis_${path}`, JSON.stringify(updated));
        return Promise.resolve();
    },

    // Delete data
    async remove(path) {
        if (db) {
            return db.ref(path).remove();
        }
        // Fallback to localStorage
        localStorage.removeItem(`symbiosis_${path}`);
        return Promise.resolve();
    },

    // Push new data (auto-generate key)
    async push(path, data) {
        if (db) {
            const newRef = db.ref(path).push();
            await newRef.set(data);
            return newRef.key;
        }
        // Fallback to localStorage
        const key = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const allData = await this.get(path) || {};
        allData[key] = data;
        localStorage.setItem(`symbiosis_${path}`, JSON.stringify(allData));
        return key;
    },

    // Query data by child value
    async queryByChild(path, childKey, childValue) {
        if (db) {
            const snapshot = await db.ref(path)
                .orderByChild(childKey)
                .equalTo(childValue)
                .once('value');
            return snapshot.val();
        }
        // Fallback - search localStorage
        const allData = await this.get(path) || {};
        const results = {};
        Object.entries(allData).forEach(([key, value]) => {
            if (value && value[childKey] === childValue) {
                results[key] = value;
            }
        });
        return Object.keys(results).length > 0 ? results : null;
    },

    // Listen for real-time updates
    onValue(path, callback) {
        if (db) {
            return db.ref(path).on('value', (snapshot) => {
                callback(snapshot.val());
            });
        }
        // Fallback - no real-time updates with localStorage
        this.get(path).then(callback);
        return null;
    },

    // Stop listening
    offValue(path) {
        if (db) {
            db.ref(path).off();
        }
    }
};

// Export for use in other files
window.firebaseConfig = firebaseConfig;
window.db = db;
window.dbOperations = dbOperations;
window.firebaseInitialized = firebaseInitialized;
