
"use client";

import React, { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Home, Settings, ShieldAlert, Users, CreditCard, Video, Calendar, Trophy, Lock } from 'lucide-react';
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
  SidebarContext,
} from '@/components/ui/sidebar';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirebase } from '@/components/firebase-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { NotificationsPopover } from '@/components/notifications-popover';
import { SheetClose } from '@/components/ui/sheet';
import { useSettings } from '@/hooks/use-settings';

const planTierWeights: { [key: string]: number } = {
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


function AccessDenied() {
    return (
        <div className="flex items-center justify-center h-screen bg-background">
            <Card className="w-full max-w-md mx-4">
                <CardHeader className="text-center">
                    <div className="mx-auto bg-destructive/10 p-3 rounded-full w-fit">
                        <ShieldAlert className="h-8 w-8 text-destructive" />
                    </div>
                    <CardTitle className="mt-4 text-2xl">Access Denied</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                    <p className="text-muted-foreground">
                        You do not have permission to view the corporate portal. Please contact your administrator.
                    </p>
                    <Button asChild className="mt-6">
                        <Link href="/corporate/login">Return to Login</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
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

function CorporateAuthWrapper({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [isCorporate, setIsCorporate] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { auth, db } = useFirebase();
  const { toast } = useToast();
  
    useEffect(() => {
        if (!auth || !db) return;
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
            router.push('/corporate/login');
            return;
        }
        
        const corporateDocRef = doc(db, 'corporates', user.uid);
        try {
            const corporateDocSnap = await getDoc(corporateDocRef);
            if (corporateDocSnap.exists()) {
                setIsCorporate(true);
                setUserId(user.uid);
            } else {
                setIsCorporate(false);
                await auth.signOut();
                router.push('/corporate/login');
                 toast({
                    variant: "destructive",
                    title: "Access Denied",
                    description: "You do not have permission to access the corporate portal.",
                });
            }
        } catch (error) {
            console.error("Error checking corporate status:", error);
            setIsCorporate(false);
        } finally {
            setLoading(false);
        }
        });

        return () => unsubscribe();
    }, [router, auth, db, toast]);

    const navLinks = [
        { href: "/corporate/dashboard", icon: Home, label: "Dashboard" },
        { href: "/corporate/customers", icon: Users, label: "Customers", activePaths: ["/corporate/customers/add", "/corporate/customers/view"] },
        { href: "/corporate/events", icon: Calendar, label: "Events", activePaths: ["/corporate/events/add", "/corporate/events/view", "/corporate/events/edit", "/corporate/events/scoreboard"] },
        { href: "/corporate/meetings", icon: Video, label: "My Meetings" },
        { href: "/corporate/profile", icon: Settings, label: "My Profile" },
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

    if(!isCorporate) {
        return <AccessDenied />;
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
                <ThemeToggle />
                {userId && <NotificationsPopover userId={userId} />}
                <UserNav userType="corporate" />
                </header>
                <main className="flex flex-1 flex-col gap-4 px-2 py-4 lg:gap-6 lg:px-6 lg:py-6">
                {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}

export default function CorporateLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/corporate/login' || pathname.startsWith('/corporate/meetings/join')) {
    return <>{children}</>;
  }

  return <CorporateAuthWrapper>{children}</CorporateAuthWrapper>;
}
