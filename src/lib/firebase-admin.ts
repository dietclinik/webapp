
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
let auth: ReturnType<typeof getAuth> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;

if (typeof window === 'undefined') {
  try {
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

    // getAuth()/getFirestore() can themselves throw (e.g. a malformed project ID in the
    // service account) -- keep them inside this same try/catch, not after it, so any
    // failure here still degrades gracefully instead of crashing the whole module at
    // import time (which would otherwise fail every route/flow that imports
    // `admin`/`auth`/`db`, turning into an opaque empty 500 with no JSON body).
    if (app) {
      auth = getAuth(app);
      db = getFirestore(app);
    }
  } catch (e) {
    console.error("Firebase Admin SDK: failed to initialize.", e);
  }
}

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
