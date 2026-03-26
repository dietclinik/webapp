
"use client"

import { HeartPulse } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { SidebarContext } from '@/components/ui/sidebar';
import { useSettings } from '@/hooks/use-settings';
import { useContext } from 'react';


export function Logo({ className }: { className?: string }) {
  const { settings, loading } = useSettings();
  const sidebarContext = useContext(SidebarContext);

  const isMobile = sidebarContext?.isMobile;
  const state = sidebarContext?.state;

  const appName = settings?.themeSettings?.appName || "Diet Clinik";
  const logoImage = settings?.themeSettings?.logoImage || "";
  const logoColor = `hsl(${settings?.themeSettings?.logoColor || 'var(--primary)'})`;
  const logoIconSize = settings?.themeSettings?.logoIconSize || 40;

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div style={{ width: `${logoIconSize}px`, height: `${logoIconSize}px` }} className="shrink-0 rounded-full bg-muted animate-pulse" />
        <div className={'h-6 w-24 rounded-md bg-muted animate-pulse'} />
      </div>
    );
  }

  return (
    <Link href="/" className={cn(
      "flex items-center gap-2 text-lg font-bold font-headline",
      className
    )}>
      {logoImage ? (
        <Image
          src={logoImage}
          alt={`${appName} Logo`}
          width={logoIconSize}
          height={logoIconSize}
          className="shrink-0"
          style={{
            width: `${logoIconSize}px`,
            height: `${logoIconSize}px`,
            filter: className?.includes('text-white') ? 'brightness(0) invert(1)' : 'none',
          }}
        />
      ) : (
        <HeartPulse
          className="shrink-0"
          style={{
            height: `${logoIconSize}px`,
            width: `${logoIconSize}px`,
          } as React.CSSProperties}
        />
      )}
      <span className={cn('transition-opacity duration-200 text-3xl', sidebarContext && state === 'collapsed' ? 'hidden' : 'block')}>
        {appName}
      </span>
    </Link>
  );
}
