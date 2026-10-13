
import { getApps, getApp, initializeApp, cert, type App } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

/**
 * =================================================================================
 * FIRESTORE SECURITY RULES
 * =================================================================================
 * The security rules for this project are located in the `firestore.rules`
 * file in the root of the project.
 *
 * You must deploy these rules to Firebase for the database to be secure.
 * =================================================================================
 */

// This file is intended for server-side use (e.g., in Genkit flows).
// The logic to initialize Firebase on the client-side is in `firebase-provider.tsx`.

let app: App | undefined;

if (typeof window === 'undefined') {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : null;

  if (getApps().length === 0) {
    if (serviceAccount) {
      app = initializeApp({
        credential: cert(serviceAccount),
      });
    } else {
      console.warn("Firebase Admin SDK: Service account key is missing. This is expected in a client-only environment but will fail in a server environment.");
    }
  } else {
    app = getApp();
  }
}

const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

if (typeof window === 'undefined' && (!auth || !db)) {
    console.warn("Firebase Admin components (Auth, Firestore) are not available. Ensure service account is configured for server-side operations.");
}

// Namespace-style shim: firebase-admin v14's default/namespace import no longer
// exposes `.apps`, `.auth()`, `.credential`, `.firestore`, etc. at runtime, so
// existing call sites (`admin.apps.length`, `admin.auth()`, `admin.firestore.FieldValue`)
// are served from this modular-API-backed object instead.
const admin = {
  apps: app ? [app] : [],
  app: () => {
    if (!app) throw new Error('Firebase Admin app is not initialized.');
    return app;
  },
  auth: () => {
    if (!auth) throw new Error('Firebase Admin Auth is not initialized.');
    return auth;
  },
  credential: { cert },
  firestore: { FieldValue, Timestamp },
  initializeApp,
};

export { admin, auth, db };
