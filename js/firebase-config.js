// Konfigurasi Firebase Anda
const firebaseConfig = {
    apiKey: "AIzaSyAqYV5yjWgr9PIxj-9LNiGX4oiTiYBTRJo",
    authDomain: "keuangan-mai.firebaseapp.com",
    projectId: "keuangan-mai",
    storageBucket: "keuangan-mai.firebasestorage.app",
    messagingSenderId: "456003078118",
    appId: "1:456003078118:web:356440fc13083ee9897827",
    measurementId: "G-LZ0LNMGT5B"
};

// Inisialisasi Firebase menggunakan SDK v10 (Compat version)
firebase.initializeApp(firebaseConfig);

// Inisialisasi Firestore
const db = firebase.firestore();
