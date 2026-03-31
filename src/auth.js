/*!
 * Authentication Utilities — Vivid Pulse
 * Wraps Firebase Auth: Google (GCP OAuth), email/password,
 * sign-out, and route guard helpers.
 */
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from './firebase.js';

const googleProvider = new GoogleAuthProvider();
// Request the user's GCP account via Google Identity (OAuth 2.0)
googleProvider.setCustomParameters({ prompt: 'select_account' });

// ── Sign-in methods ────────────────────────────────────────────────────────────

/** Sign in with Google (GCP OAuth popup) */
export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

/** Sign in with email + password */
export function signInWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

/** Register a new user with email + password */
export function registerWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

/** Sign out the current user */
export function logout() {
  return signOut(auth);
}

// ── Auth state helpers ────────────────────────────────────────────────────────

/**
 * Subscribe to auth-state changes.
 * Returns the Firebase unsubscribe function.
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Route guard — resolves with the current user or redirects to `redirectTo`.
 * Call at the top of any protected page module.
 *
 * @param {string} redirectTo  Path to redirect unauthenticated visitors.
 * @returns {Promise<import('firebase/auth').User>}
 */
export function requireAuth(redirectTo = '/login') {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (!user) {
        window.location.href = redirectTo;
      } else {
        resolve(user);
      }
    });
  });
}

/**
 * Redirect already-authenticated users away from public pages (e.g. login).
 *
 * @param {string} redirectTo  Path to redirect authenticated visitors.
 * @returns {Promise<void>}
 */
export function redirectIfAuthenticated(redirectTo = '/crm') {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (user) {
        window.location.href = redirectTo;
      } else {
        resolve();
      }
    });
  });
}
