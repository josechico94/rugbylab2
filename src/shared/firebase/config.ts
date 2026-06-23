import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
const app = initializeApp({
  apiKey: "AIzaSyBgJGdZPC8r1gVyCpxFCavjpVr92-ZIkjY",
  authDomain: "rugbylab-86cf0.firebaseapp.com",
  projectId: "rugbylab-86cf0",
  storageBucket: "rugbylab-86cf0.firebasestorage.app",
  messagingSenderId: "41099002550",
  appId: "1:41099002550:web:315286fb9afd7752fb5c17",
})
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
