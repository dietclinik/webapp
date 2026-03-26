

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFirebase } from "@/components/firebase-provider";
import { useToast } from "@/hooks/use-toast";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, Timestamp, collection, getDocs, query, where, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { format, addMonths, addDays } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import RazorpayButton from "@/components/razorpay-button";
import { processVendor } from "@/ai/flows/send-vendor-welcome-email-flow";
import Confetti from 'react-confetti';
import { useWindowSize } from '@/hooks/use-window-size';


type VendorData = {
    id: string;
    name: string;
    email: string;
    mobile: string;
    planId: string;
    address: string;
};

type Plan = {
  id: string;
  name: string;
  price: number;
  description: string;
  durationMonths: number;
  durationDays: number;
  tag?: string;
  displayOrder?: number;
  planFor?: 'customer' | 'vendor' | 'vendor_customer';
};

export default function SubscriptionPage() {
    const [vendor, setVendor] = useState<VendorData | null>(null);
    const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
    const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const { auth, db } = useFirebase();
    const { toast } = useToast();
    const { width, height } = useWindowSize();

    useEffect(() => {
        if (!auth || !db) return;

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setLoading(true);
                try {
                    const vendorDocRef = doc(db, "vendors", user.uid);
                    const vendorSnap = await getDoc(vendorDocRef);

                    let fetchedVendor: VendorData | null = null;
                    if (vendorSnap.exists()) {
                        fetchedVendor = { id: vendorSnap.id, ...vendorSnap.data() } as VendorData;
                        setVendor(fetchedVendor);

                        if (fetchedVendor.planId) {
                            const planDocRef = doc(db, "subscriptionPlans", fetchedVendor.planId);
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
            } else {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [auth, db, toast]);
    
      const handlePaymentResult = async (success: boolean, newPlan: Plan) => {
        if (!vendor) return;

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
            await processVendor({
                paymentSuccess: true,
                vendorId: vendor.id,
                vendorData: {
                    name: vendor.name,
                    email: vendor.email,
                    mobile: vendor.mobile,
                    address: vendor.address,
                }
            });

            // Update planId on the vendor record
            const vendorDocRef = doc(db, 'vendors', vendor.id);
            await updateDoc(vendorDocRef, {
                planId: newPlan.id
            });

            toast({ 
              title: "Upgrade Successful!", 
              description: "Your plan has been upgraded." 
            });
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 10000);

            setIsModalOpen(false);
             const updatedVendorDoc = await getDoc(vendorDocRef);
             if(updatedVendorDoc.exists()){
                 setVendor({id: updatedVendorDoc.id, ...updatedVendorDoc.data()} as VendorData);
                 const planDocRef = doc(db, "subscriptionPlans", updatedVendorDoc.data().planId);
                 const planSnap = await getDoc(planDocRef);
                 if(planSnap.exists()){
                     setCurrentPlan({ id: planSnap.id, ...planSnap.data() } as Plan);
                 }
             }

        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: `An error occurred: ${error.message}` });
        } finally {
            setIsSubmitting(false);
        }
  }

  const renderUpgradeDialog = () => (
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4 max-h-[70vh] overflow-y-auto">
                {availablePlans.map(plan => (
                    <Card key={plan.id} className="flex flex-col">
                        <CardHeader>
                            <CardTitle>{plan.name}</CardTitle>
                            <CardDescription>{plan.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <p className="text-3xl font-bold">₹{plan.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                            <p className="text-xs text-muted-foreground">For {plan.durationMonths} months, {plan.durationDays} days</p>
                        </CardContent>
                        <CardFooter>
                           {plan.price > 0 ? (
                                <RazorpayButton
                                    planName={plan.name}
                                    amount={plan.price}
                                    customerName={vendor?.name || 'New Vendor'}
                                    customerEmail={vendor?.email || 'new@vendor.com'}
                                    customerPhone={vendor?.mobile || ''}
                                    onPaymentSuccess={() => handlePaymentResult(true, plan)}
                                    onPaymentError={() => handlePaymentResult(false, plan)}
                                    disabled={isSubmitting || !vendor}
                                    buttonText="Choose Plan"
                                    closeDialog={() => setIsModalOpen(false)}
                                />
                           ) : (
                                <Button
                                    className="w-full"
                                    onClick={() => handlePaymentResult(true, plan)}
                                    disabled={isSubmitting || !vendor}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        "Upgrade for Free"
                                    )}
                                </Button>
                           )}
                        </CardFooter>
                    </Card>
                ))}
            </div>
             <DialogClose />
        </DialogContent>
    </Dialog>
  );


  return (
    <div className="space-y-6">
      {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}
      <div>
        <h1 className="text-xl font-bold">My Subscription</h1>
        <p className="text-muted-foreground">Manage your vendor plan and view payment history.</p>
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
          ) : currentPlan && vendor ? (
            <>
              <div className="flex justify-between items-center p-4 border rounded-lg">
                <div>
                  <p className="text-xl font-semibold">{currentPlan.name}</p>
                  <p className="text-muted-foreground">
                    Your vendor plan details.
                  </p>
                </div>
                <p className="text-2xl font-bold">₹{currentPlan.price}/month</p>
              </div>
              <div className="flex justify-end">
                {renderUpgradeDialog()}
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
                {renderUpgradeDialog()}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    
