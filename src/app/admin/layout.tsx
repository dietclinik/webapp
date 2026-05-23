

"use client";

import React, { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { BookCopy, Home, IndianRupee, Settings, Users, ShoppingCart, Receipt, Bell, ShieldAlert, UserPlus, Dumbbell, Video, ArrowUpRight, Building2, Activity, MailQuestion, Megaphone, MessageSquare, Trophy, UserCircle, RotateCcw } from 'lucide-react';
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
    SidebarMenuSub,
    SidebarMenuSubItem,
    SidebarMenuSubButton,
    useSidebar,
    SidebarContext,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight } from 'lucide-react';
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
                        You do not have the necessary permissions to view this page. Please contact your administrator.
                    </p>
                    <Button asChild className="mt-6">
                        <Link href="/admin/login">Return to Login</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}

function NavLink({ link, pathname }: { link: { href: string; icon: React.ElementType; label: string; activePaths?: string[]; subItems?: { href: string; label: string; icon: React.ElementType }[] }, pathname: string }) {
    const sidebar = React.useContext(SidebarContext);
    if (!sidebar) {
        throw new Error("useSidebar must be used within a SidebarProvider.");
    }
    const { setOpenMobile, isMobile } = sidebar;
    const isActive = pathname === link.href || (link.activePaths && link.activePaths.some(path => pathname.startsWith(path)));

    const handleClick = () => {
        if (isMobile) {
            setOpenMobile(false);
        }
    };

    if (link.subItems) {
        return (
            <Collapsible asChild defaultOpen={isActive} className="group/collapsible">
                <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip={link.label} isActive={isActive}>
                            <link.icon />
                            <span>{link.label}</span>
                            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <SidebarMenuSub>
                            {link.subItems.map((subItem) => (
                                <SidebarMenuSubItem key={subItem.href}>
                                    <SidebarMenuSubButton asChild isActive={pathname === subItem.href}>
                                        <Link href={subItem.href} onClick={handleClick} className="w-full">
                                            <subItem.icon className="h-4 w-4" />
                                            <span>{subItem.label}</span>
                                        </Link>
                                    </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                            ))}
                        </SidebarMenuSub>
                    </CollapsibleContent>
                </SidebarMenuItem>
            </Collapsible>
        );
    }

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

function AdminAuthWrapper({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const { auth, db } = useFirebase();
    const { toast } = useToast();

    useEffect(() => {
        if (!auth || !db) return;
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push('/admin/login');
                return;
            }

            const adminDocRef = doc(db, 'admins', user.uid);
            try {
                const adminDocSnap = await getDoc(adminDocRef);
                if (adminDocSnap.exists()) {
                    setIsAdmin(true);
                } else {
                    setIsAdmin(false);
                    // This handles cases where a non-admin user (customer) tries to access /admin directly.
                    await auth.signOut();
                    router.push('/admin/login');
                    toast({
                        variant: "destructive",
                        title: "Access Denied",
                        description: "You do not have permission to access the admin portal.",
                    });
                }
            } catch (error) {
                console.error("Error checking admin status:", error);
                setIsAdmin(false);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [router, auth, db, toast]);

    const navLinks = [
        { href: "/admin", icon: Home, label: "Dashboard" },
        { href: "/admin/customers", icon: Users, label: "Customers", activePaths: ["/admin/customers/view", "/admin/customers/edit", "/admin/customers/add"] },
        { href: "/admin/renewal-clients", icon: RotateCcw, label: "Renewal Clients" },
        { href: "/admin/staff", icon: UserPlus, label: "Staff", activePaths: ["/admin/staff/add", "/admin/staff/edit", "/admin/staff/view"] },
        { href: "/admin/partners", icon: Dumbbell, label: "Partners", activePaths: ["/admin/partners/add", "/admin/partners/edit", "/admin/partners/view"] },
        { href: "/admin/corporates", icon: Building2, label: "Corporates", activePaths: ["/admin/corporates/add", "/admin/corporates/edit", "/admin/corporates/view", "/admin/events"] },
        { href: "/admin/FITTBOSS-challenge", icon: Trophy, label: "FITTBOSS Challenge", activePaths: ["/admin/FITTBOSS-challenge/add"] },
        { href: "/admin/subscriptions", icon: IndianRupee, label: "Subscriptions", activePaths: ["/admin/subscriptions/edit"] },
        { href: "/admin/diet-plans", icon: BookCopy, label: "Diet Plans", activePaths: ["/admin/diet-plans/builder"] },
        { href: "/admin/marketing", icon: Megaphone, label: "Marketing", activePaths: ["/admin/marketing/bulk-email", "/admin/marketing/bulk-whatsapp"] },
        { href: "/admin/meetings", icon: Video, label: "Meetings" },
        {
            href: "/admin/whatsapp",
            icon: MessageSquare,
            label: "WhatsApp",
            activePaths: ["/admin/whatsapp"],
            subItems: [
                { href: "/admin/whatsapp/settings", label: "Settings", icon: Settings },
                { href: "/admin/whatsapp/templates", label: "Templates", icon: BookCopy },
                { href: "/admin/whatsapp/inbox", label: "Inbox", icon: MailQuestion },
                { href: "/admin/whatsapp/logs", label: "Logs", icon: Activity },
                { href: "/admin/whatsapp/reports", label: "Reports", icon: ArrowUpRight },
                { href: "/admin/whatsapp/campaign", label: "Bulk Campaign", icon: Megaphone },
            ]
        },
        { href: "/admin/contact-submissions", icon: MailQuestion, label: "Contact Form" },
        { href: "/admin/revenue", icon: ArrowUpRight, label: "Revenue" },
        { href: "/admin/expenses", icon: Receipt, label: "Expenses" },
        { href: "/admin/settings", icon: Settings, label: "Settings" },
        { href: "/admin/profile", icon: UserCircle, label: "My Profile" },
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

    if (!isAdmin) {
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
                    <div className="w-full flex-1">
                        {/* Can add a search bar here if needed */}
                    </div>
                    <ThemeToggle />
                    <NotificationsPopover userId="admin" />
                    <UserNav userType="admin" />
                </header>
                <main className="flex flex-1 flex-col gap-4 px-2 py-4 lg:gap-6 lg:px-6 lg:py-6">
                    {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();

    if (pathname === '/admin/login' || pathname.startsWith('/staff') || pathname.startsWith('/partner') || pathname.startsWith('/partner-register') || pathname.startsWith('/corporate') || pathname.startsWith('/vendor') || pathname.startsWith('/corporate-register')) {
        return <>{children}</>;
    }

    return <AdminAuthWrapper>{children}</AdminAuthWrapper>;
}
