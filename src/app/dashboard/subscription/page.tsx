

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useFirebase } from "@/components/firebase-provider";
import { useToast } from "@/hooks/use-toast";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, Timestamp, collection, getDocs, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { format, addMonths, addDays } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import RazorpayButton from "@/components/razorpay-button";
import { processNewCustomer } from "@/app/actions";
import Confetti from 'react-confetti';
import { useWindowSize } from '@/hooks/use-window-size';


type CustomerData = {
    id: string;
    name: string;
    email: string;
    mobile: string;
    planId: string;
    subscriptionStartDate?: Timestamp;
    subscriptionEndDate?: Timestamp;
    vendorId?: string;
    vendorName?: string;
    address: string;
    bloodGroup: string;
    status: string;
    since: string;
    isNew: boolean;
    paymentStatus: string;
    customFields: Record<string, any>;
    dietPlanId: string | null;
};

type ProfileData = {
    age: string;
    gender: string;
    height: string;
    weight: string;
    healthProblems: string;
    allergies: string;
};

type Plan = {
  id: string;
  name: string;
  price: number;
  features?: string[];
  durationMonths: number;
  durationDays: number;
  tag?: string;
  displayOrder?: number;
  planFor?: 'customer' | 'vendor' | 'vendor_customer';
};

const paymentHistory: any[] = []; 

