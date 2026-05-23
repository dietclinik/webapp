
"use client";

import React, { ReactNode, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, User, Calendar, LineChart, CreditCard, Menu, Lock, Utensils, BookHeart, Video, Weight, Home, ShieldAlert, MessageSquare, Activity, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserNav } from '@/components/user-nav';
import { Logo } from '@/components/logo';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  useSidebar,
  SidebarContext,
} from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirebase } from '@/components/firebase-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { NotificationsPopover } from '@/components/notifications-popover';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSettings } from '@/hooks/use-settings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Sheet, SheetClose } from '@/components/ui/sheet';

const planTierWeights = {
    'Basic': 1,
    'Premium': 2,
    'Pro': 3
};

function PageAccessWrapper({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const { auth, db } = useFirebase();
    const { settings, loading: settingsLoading } = useSettings();
    const [hasAccess, setHasAccess] = useState<boolean | null>(null);
    const [accessRule, setAccessRule] = useState<any | null>(null);
    const [subscriptionExpired, setSubscriptionExpired] = useState<boolean>(false);
    const [isPartnerCustomer, setIsPartnerCustomer] = useState<boolean>(false);

    useEffect(() => {
        const checkAccess = async () => {
            if (settingsLoading || !auth.currentUser) return;
            
            const customerDocRef = doc(db, "customers", auth.currentUser.uid);
            const customerSnap = await getDoc(customerDocRef);
            
            if (!customerSnap.exists()) {
                setHasAccess(false);
                return;
            }

            const customerData = customerSnap.data();
            const endDate = customerData.subscriptionEndDate?.toDate();
            
            if (customerData.vendorId) {
                setIsPartnerCustomer(true);
            }
            
            if (endDate && new Date() > endDate) {
                setSubscriptionExpired(true);
                // Allow access only to subscription and profile page if expired
                if (pathname === '/dashboard/subscription' || pathname === '/dashboard/profile') {
                    setHasAccess(true);
                } else {
                    setHasAccess(false);
                }
                return;
            }
            
            setSubscriptionExpired(false);

            if (pathname === '/dashboard/subscription' || pathname === '/dashboard/profile' || pathname.startsWith('/dashboard/meetings')) {
                setHasAccess(true);
                return;
            }

            const customerRules = settings?.pageAccess?.customerRules;
            if (!customerRules) {
                setHasAccess(true); // If no rules, allow access
                return;
            }

            const rule = customerRules.find((r: any) => r.pagePath === pathname);
            if (!rule) {
                setHasAccess(true);
                return;
            }
            
            setAccessRule(rule);

            const planDocRef = doc(db, "subscriptionPlans", customerData.planId);
            const planSnap = await getDoc(planDocRef);
            if (!planSnap.exists()) {
                setHasAccess(false);
                return;
            }
            const planData = planSnap.data();
            const userTier = planData?.tier || 'Basic';
            const userPlanType = planData?.planType || 'dietician';

            let tierAccess = true;
            let typeAccess = true;

            if (rule.allowedPlanType !== 'any' && userPlanType !== rule.allowedPlanType) {
                typeAccess = false;
            }

            const userWeight = planTierWeights[userTier as keyof typeof planTierWeights] || 0;
            const requiredWeight = planTierWeights[rule.minTier as keyof typeof planTierWeights] || 0;
            if (userWeight < requiredWeight) {
                tierAccess = false;
            }
            
            setHasAccess(tierAccess && typeAccess);
        };
        
        checkAccess();

    }, [pathname, settings, settingsLoading, auth.currentUser, db]);

    if (hasAccess === null || settingsLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Skeleton className="h-[200px] w-full max-w-lg" />
            </div>
        )
    }

    if (!hasAccess) {
        if (subscriptionExpired) {
             const message = isPartnerCustomer 
                ? "Your Subscription has ended, Kindly Contact your Gym/Fitness Center/Dietician to renew it" 
                : "Your subscription has Ended, Kindly renew it to continue accessing this page.";

            return (
                 <div className="flex items-center justify-center h-full">
                    <Card className="w-full max-w-lg text-center">
                        <CardHeader>
                            <div className="mx-auto bg-destructive/10 p-4 rounded-full w-fit">
                                <ShieldAlert className="h-8 w-8 text-destructive" />
                            </div>
                            <CardTitle className="mt-4 text-2xl">Subscription Expired</CardTitle>
                             <CardDescription>{message}</CardDescription>
                        </CardHeader>
                        {!isPartnerCustomer && (
                            <CardContent>
                                <Link href="/dashboard/subscription">
                                    <Button style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
                                        Renew Now
                                    </Button>
                                </Link>
                            </CardContent>
                        )}
                    </Card>
                </div>
            )
        }
        return (
            <div className="flex items-center justify-center h-full">
                <Card className="w-full max-w-lg text-center">
                    <CardHeader>
                        <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit">
                            <Lock className="h-8 w-8 text-primary" />
                        </div>
                        <CardTitle className="mt-4 text-2xl">Upgrade to Access This Feature</CardTitle>
                         <CardDescription>{accessRule?.message || "This page is available on a higher-tier plan."}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/dashboard/subscription">
                            <Button style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
                                View Plans & Upgrade
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return <>{children}</>;
}

function NavLink({ link, pathname }: { link: { href: string; icon: React.ElementType; label: string; activePaths?: string[] }, pathname: string }) {
    const sidebar = React.useContext(SidebarContext);
    if (!sidebar) {
      throw new Error("useSidebar must be used within a SidebarProvider.");
    }
    const { setOpenMobile, isMobile } = sidebar;
    const isActive = pathname === link.href || (link.activePaths && link.activePaths.some(path => pathname.startsWith(path)));
    
    const handleClick = () => {
        if(isMobile) {
            setOpenMobile(false);
        }
    };
    
    const linkContent = (
        <SidebarMenuItem>
            <Link href={link.href} onClick={handleClick} className="w-full">
                <SidebarMenuButton tooltip={link.label} isActive={isActive}>
                    <link.icon />
                    <span>{link.label}</span>
                </SidebarMenuButton>
            </Link>
        </SidebarMenuItem>
    );

    if (isMobile) {
        return <SheetClose asChild>{linkContent}</SheetClose>;
    }

    return linkContent;
}

function BottomNavLink({ link, pathname }: { link: { href: string; icon: React.ElementType; label: string; }, pathname: string }) {
    const isActive = pathname === link.href;
    return (
        <Link href={link.href} className={cn("flex flex-col items-center gap-1 p-2 rounded-md", isActive ? "text-white font-semibold" : "text-accent-foreground/80")}>
            <link.icon className="h-6 w-6" />
            <span className="text-xs">{link.label}</span>
        </Link>
    )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const { auth, db } = useFirebase();

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/login');
      } else {
        setUser(currentUser);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router, auth, db]);

  const navLinks = [
    { href: "/dashboard/overview", icon: Home, label: "Dashboard" },
    { href: "/dashboard/daily-tracker", icon: CalendarDays, label: "Daily Tracker", activePaths: ["/dashboard/daily-tracker/"] },
    { href: "/dashboard/self-diet-plan", icon: BookHeart, label: "Self Diet Plan", activePaths: ["/dashboard/self-diet-plan/builder"] },
    { href: "/dashboard/dietician-diet-plan", icon: Utensils, label: "Dietician Plan" },
    { href: "/dashboard/progress", icon: LineChart, label: "Monthly Progress" },
    { href: "/dashboard/daily-weight-tracking", icon: Weight, label: "Weight Tracking" },
    { href: "/dashboard/activity-tracker", icon: Activity, label: "Activity Tracker" },
    { href: "/dashboard/meetings", icon: Video, label: "My Meetings" },
    { href: "/dashboard/profile", icon: User, label: "My Profile" },
    { href: "/dashboard/subscription", icon: CreditCard, label: "Subscription" },
    { href: "/dashboard/support", icon: MessageSquare, label: "Help & Support", activePaths: ["/dashboard/support/"] },
  ];

  const bottomNavLinks = [
    { href: "/dashboard/overview", icon: Home, label: "Dashboard" },
    { href: "/dashboard/daily-tracker", icon: CalendarDays, label: "Tracker" },
    { href: "/dashboard/self-diet-plan", icon: BookHeart, label: "Self-Diet" },
    { href: "/dashboard/dietician-diet-plan", icon: Utensils, label: "Diet Plan" },
  ];

  if (loading) {
    return (
        <div className="flex items-center justify-center h-screen">
            <div className="flex flex-col items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                </div>
            </div>
        </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <Sidebar side="left" collapsible="icon">
        <SidebarHeader>
          <Logo />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navLinks.map((link) => (
              <NavLink key={link.href} link={link} pathname={pathname} />
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
          <SidebarTrigger className="md:hidden" />
          <div className="w-full flex-1" />
          {user && <NotificationsPopover userId={user.uid} />}
          <ThemeToggle />
          <UserNav userType="customer" />
        </header>
        <main className="flex flex-1 flex-col gap-4 px-2 py-4 lg:gap-6 lg:px-6 lg:py-6 pb-20 md:pb-6">
          <PageAccessWrapper>{children}</PageAccessWrapper>
        </main>
        <footer className="hidden md:flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
            <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} Diet Clinik. All rights reserved.</p>
            <nav className="sm:ml-auto flex gap-4 sm:gap-6">
            <p className="text-xs text-muted-foreground">App Developed By <a href="https://voryntotechnologies.com" target="_blank" rel="noopener noreferrer" className="text-primary no-underline">Vorynto Pvt. Ltd.</a></p>
            </nav>
        </footer>
      </SidebarInset>
       <div className="md:hidden fixed bottom-0 left-0 right-0 bg-accent border-t shadow-lg z-50">
          <div className="flex justify-around items-center h-16">
              {bottomNavLinks.map(link => (
                  <BottomNavLink key={link.href} link={link} pathname={pathname} />
              ))}
          </div>
       </div>
    </SidebarProvider>
  );
}
