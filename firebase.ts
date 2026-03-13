
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, onSnapshot, deleteDoc, serverTimestamp, getDocFromServer, enableIndexedDbPersistence } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code == 'failed-precondition') {
    console.warn('Multiple tabs open, persistence can only be enabled in one tab at a a time.');
  } else if (err.code == 'unimplemented') {
    console.warn('The current browser does not support all of the features required to enable persistence');
  }
});

export const googleProvider = new GoogleAuthProvider();

// Auth functions
export const loginWithGoogle = async () => {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
};
export const logout = () => signOut(auth);

// Connection test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
  }
}
testConnection();

export { onAuthStateChanged };
export type { User };
