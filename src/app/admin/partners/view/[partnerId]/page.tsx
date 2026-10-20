

"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, User, Phone, Mail, MapPin, Users, IndianRupee, CalendarDays, BadgeCheck, Receipt } from "lucide-react";
import { doc, getDoc, collection, query, where, getDocs, Timestamp, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { togglePartnerStatus } from "@/ai/flows/toggle-partner-status-flow";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resendWelcomeEmail } from "@/ai/flows/resend-welcome-email-flow";

type PartnerData = {
    name: string;
    email: string;
    mobile?: string;
    address?: string;
    status: 'Active' | 'Inactive';
    createdAt?: Timestamp;
    planName?: string;
    planVariantLabel?: string;
    planPrice?: number;
    tier?: string;
    paymentStatus?: string;
    subscriptionStartDate?: Timestamp;
    subscriptionEndDate?: Timestamp;
};

type PaymentTransaction = {
    id: string;
    planName: string;
    amount: number;
    purchaseDate: Timestamp;
    status?: string;
};

type CustomerData = {
  id: string;
  name: string;
  email: string;
  status: 'Active' | 'Inactive';
  subscriptionEndDate?: Timestamp;
};

type EarningHistoryItem = {
    id: string;
    customerName: string;
    planName: string;
    purchaseDate: Timestamp;
    vendorEarning: number;
}

const DetailItem = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value?: React.ReactNode }) => (
    <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 text-muted-foreground mt-1" />
        <div className="flex flex-col">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-base">{value || 'N/A'}</p>
        </div>
    </div>
);

