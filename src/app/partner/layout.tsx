
"use client";

import React, { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Home, Settings, ShieldAlert, Users, CreditCard, Video, IndianRupee, Bell, BookCopy, Trophy, Calculator, FileQuestion } from 'lucide-react';
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

    useEffect(() => {
        const checkAccess = async () => {
            if (settingsLoading || !auth.currentUser) return;
            
            const partnerDocRef = doc(db, "vendors", auth.currentUser.uid);
            const partnerSnap = await getDoc(partnerDocRef);
            
            if (!partnerSnap.exists()) {
                setHasAccess(false);
                return;
            }

            const partnerData = partnerSnap.data();
            const endDate = partnerData.subscriptionEndDate?.toDate();
            
            if (endDate && new Date() > endDate) {
                setSubscriptionExpired(true);
                if (pathname === '/partner/subscription' || pathname === '/partner/profile') {
                    setHasAccess(true);
                } else {
                    setHasAccess(false);
                }
                return;
            }
            
            setSubscriptionExpired(false);

            if (pathname === '/partner/subscription' || pathname === '/partner/profile' || pathname.startsWith('/partner/meetings')) {
                setHasAccess(true);
                return;
            }

            const partnerRules = settings?.pageAccess?.partnerRules;
            if (!partnerRules) {
                setHasAccess(true); // If no rules, allow access
                return;
            }

            const rule = partnerRules.find((r: any) => r.pagePath === pathname);
            if (!rule) {
                setHasAccess(true);
                return;
            }
            
            setAccessRule(rule);
            
            // FITTBOSS partners don't have a planId but should have access.
            if (partnerData.challenge === 'FITTBOSS') {
                setHasAccess(true);
                return;
            }

            if (!partnerData.planId) {
                // If there's no planId, check if the page is one of the common ones that might not require a plan.
                // This logic needs to be robust based on how page access is defined.
                // For now, if a rule exists and there's no plan, access is denied unless specified otherwise.
                setHasAccess(false); 
                return;
            }

            const planDocRef = doc(db, "subscriptionPlans", partnerData.planId);
            const planSnap = await getDoc(planDocRef);
            if (!planSnap.exists()) {
                setHasAccess(false);
                return;
            }
            const planData = planSnap.data();
            const userTier = planData?.tier || 'Basic';

            const userWeight = planTierWeights[userTier as keyof typeof planTierWeights] || 0;
            const requiredWeight = planTierWeights[rule.minTier as keyof typeof planTierWeights] || 0;
            
            setHasAccess(userWeight >= requiredWeight);
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
        return (
             <div className="flex items-center justify-center h-full">
                <Card className="w-full max-w-lg text-center">
                    <CardHeader>
                        <div className="mx-auto bg-destructive/10 p-4 rounded-full w-fit">
                            <ShieldAlert className="h-8 w-8 text-destructive" />
                        </div>
                        <CardTitle className="mt-4 text-2xl">{subscriptionExpired ? 'Subscription Expired' : 'Upgrade Required'}</CardTitle>
                        <CardDescription>
                            {subscriptionExpired ? 'Your partner subscription has ended. Please renew to continue.' : accessRule?.message || "This page is available on a higher-tier plan."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
                            <Link href="/partner/subscription">Renew or Upgrade Plan</Link>
                        </Button>
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
                        You do not have permission to view the partner portal. Please contact your administrator.
                    </p>
                    <Button asChild className="mt-6">
                        <Link href="/partner/login">Return to Login</Link>
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

function PartnerAuthWrapper({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [isPartner, setIsPartner] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { auth, db } = useFirebase();
  const { toast } = useToast();
  
    useEffect(() => {
        if (!auth || !db) return;
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
            router.push('/partner/login');
            return;
        }
        
        const vendorDocRef = doc(db, 'vendors', user.uid);
        try {
            const vendorDocSnap = await getDoc(vendorDocRef);
            if (vendorDocSnap.exists()) {
                setIsPartner(true);
                setUserId(user.uid);
            } else {
                setIsPartner(false);
                await auth.signOut();
                router.push('/partner/login');
                 toast({
                    variant: "destructive",
                    title: "Access Denied",
                    description: "You do not have permission to access the partner portal.",
                });
            }
        } catch (error) {
            console.error("Error checking partner status:", error);
            setIsPartner(false);
        } finally {
            setLoading(false);
        }
        });

        return () => unsubscribe();
    }, [router, auth, db, toast]);

    const navLinks = [
        { href: "/partner/dashboard", icon: Home, label: "Dashboard" },
        { href: "/partner/customers", icon: Users, label: "My Customers", activePaths: ["/partner/customers/add", "/partner/customers/edit", "/partner/customers/view"] },
        { href: "/partner/money-back-challenge", icon: Trophy, label: "Money Back Challenge", activePaths: ["/partner/money-back-challenge/view"] },
        { href: "/partner/diet-plans", icon: BookCopy, label: "Diet Plans", activePaths: ["/partner/diet-plans/builder"] },
        { href: "/partner/calculator", icon: Calculator, label: "Calculator" },
        { href: "/partner/enquiries", icon: FileQuestion, label: "Enquiries" },
        { href: "/partner/meetings", icon: Video, label: "My Meetings" },
        { href: "/partner/notifications", icon: Bell, label: "Notifications" },
        { href: "/partner/subscription", icon: CreditCard, label: "Subscription" },
        { href: "/partner/profile", icon: Settings, label: "My Profile" },
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

    if(!isPartner) {
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
                <UserNav userType="partner" />
                </header>
                <main className="relative flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
                    <PageAccessWrapper>
                      {children}
                    </PageAccessWrapper>
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}

export default function PartnerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/partner/login' || pathname.startsWith('/partner/meetings/join')) {
    return <>{children}</>;
  }

  return <PartnerAuthWrapper>{children}</PartnerAuthWrapper>;
}
