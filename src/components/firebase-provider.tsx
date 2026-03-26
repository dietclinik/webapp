
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { Skeleton } from './ui/skeleton';
import { SettingsProvider, useSettings } from '@/hooks/use-settings';
import { Logo } from './logo';
import { FirebaseErrorListener } from './FirebaseErrorListener';

type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
};

const FirebaseContext = createContext<FirebaseServices | null>(null);

const AppLoader = ({ children }: { children: ReactNode }) => {
    const { loading: settingsLoading } = useSettings();
    if(settingsLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="flex flex-col items-center gap-4 animate-logo-pulse">
                    <Logo />
                </div>
            </div>
        );
    }
    return <>{children}</>;
}


export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error("useFirebase must be used within a FirebaseProvider");
  }
  return context;
};

export const FirebaseProvider = ({ children }: { children: ReactNode }) => {
  const [services, setServices] = useState<FirebaseServices | null>(null);
  
  useEffect(() => {
    // Define config inside useEffect to ensure env vars are available on the client
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
    
    if (firebaseConfig.apiKey) {
      const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
      const auth = getAuth(app);
      const db = getFirestore(app);
      const storage = getStorage(app);
      setServices({ app, auth, db, storage });
    } else {
        console.error("Firebase API Key is missing. Check your environment variables.");
    }
  }, []);

  if (!services) {
     return (
        <div className="flex items-center justify-center h-screen">
            <div className="flex flex-col items-center gap-4 animate-logo-pulse">
                <Logo />
            </div>
        </div>
    );
  }

  return (
    <FirebaseContext.Provider value={services}>
      <SettingsProvider>
        <FirebaseErrorListener />
        <AppLoader>{children}</AppLoader>
      </SettingsProvider>
    </FirebaseContext.Provider>
  );
};
