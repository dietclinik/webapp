
"use client";

import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { useEffect, useCallback } from "react";
import { doc, getDoc } from "firebase/firestore";
import { FirebaseProvider, useFirebase } from "@/components/firebase-provider";
import { ThemeProvider } from "@/components/theme-provider";

function DynamicStylesLoader() {
  const { db } = useFirebase();

  const applyStyles = (settings: any) => {
    if (!settings?.themeSettings) return;
    const themeSettings = settings.themeSettings;
    const root = document.documentElement;
    // Handle non-color properties
    if (themeSettings.logoColor) root.style.setProperty('--logo-color', `hsl(${themeSettings.logoColor})`);
    if (themeSettings.logoIconSize) root.style.setProperty('--logo-icon-size', `${themeSettings.logoIconSize}px`);
    if (themeSettings.fontFamily) {
        root.style.setProperty('--font-family-body', themeSettings.fontFamily);
        root.style.setProperty('--font-family-headline', themeSettings.fontFamily);
    }
    if (themeSettings.fontSize) root.style.setProperty('--font-size-base', `${themeSettings.fontSize}px`);
    if (themeSettings.headingScale) root.style.setProperty('--heading-scale', themeSettings.headingScale.toString());
    if (themeSettings.sidebarIconSize) root.style.setProperty('--sidebar-icon-size', `${themeSettings.sidebarIconSize}px`);
    if (themeSettings.sidebarFontSize) root.style.setProperty('--sidebar-font-size', `${themeSettings.sidebarFontSize}px`);

    let styleElement = document.getElementById('dynamic-theme-styles');
    if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = 'dynamic-theme-styles';
        document.head.appendChild(styleElement);
    }
    
    const generateCssForMode = (mode: 'light' | 'dark', colors: any) => {
        if (!colors) return '';
        const selector = mode === 'light' ? ':root' : '.dark';
        const properties = Object.entries(colors)
            .map(([key, value]) => {
                const cssVarName = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
                return `${cssVarName}: ${value};`;
            })
            .join('\n');
        
        const otherVars = mode === 'light' ? `
            --secondary: 40 25% 90%; --secondary-foreground: 240 10% 3.9%;
            --muted: 40 25% 90%; --muted-foreground: 240 5% 45%;
            --destructive: 0 84.2% 60.2%; --destructive-foreground: 0 0% 98%;
            --border: 40 20% 85%; --input: 40 20% 85%;
            --ring: ${colors.primary || '147 82% 33%'};
            --sidebar-border: 40 20% 88%; --sidebar-accent: 40 25% 91%;
            --sidebar-accent-foreground: 240 10% 3.9%; --sidebar-ring: ${colors.primary || '147 82% 33%'};
        ` : `
            --secondary: 217 33% 17%; --secondary-foreground: 210 40% 98%;
            --muted: 217 33% 17%; --muted-foreground: 215 20% 65%;
            --destructive: 0 63% 31%; --destructive-foreground: 210 40% 98%;
            --border: 217 33% 17%; --input: 217 33% 17%;
            --ring: ${colors.primary || '147 70% 45%'};
            --sidebar-border: 217 33% 17%; --sidebar-accent: 217 33% 20%;
            --sidebar-accent-foreground: 210 40% 98%; --sidebar-ring: ${colors.primary || '147 70% 45%'};
        `;
        
        return `${selector} { ${properties} ${otherVars} }`;
    };

    const lightCss = generateCssForMode('light', themeSettings.light);
    const darkCss = generateCssForMode('dark', themeSettings.dark);

    styleElement.innerHTML = `${lightCss}\n${darkCss}`;
  };

  const loadAndApplySettings = useCallback(async () => {
    const savedSettings = localStorage.getItem("globalSettings");
    if (savedSettings) {
      applyStyles(JSON.parse(savedSettings));
      return;
    }

    if (db) {
      try {
        const settingsDocRef = doc(db, "settings", "global");
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          applyStyles(data);
          localStorage.setItem("globalSettings", JSON.stringify(data));
        }
      } catch (error) {
        console.error("Could not fetch theme settings from Firestore.", error);
      }
    }
  }, [db]);


  useEffect(() => {
    loadAndApplySettings();
    
    const handleSettingsUpdate = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail) {
            loadAndApplySettings();
        }
    };
    
    window.addEventListener('settings-updated', handleSettingsUpdate);

    return () => {
      window.removeEventListener('settings-updated', handleSettingsUpdate);
    }
  }, [loadAndApplySettings]);


  return null;
}

function AppWithProviders({ children }: { children: React.ReactNode }) {
    return (
      <FirebaseProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
            <DynamicStylesLoader />
            {children}
            <Toaster />
        </ThemeProvider>
      </FirebaseProvider>
    )
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Diet Clinik Portal</title>
        <meta name="description" content="Your vendor in achieving health goals." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=Roboto:wght@400;500;700&family=Lato:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AppWithProviders>
          {children}
        </AppWithProviders>
      </body>
    </html>
  );
}
