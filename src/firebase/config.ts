
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";


const firebaseConfig = {
    apiKey: "AIzaSyBBhYwVgIzdm3e0JDHSJhJ41tojR4if0vw",
    authDomain: "edusync-1c4d5.firebaseapp.com",
    projectId: "edusync-1c4d5",
    storageBucket: "edusync-1c4d5.firebasestorage.app",
    messagingSenderId: "547118823426",
    appId: "1:547118823426:web:66e5204419340bb21e0f1b",
};

console.log("FIREBASE CONFIG IN APP:", firebaseConfig);

const app = initializeApp(firebaseConfig);


const auth = getAuth(app);


const db = getFirestore(app);


const storage = getStorage(app);

export { app, auth, db, storage };
