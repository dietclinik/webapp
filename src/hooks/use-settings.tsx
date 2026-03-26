
"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useFirebase } from '@/components/firebase-provider';

interface Settings {
  themeSettings?: any;
  homepageSettings?: any;
  paymentSettings?: any;
  customFields?: any;
}

interface SettingsContextType {
  settings: Settings | null;
  loading: boolean;
  refetch: () => void;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: null,
  loading: true,
  refetch: () => {},
});

export const useSettings = () => {
  return useContext(SettingsContext);
};

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const { db } = useFirebase();

  const fetchSettings = useCallback(async () => {
    // Don't refetch if settings are already loaded
    if(settings) {
        setLoading(false);
        return;
    }

    if (!db) {
        setLoading(false);
        return;
    }
    
    setLoading(true);
    try {
      const settingsDocRef = doc(db, 'settings', 'global');
      const docSnap = await getDoc(settingsDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings(data);
        localStorage.setItem('globalSettings', JSON.stringify(data));
      } else {
         const savedSettings = localStorage.getItem('globalSettings');
         if(savedSettings) {
            setSettings(JSON.parse(savedSettings));
         }
      }
    } catch (error) {
      console.error('Failed to fetch settings from Firestore:', error);
       const savedSettings = localStorage.getItem('globalSettings');
       if(savedSettings) {
          setSettings(JSON.parse(savedSettings));
       }
    } finally {
      setLoading(false);
    }
  }, [db, settings]);

  useEffect(() => {
    fetchSettings();

    const handleSettingsUpdate = () => {
        localStorage.removeItem('globalSettings');
        setSettings(null); // Force refetch
        fetchSettings();
    };
    
    window.addEventListener('settings-updated', handleSettingsUpdate);

    return () => {
        window.removeEventListener('settings-updated', handleSettingsUpdate);
    }
  }, [fetchSettings]);

  return (
    <SettingsContext.Provider value={{ settings, loading, refetch: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};
