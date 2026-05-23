

"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/header";
import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useFirebase } from "@/components/firebase-provider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings } from "@/hooks/use-settings";
import { Users, CheckCircle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type PriceVariant = {
  durationLabel: string;
  price: number;
  durationMonths: number;
  durationDays: number;
};

type Plan = {
  id: string;
  name: string;
  description: string;
  status: 'Active' | 'Archived';
  showOnFrontend?: boolean;
  tag?: string;
  displayOrder?: number;
  planFor?: 'customer' | 'vendor' | 'vendor_customer';
  maxCustomers?: number;
  features?: string[];
  priceVariants?: PriceVariant[];
};

const policyLinks = [
    { href: "/terms-and-conditions", label: "Terms & Conditions" },
    { href: "/privacy-policy", label: "Privacy Policy" },
    { href: "/pricing-policy", label: "Pricing Policy" },
    { href: "/cancellation-refund-policy", label: "Cancellation & Refund Policy" },
    { href: "/shipping-policy", label: "Shipping Policy" },
    { href: "/contact", label: "Contact Us" },
];

export default function PartnerPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [selectedDuration, setSelectedDuration] = useState<string>('');
  const { db } = useFirebase();
  const { settings, loading: settingsLoading } = useSettings();

  const durationTabs = Array.from(new Set(plans.flatMap(p => p.priceVariants?.map(v => v.durationLabel) || [])));

  useEffect(() => {
    if (!db) return;

    const fetchPlans = async () => {
        setLoadingPlans(true);
        try {
            const plansCollectionRef = collection(db, "subscriptionPlans");
            const q = query(plansCollectionRef, where("status", "==", "Active"), where("showOnFrontend", "==", true), where("planFor", "==", "vendor"));
            const data = await getDocs(q);
            const activePlans = data.docs.map(doc => ({ ...doc.data(), id: doc.id } as Plan));
            
            activePlans.sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99));

            setPlans(activePlans);
            const allDurations = Array.from(new Set(activePlans.flatMap(p => p.priceVariants?.map(v => v.durationLabel) || [])));
            if (allDurations.length > 0) {
                setSelectedDuration(allDurations[0]);
            }
        } catch (error) {
            console.error("Error fetching partner subscription plans:", error);
        } finally {
            setLoadingPlans(false);
        }
    };

    fetchPlans();
  }, [db]);
  
  const loading = settingsLoading || loadingPlans;

  const formatDuration = (months?: number, days?: number) => {
    const parts = [];
    if (months && months > 0) parts.push(`${months} Month${months > 1 ? 's' : ''}`);
    if (days && days > 0) parts.push(`${days} Day${days > 1 ? 's' : ''}`);
    return parts.join(', ');
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header variant="dark" showNavLinks={false} loginUrl="/partner/login" />
      <main className="flex-1">
        <section className="mx-auto py-12 md:py-24 lg:py-32 bg-muted/50">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">Partner Subscription Plans</h1>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                    Choose a plan to partner with us and get listed on our platform.
                </p>
            </div>
            {durationTabs.length > 1 && (
                <div className="flex mx-auto justify-center mb-8">
                    <Tabs value={selectedDuration} onValueChange={setSelectedDuration}>
                        <TabsList>
                            {durationTabs.map(duration => (
                                <TabsTrigger key={duration} value={duration} className="text-base">{duration}</TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                </div>
            )}
            {loading ? (
                 <div className="mx-auto grid max-w-5xl items-start gap-8 sm:grid-cols-2 md:gap-12 lg:grid-cols-3">
                    {[...Array(3)].map((_, index) => (
                        <Card key={index} className="flex flex-col">
                            <CardHeader className="items-center text-center pb-4">
                               <Skeleton className="h-6 w-3/4" />
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col items-center">
                                <Skeleton className="h-10 w-1/2 mb-4" />
                                <Skeleton className="h-6 w-1/4 mb-4" />
                                <Skeleton className="h-16 w-full" />
                            </CardContent>
                            <CardFooter>
                                <Skeleton className="h-10 w-full" />
                            </CardFooter>
                        </Card>
                    ))}
                 </div>
            ) : plans.length > 0 ? (
                <div className="mx-auto grid max-w-5xl items-stretch gap-8 sm:grid-cols-2 md:gap-12 lg:grid-cols-3">
                {plans.map((plan) => {
                    const variant = plan.priceVariants?.find(v => v.durationLabel === selectedDuration);
                    if (!variant && durationTabs.length > 0) return null; // Don't render if a duration is selected but this plan doesn't have it
                    
                    const displayVariant = variant || plan.priceVariants?.[0];
                    if (!displayVariant) return null; // Don't render if there are no price variants

                    return (
                        <Card key={plan.id} className={`flex flex-col ${plan.tag ? 'border-primary shadow-lg' : ''}`}>
                        {plan.tag && (
                            <div className="bg-primary text-primary-foreground text-sm font-semibold text-center py-1 rounded-t-lg">{plan.tag}</div>
                        )}
                        <CardHeader className="items-center text-center pb-2">
                            <CardTitle className="text-xl font-bold font-headline leading-snug">{plan.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col">
                            <div className="flex justify-center items-baseline my-4">
                            <span className="text-4xl font-bold">₹{displayVariant.price}</span>
                            </div>
                            <div className="text-center mb-4 space-y-2">
                                <Badge variant="secondary">
                                    For {formatDuration(displayVariant.durationMonths, displayVariant.durationDays)}
                                </Badge>
                                 {plan.maxCustomers !== undefined && (
                                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                        <Users className="h-4 w-4"/>
                                        <span>Add Up to {plan.maxCustomers} Customers</span>
                                    </div>
                                )}
                            </div>
                             <ul className="text-muted-foreground text-sm space-y-2 flex-1 mt-4">
                              {plan.features?.map((feature, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                                  <span>{feature}</span>
                                </li>
                              ))}
                            </ul>
                        </CardContent>
                        <CardFooter>
                          <Link href={`/partner-register/${plan.id}?duration=${encodeURIComponent(displayVariant.durationLabel)}`} className="w-full">
                            <Button className="w-full" variant={plan.tag ? 'default' : 'outline'} style={{ backgroundColor: plan.tag ? 'hsl(var(--accent))' : undefined, color: plan.tag ? 'hsl(var(--accent-foreground))' : undefined }}>
                              Choose Plan
                            </Button>
                          </Link>
                        </CardFooter>
                        </Card>
                    );
                })}
                </div>
            ) : (
                <div className="text-center text-muted-foreground">
                    <p>Partner pricing plans are not available at the moment. Please check back later.</p>
                </div>
            )}
          </div>
        </section>
      </main>
      <div className="border-t">
          <div className="container mx-auto py-4 px-4 md:px-6">
              <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
                  {policyLinks.map(link => (
                    <Link key={link.href} href={link.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                        {link.label}
                    </Link>
                  ))}
              </nav>
          </div>
      </div>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} Diet Clinik. All rights reserved.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <p className="text-sm text-muted-foreground">App Developed By <a href="https://voryntotechnologies.com" target="_blank" rel="noopener noreferrer" className="text-primary no-underline">Vorynto Pvt. Ltd.</a></p>
        </nav>
      </footer>
    </div>
  );
}
