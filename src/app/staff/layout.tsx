
"use client";

import React, { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Home, Users, Settings, ShieldAlert, BookCopy, Video } from 'lucide-react';
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
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirebase } from '@/components/firebase-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { NotificationsPopover } from '@/components/notifications-popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { SheetClose } from '@/components/ui/sheet';


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
                        You do not have permission to view the staff portal. Please contact your administrator.
                    </p>
                    <Button asChild className="mt-6">
                        <Link href="/staff">Return to Login</Link>
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

function StaffAuthWrapper({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [isStaff, setIsStaff] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { auth, db } = useFirebase();
  const { toast } = useToast();
  
    useEffect(() => {
        if (!auth || !db) return;
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
            router.push('/staff');
            return;
        }
        
        const staffDocRef = doc(db, 'staff', user.uid);
        try {
            const staffDocSnap = await getDoc(staffDocRef);
            if (staffDocSnap.exists()) {
                setIsStaff(true);
                setUserId(user.uid);
            } else {
                setIsStaff(false);
                await auth.signOut();
                router.push('/staff');
                 toast({
                    variant: "destructive",
                    title: "Access Denied",
                    description: "You do not have permission to access the staff portal.",
                });
            }
        } catch (error) {
            console.error("Error checking staff status:", error);
            setIsStaff(false);
        } finally {
            setLoading(false);
        }
        });

        return () => unsubscribe();
    }, [router, auth, db, toast]);

    const navLinks = [
        { href: "/staff/dashboard", icon: Home, label: "Dashboard" },
        { href: "/staff/my-customers", icon: Users, label: "My Customers", activePaths: ["/staff/my-customers/view"] },
        { href: "/staff/diet-plans", icon: BookCopy, label: "Diet Plans", activePaths: ["/staff/diet-plans/builder"] },
        { href: "/staff/meetings", icon: Video, label: "My Meetings" },
        { href: "/staff/profile", icon: Settings, label: "My Profile" },
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

    if(!isStaff) {
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
                <UserNav userType="staff" />
                </header>
                <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:px-6 lg:py-6">
                {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}


export default function StaffLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/staff' || pathname.startsWith('/staff/meetings/join')) {
    return <>{children}</>;
  }

  return <StaffAuthWrapper>{children}</StaffAuthWrapper>;
}
