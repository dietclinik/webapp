

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFirebase } from "@/components/firebase-provider";
import { useToast } from "@/hooks/use-toast";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, Timestamp, collection, getDocs, query, where, updateDoc } from "firebase/firestore";
import { useEffect, useState, useCallback } from "react";
import { format, addMonths, addDays } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Loader2, Users, CheckCircle } from "lucide-react";
import RazorpayButton from "@/components/razorpay-button";
import { processPartner } from "@/ai/flows/send-partner-welcome-email-flow";
import Confetti from 'react-confetti';
import { useWindowSize } from '@/hooks/use-window-size';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";


type PartnerData = {
    id: string;
    name: string;
    email: string;
    mobile: string;
    planId: string;
    address: string;
    subscriptionEndDate?: Timestamp;
};

type PriceVariant = {
  durationLabel: string;
  price: number;
  durationMonths: number;
  durationDays: number;
};

type Plan = {
  id: string;
  name: string;
  price: number;
  features?: string[];
  durationMonths: number;
  durationDays: number;
  maxCustomers?: number;
  tag?: string;
  displayOrder?: number;
  planFor?: 'customer' | 'vendor' | 'vendor_customer';
  priceVariants?: PriceVariant[];
};

const paymentHistory: any[] = []; 

function UpgradeDialog({ currentPlan, partner, availablePlans, onSuccessfulUpgrade }: { currentPlan: Plan | null, partner: PartnerData, availablePlans: Plan[], onSuccessfulUpgrade: () => void }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDuration, setSelectedDuration] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const durationTabs = Array.from(new Set(availablePlans.flatMap(p => p.priceVariants?.map(v => v.durationLabel) || [])));
    
    useEffect(() => {
        if (isModalOpen && durationTabs.length > 0 && !selectedDuration) {
            setSelectedDuration(durationTabs[0]);
        }
    }, [isModalOpen, durationTabs, selectedDuration]);

    const handlePaymentResult = async (success: boolean, newPlan: Plan, variant: PriceVariant) => {
        if (!partner) return;

        if (!success) {
            toast({ 
                variant: "destructive",
                title: "Payment Failed", 
                description: "Your plan was not changed. Please try again or contact support." 
            });
            setIsSubmitting(false);
            return;
        }

        setIsSubmitting(true);
        
        try {
            await processPartner({
                paymentSuccess: true,
                vendorId: partner.id,
                vendorData: {
                    name: partner.name,
                    email: partner.email,
                    mobile: partner.mobile,
                    address: partner.address,
                    planId: newPlan.id,
                    durationMonths: variant.durationMonths,
                    durationDays: variant.durationDays,
                }
            });

            toast({ 
              title: "Upgrade Successful!", 
              description: "Your plan has been upgraded. Reloading your details." 
            });
            onSuccessfulUpgrade();
            setIsModalOpen(false);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: `An error occurred: ${error.message}` });
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDuration = (months?: number, days?: number) => {
        const parts = [];
        if (months && months > 0) parts.push(`${months} Month${months > 1 ? 's' : ''}`);
        if (days && days > 0) parts.push(`${days} Day${days > 1 ? 's' : ''}`);
        return parts.join(', ');
    };

    return (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
                <Button style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
                    {currentPlan ? 'Renew or Upgrade Plan' : 'Choose a Plan'}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Choose a New Plan</DialogTitle>
                    <DialogDescription>Select a plan to renew or upgrade to.</DialogDescription>
                </DialogHeader>
                {durationTabs.length > 1 && (
                    <div className="flex mx-auto justify-center mb-4">
                        <Tabs value={selectedDuration} onValueChange={setSelectedDuration}>
                            <TabsList>
                                {durationTabs.map(duration => (
                                    <TabsTrigger key={duration} value={duration} className="text-base">{duration}</TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4 max-h-[70vh] overflow-y-auto">
                    {availablePlans.map(plan => {
                        const variant = plan.priceVariants?.find(v => v.durationLabel === selectedDuration);
                        if (!variant && durationTabs.length > 0) return null;
                        
                        const displayVariant = variant || plan.priceVariants?.[0];
                        if (!displayVariant) return null;

                        return (
                            <Card key={`${plan.id}-${displayVariant.durationLabel}`} className="flex flex-col">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg leading-tight">{plan.name}</CardTitle>
                                </CardHeader>
                                <CardContent className="flex-1 flex flex-col">
                                    <p className="text-3xl font-bold my-4">₹{displayVariant.price}</p>
                                    <p className="text-xs text-muted-foreground">For {formatDuration(displayVariant.durationMonths, displayVariant.durationDays)}</p>
                                    <div className="flex items-center justify-start gap-2 text-sm text-muted-foreground mt-2">
                                        <Users className="h-4 w-4"/>
                                        <span>Up to {plan.maxCustomers} Customers</span>
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
                                {displayVariant.price > 0 ? (
                                        <RazorpayButton
                                            planName={`${plan.name} (${displayVariant.durationLabel})`}
                                            amount={displayVariant.price}
                                            customerName={partner?.name || 'New Partner'}
                                            customerEmail={partner?.email || 'new@partner.com'}
                                            customerPhone={partner?.mobile || ''}
                                            onPaymentSuccess={() => handlePaymentResult(true, plan, displayVariant)}
                                            onPaymentError={() => handlePaymentResult(false, plan, displayVariant)}
                                            disabled={isSubmitting || !partner}
                                            buttonText="Choose Plan"
                                            closeDialog={() => setIsModalOpen(false)}
                                        />
                                ) : (
                                        <Button
                                            className="w-full"
                                            onClick={() => handlePaymentResult(true, plan, displayVariant)}
                                            disabled={isSubmitting || !partner}
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Processing...
                                                </>
                                            ) : (
                                                "Choose Plan"
                                            )}
                                        </Button>
                                )}
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>
                 <DialogClose />
            </DialogContent>
        </Dialog>
    );
}

export default function SubscriptionPage() {
    const [partner, setPartner] = useState<PartnerData | null>(null);
    const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
    const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [showConfetti, setShowConfetti] = useState(false);
    const { auth, db } = useFirebase();
    const { toast } = useToast();
    const { width, height } = useWindowSize();
    
    const fetchPartnerAndPlanData = useCallback(async (user: any) => {
        if (!user) return;
        setLoading(true);
        try {
            const vendorDocRef = doc(db, "vendors", user.uid);
            const vendorSnap = await getDoc(vendorDocRef);

            let fetchedPartner: PartnerData | null = null;
            if (vendorSnap.exists()) {
                fetchedPartner = { id: vendorSnap.id, ...vendorSnap.data() } as PartnerData;
                setPartner(fetchedPartner);

                if (fetchedPartner.planId) {
                    const planDocRef = doc(db, "subscriptionPlans", fetchedPartner.planId);
                    const planSnap = await getDoc(planDocRef);
                    if (planSnap.exists()) {
                        setCurrentPlan({ id: planSnap.id, ...planSnap.data() } as Plan);
                    }
                }
            }
            
            const plansQuery = query(
                collection(db, "subscriptionPlans"),
                where("status", "==", "Active"),
                where("planFor", "==", "vendor")
            );

            const plansSnapshot = await getDocs(plansQuery);
            let allPlans = plansSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Plan));
            allPlans.sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99));
            setAvailablePlans(allPlans);

        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not fetch subscription details." });
        } finally {
            setLoading(false);
        }
    }, [db, toast]);

    useEffect(() => {
        if (!auth || !db) return;

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                fetchPartnerAndPlanData(user);
            } else {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [auth, db, fetchPartnerAndPlanData]);
    
    const handleSuccessfulUpgrade = () => {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 10000);
        if(auth.currentUser) {
            fetchPartnerAndPlanData(auth.currentUser);
        }
    }

  const formatDuration = (months?: number, days?: number) => {
    const parts = [];
    if (months && months > 0) parts.push(`${months} Month${months > 1 ? 's' : ''}`);
    if (days && days > 0) parts.push(`${days} Day${days > 1 ? 's' : ''}`);
    return parts.join(', ');
  };

  return (
    <div className="space-y-6">
      {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}
      <div>
        <h1 className="text-xl font-bold">My Subscription</h1>
        <p className="text-muted-foreground">Manage your partner plan and view payment history.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>Your current subscription details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-10 w-1/4 ml-auto" />
            </div>
          ) : currentPlan && partner ? (
            <>
              <div className="flex flex-col md:flex-row justify-between items-start p-4 border rounded-lg gap-4">
                <div className="space-y-2">
                  <p className="text-xl font-semibold">{currentPlan.name}</p>
                  <p className="text-muted-foreground">
                    {partner.subscriptionEndDate
                        ? `Expires on ${format(partner.subscriptionEndDate.toDate(), 'PPP')}`
                        : "No expiry date set."}
                  </p>
                </div>
                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8 text-left md:text-right">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        <div>
                            <p className="font-semibold">{currentPlan.maxCustomers ?? 'Unlimited'}</p>
                            <p className="text-xs text-muted-foreground">Max Customers</p>
                        </div>
                    </div>
                     <p className="text-2xl font-bold">₹{currentPlan.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                </div>
              </div>
              <div className="flex justify-end">
                  <UpgradeDialog currentPlan={currentPlan} partner={partner} availablePlans={availablePlans} onSuccessfulUpgrade={handleSuccessfulUpgrade} />
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-center p-4 border rounded-lg">
                <div>
                  <p className="text-xl font-semibold">No Active Plan</p>
                  <p className="text-muted-foreground">Please subscribe to a plan.</p>
                </div>
              </div>
              <div className="flex justify-end">
                {partner && <UpgradeDialog currentPlan={null} partner={partner} availablePlans={availablePlans} onSuccessfulUpgrade={handleSuccessfulUpgrade} />}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