export default function SubscriptionPage() {
    const [customer, setCustomer] = useState<CustomerData | null>(null);
    const [profile, setProfile] = useState<ProfileData | null>(null);
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
                    const customerDocRef = doc(db, "customers", user.uid);
                    const profileDocRef = doc(db, "userProfiles", user.uid);

                    const [customerSnap, profileSnap] = await Promise.all([
                        getDoc(customerDocRef),
                        getDoc(profileDocRef)
                    ]);

                    let fetchedCustomer: CustomerData | null = null;
                    if (customerSnap.exists()) {
                        fetchedCustomer = { id: customerSnap.id, ...customerSnap.data() } as CustomerData;
                        setCustomer(fetchedCustomer);

                        if(profileSnap.exists()) {
                            setProfile(profileSnap.data() as ProfileData);
                        }

                        if (fetchedCustomer.planId) {
                            const planDocRef = doc(db, "subscriptionPlans", fetchedCustomer.planId);
                            const planSnap = await getDoc(planDocRef);
                            if (planSnap.exists()) {
                                setCurrentPlan({ id: planSnap.id, ...planSnap.data() } as Plan);
                            }
                        }
                    }
                    
                    const plansQuery = query(
                        collection(db, "subscriptionPlans"),
                        where("showOnFrontend", "==", true),
                        where("status", "==", "Active")
                    );

                    const plansSnapshot = await getDocs(plansQuery);
                    let allPlans = plansSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Plan));
                    
                    if (fetchedCustomer?.vendorId) {
                        // If customer is from a vendor, only show vendor_customer plans
                        allPlans = allPlans.filter(p => p.planFor === 'vendor_customer');
                    } else {
                         // Otherwise, only show general customer plans
                         allPlans = allPlans.filter(p => p.planFor === 'customer' || !p.planFor);
                    }

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
        if (!customer || !profile) return;

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

        const startDate = new Date();
        let endDate = addMonths(startDate, newPlan.durationMonths || 0);
        endDate = addDays(endDate, newPlan.durationDays || 0);
        
        const customerDataForFlow = {
            name: customer.name,
            email: customer.email,
            mobile: customer.mobile,
            address: customer.address || '',
            bloodGroup: customer.bloodGroup || '',
            planId: newPlan.id,
            dietPlanId: customer.dietPlanId || null,
            status: 'Active',
            since: customer.since,
            isNew: false,
            paymentStatus: 'Paid',
            subscriptionStartDate: startDate.toISOString(),
            subscriptionEndDate: endDate.toISOString(),
            customFields: customer.customFields || {},
        };

        try {
            await processNewCustomer({
                paymentSuccess: true,
                isRenewal: true,
                userId: customer.id,
                vendorId: customer.vendorId,
                vendorName: customer.vendorName,
                customerData: customerDataForFlow,
                profileData: profile,
            });

            toast({ 
              title: "Upgrade Successful!", 
              description: "Your plan has been upgraded. Reloading your details." 
            });
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 10000);

            setIsModalOpen(false);
             const customerDocRef = doc(db, "customers", customer.id);
             const customerSnap = await getDoc(customerDocRef);
             if(customerSnap.exists()){
                 setCustomer({id: customerSnap.id, ...customerSnap.data()} as CustomerData);
                 const planDocRef = doc(db, "subscriptionPlans", customerSnap.data().planId);
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

  const formatDuration = (months?: number, days?: number) => {
    const parts = [];
    if (months && months > 0) parts.push(`${months} Month${months > 1 ? 's' : ''}`);
    if (days && days > 0) parts.push(`${days} Day${days > 1 ? 's' : ''}`);
    return parts.join(', ');
  };

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
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg leading-tight">{plan.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col">
                            <p className="text-3xl font-bold my-4">₹{plan.price}</p>
                            <p className="text-xs text-muted-foreground">For {formatDuration(plan.durationMonths, plan.durationDays)}</p>
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
                           {plan.price > 0 ? (
                                <RazorpayButton
                                    planName={plan.name}
                                    amount={plan.price}
                                    customerName={customer?.name || 'New Customer'}
                                    customerEmail={customer?.email || 'new@customer.com'}
                                    customerPhone={customer?.mobile || ''}
                                    onPaymentSuccess={() => handlePaymentResult(true, plan)}
                                    onPaymentError={() => handlePaymentResult(false, plan)}
                                    disabled={isSubmitting || !customer}
                                    buttonText="Choose Plan"
                                    closeDialog={() => setIsModalOpen(false)}
                                />
                           ) : (
                                <Button
                                    className="w-full"
                                    onClick={() => handlePaymentResult(true, plan)}
                                    disabled={isSubmitting || !customer}
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
        <p className="text-muted-foreground">Manage your plan and view payment history.</p>
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
          ) : currentPlan && customer ? (
            <>
              <div className="flex justify-between items-center p-4 border rounded-lg">
                <div>
                  <p className="text-xl font-semibold">{currentPlan.name}</p>
                  <p className="text-muted-foreground">
                    {customer.subscriptionEndDate
                        ? `Expires on ${format(customer.subscriptionEndDate.toDate(), 'PPP')}`
                        : "No expiry date."}
                  </p>
                </div>
                <p className="text-2xl font-bold">₹{currentPlan.price} <span className="text-sm font-normal text-muted-foreground">({formatDuration(currentPlan.durationMonths, currentPlan.durationDays)})</span></p>
              </div>
               { !customer.vendorId && (
                    <div className="flex justify-end">
                        {renderUpgradeDialog()}
                    </div>
                )}
            </>
          ) : (
            <>
              <div className="flex justify-between items-center p-4 border rounded-lg">
                <div>
                  <p className="text-xl font-semibold">No Active Plan</p>
                  <p className="text-muted-foreground">Please subscribe to a plan.</p>
                </div>
              </div>
               { !customer?.vendorId && (
                  <div className="flex justify-end">
                      {renderUpgradeDialog()}
                  </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>Your past transactions.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentHistory.length > 0 ? paymentHistory.map((payment) => (
                <TableRow key={payment.date}>
                  <TableCell>{payment.date}</TableCell>
                  <TableCell>{payment.amount}</TableCell>
                  <TableCell>{payment.plan}</TableCell>
                  <TableCell>
                    <Badge variant="default">{payment.status}</Badge>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                    <TableCell colSpan={4} className="text-center">No payment history.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