export default function ViewPartnerPage() {
  const [loading, setLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [partner, setPartner] = useState<PartnerData | null>(null);
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [earnings, setEarnings] = useState<EarningHistoryItem[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const { toast } = useToast();
  const { db } = useFirebase();
  const router = useRouter();
  const params = useParams();
  const vendorId = params.partnerId as string;

  useEffect(() => {
    if (!db || !vendorId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const vendorDocRef = doc(db, "vendors", vendorId);
        const vendorSnap = await getDoc(vendorDocRef);

        if (vendorSnap.exists()) {
          const partnerData = vendorSnap.data() as PartnerData;
          setPartner(partnerData);

          // Partner's own subscription payments (not to be confused with earnings from
          // referred customers, which are keyed by `vendorId` below).
          const paymentsQuery = query(collection(db, "subscriptionHistory"), where("userId", "==", vendorId), orderBy("purchaseDate", "desc"));
          const paymentsSnap = await getDocs(paymentsQuery);
          if (!paymentsSnap.empty) {
            setTransactions(paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentTransaction)));
          } else if (partnerData.planName && partnerData.subscriptionStartDate) {
            // Partners registered before payment history was tracked have no subscriptionHistory
            // entries yet — fall back to a single row derived from their current plan snapshot.
            setTransactions([{
                id: 'current-plan',
                planName: partnerData.planVariantLabel ? `${partnerData.planName} (${partnerData.planVariantLabel})` : partnerData.planName,
                amount: partnerData.planPrice || 0,
                purchaseDate: partnerData.subscriptionStartDate,
                status: partnerData.paymentStatus,
            }]);
          }

          const customersQuery = query(collection(db, "customers"), where("vendorId", "==", vendorId));
          const customersSnap = await getDocs(customersQuery);
          const fetchedCustomers = customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerData));
          setCustomers(fetchedCustomers);

          const historyQuery = query(collection(db, "subscriptionHistory"), where("vendorId", "==", vendorId), orderBy("purchaseDate", "desc"));
          const historySnap = await getDocs(historyQuery);
          
          const customerIds = [...new Set(historySnap.docs.map(d => d.data().userId))];
          const customersMap = new Map<string, string>();
          
          if(customerIds.length > 0) {
            // Firestore 'in' query limit is 30, so we batch the requests.
            for (let i = 0; i < customerIds.length; i += 30) {
                const batchIds = customerIds.slice(i, i + 30);
                const customerDetailsQuery = query(collection(db, "customers"), where("__name__", "in", batchIds));
                const customerDetailsSnap = await getDocs(customerDetailsQuery);
                customerDetailsSnap.forEach(doc => {
                    customersMap.set(doc.id, doc.data().name);
                });
            }
          }

          const earningsData = historySnap.docs.map(doc => {
              const data = doc.data();
              return {
                  id: doc.id,
                  customerName: customersMap.get(data.userId) || "Unknown Customer",
                  planName: data.planName,
                  purchaseDate: data.purchaseDate,
                  vendorEarning: data.vendorEarning || 0
              } as EarningHistoryItem
          });
          setEarnings(earningsData);

        } else {
          toast({ variant: "destructive", title: "Error", description: "Partner not found." });
          router.push('/admin/partners');
        }
      } catch (error) {
        console.error("Error fetching partner data:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch partner data." });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [db, vendorId, toast, router]);

  const handleToggleStatus = async (checked: boolean) => {
      setIsToggling(true);
      try {
          const result = await togglePartnerStatus({ vendorId, disabled: checked });
          if(result.success) {
              toast({ variant: "success", title: "Success", description: result.message });
              setPartner(prev => prev ? { ...prev, status: checked ? "Inactive" : "Active" } : null);
          } else {
              throw new Error(result.message);
          }
      } catch (error: any) {
           toast({ variant: "destructive", title: "Error", description: `Could not update status: ${error.message}` });
      } finally {
          setIsToggling(false);
      }
  }

  const handleResendWelcomeEmail = async () => {
    if (!partner) return;
    setIsResendingEmail(true);
    try {
      const result = await resendWelcomeEmail({
        userId: vendorId,
        name: partner.name,
        email: partner.email,
        userType: 'partner',
      });
      if (result.success) {
        toast({ title: 'Success', description: result.message });
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: `Could not resend email: ${error.message}` });
    } finally {
      setIsResendingEmail(false);
    }
  };


  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!partner) {
    return <p>No partner data to display.</p>
  }
  
  const isDisabled = partner.status === 'Inactive';

  return (
    <div className="space-y-6">
        <Card className="max-w-4xl mx-auto">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/partners">
                        <Button variant="outline" size="icon">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        </Link>
                        <Avatar className="h-16 w-16">
                            <AvatarFallback>{partner.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                        <CardTitle className="text-2xl">{partner.name}</CardTitle>
                        <CardDescription>{partner.email}</CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button variant="outline" onClick={handleResendWelcomeEmail} disabled={isResendingEmail}>
                            {isResendingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Mail className="mr-2 h-4 w-4"/>}
                            Resend Welcome Email
                        </Button>
                        <div className="flex items-center space-x-2">
                            <Switch id="account-status" checked={isDisabled} onCheckedChange={handleToggleStatus} disabled={isToggling} />
                            <Label htmlFor="account-status" className="flex flex-col">
                                <span>{isDisabled ? "Disabled" : "Enabled"}</span>
                                <span className="text-xs text-muted-foreground">Account Login</span>
                            </Label>
                        </div>
                        <Link href={`/admin/partners/edit/${vendorId}`} passHref>
                            <Button variant="outline">Edit Partner</Button>
                        </Link>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="overview">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="customers">Customers</TabsTrigger>
                        <TabsTrigger value="earnings">Earnings</TabsTrigger>
                        <TabsTrigger value="payments">Payments</TabsTrigger>
                    </TabsList>
                    <TabsContent value="overview" className="mt-6 space-y-6">
                         <Card>
                            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><User className="h-5 w-5"/> Partner Details</CardTitle></CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                <DetailItem icon={Mail} label="Email Address" value={partner.email} />
                                <DetailItem icon={Phone} label="Mobile Number" value={partner.mobile} />
                                <DetailItem icon={MapPin} label="Address" value={partner.address} />
                                <DetailItem icon={CalendarDays} label="Registered On" value={partner.createdAt ? format(partner.createdAt.toDate(), 'PPP') : undefined} />
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><BadgeCheck className="h-5 w-5"/> Subscription Plan</CardTitle></CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                <DetailItem icon={BadgeCheck} label="Plan" value={partner.planName ? (partner.planVariantLabel ? `${partner.planName} (${partner.planVariantLabel})` : partner.planName) : undefined} />
                                <DetailItem icon={IndianRupee} label="Plan Price" value={partner.planPrice !== undefined ? `₹${partner.planPrice.toFixed(2)}` : undefined} />
                                <DetailItem icon={CalendarDays} label="Subscription Start" value={partner.subscriptionStartDate ? format(partner.subscriptionStartDate.toDate(), 'PPP') : undefined} />
                                <DetailItem icon={CalendarDays} label="Subscription End" value={partner.subscriptionEndDate ? format(partner.subscriptionEndDate.toDate(), 'PPP') : undefined} />
                                <DetailItem icon={BadgeCheck} label="Payment Status" value={partner.paymentStatus} />
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="customers" className="mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Users className="h-5 w-5"/>
                                    Associated Customers ({customers.length})
                                </CardTitle>
                                <CardDescription>A list of all customers added by this partner.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Customer</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Subscription Ends</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {customers.length > 0 ? (
                                        customers.map(customer => (
                                            <TableRow key={customer.id}>
                                            <TableCell>
                                                <div className="font-medium">{customer.name}</div>
                                                <div className="text-sm text-muted-foreground">{customer.email}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={customer.status === 'Active' ? 'success' : 'secondary'}>{customer.status}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                {customer.subscriptionEndDate ? format(customer.subscriptionEndDate.toDate(), 'PPP') : 'N/A'}
                                            </TableCell>
                                            </TableRow>
                                        ))
                                        ) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center">No customers found for this partner.</TableCell>
                                        </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="earnings" className="mt-6">
                         <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <IndianRupee className="h-5 w-5"/>
                                    Earnings History
                                </CardTitle>
                                <CardDescription>A list of all earnings from this partner's customers.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Customer</TableHead>
                                            <TableHead>Plan</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead className="text-right">Earning</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {earnings.length > 0 ? (
                                        earnings.map(item => (
                                            <TableRow key={item.id}>
                                                <TableCell>{item.customerName}</TableCell>
                                                <TableCell><Badge variant="outline">{item.planName}</Badge></TableCell>
                                                <TableCell>{format(item.purchaseDate.toDate(), 'PPP')}</TableCell>
                                                <TableCell className="text-right font-medium">₹{item.vendorEarning.toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))
                                        ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center">No earnings recorded for this partner yet.</TableCell>
                                        </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="payments" className="mt-6">
                         <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Receipt className="h-5 w-5"/>
                                    Payment Transactions
                                </CardTitle>
                                <CardDescription>A list of this partner's own subscription payments.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Plan</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {transactions.length > 0 ? (
                                        transactions.map(item => (
                                            <TableRow key={item.id}>
                                                <TableCell><Badge variant="outline">{item.planName}</Badge></TableCell>
                                                <TableCell>{format(item.purchaseDate.toDate(), 'PPP')}</TableCell>
                                                <TableCell>
                                                    <Badge variant={item.status === 'Paid' ? 'success' : 'secondary'}>{item.status || 'N/A'}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-medium">₹{item.amount.toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))
                                        ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center">No payment transactions recorded for this partner yet.</TableCell>
                                        </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    </div>
  );
}

    

    
