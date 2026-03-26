
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
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

let app: admin.app.App;

if (typeof window === 'undefined') {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : null;

  if (admin.apps.length === 0) {
    if (serviceAccount) {
      app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      console.warn("Firebase Admin SDK: Service account key is missing. This is expected in a client-only environment but will fail in a server environment.");
    }
  } else {
    app = admin.app();
  }
}

// @ts-ignore - app can be undefined on the client
const auth = app ? getAuth(app) : null;
// @ts-ignore
const db = app ? getFirestore(app) : null;

if (typeof window === 'undefined' && (!auth || !db)) { 
    console.warn("Firebase Admin components (Auth, Firestore) are not available. Ensure service account is configured for server-side operations.");
}

export { admin, auth, db };
