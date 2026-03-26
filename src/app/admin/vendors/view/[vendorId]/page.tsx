
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, User, Phone, Mail, MapPin, Users, IndianRupee } from "lucide-react";
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
import { toggleVendorStatus } from "@/ai/flows/toggle-vendor-status-flow";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type VendorData = {
    name: string;
    email: string;
    mobile?: string;
    address?: string;
    status: 'Active' | 'Inactive';
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

export default function ViewVendorPage() {
  const [loading, setLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [vendor, setVendor] = useState<VendorData | null>(null);
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [earnings, setEarnings] = useState<EarningHistoryItem[]>([]);
  const { toast } = useToast();
  const { db } = useFirebase();
  const router = useRouter();
  const params = useParams();
  const vendorId = params.vendorId as string;

  useEffect(() => {
    if (!db || !vendorId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const vendorDocRef = doc(db, "vendors", vendorId);
        const vendorSnap = await getDoc(vendorDocRef);

        if (vendorSnap.exists()) {
          setVendor(vendorSnap.data() as VendorData);
          
          const customersQuery = query(collection(db, "customers"), where("vendorId", "==", vendorId));
          const customersSnap = await getDocs(customersQuery);
          const fetchedCustomers = customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerData));
          setCustomers(fetchedCustomers);

          const historyQuery = query(collection(db, "subscriptionHistory"), where("vendorId", "==", vendorId), orderBy("purchaseDate", "desc"));
          const historySnap = await getDocs(historyQuery);
          
          const customerIds = [...new Set(historySnap.docs.map(d => d.data().userId))];
          const customersMap = new Map<string, string>();
          
          if(customerIds.length > 0) {
             const customerDetailsQuery = query(collection(db, "customers"), where("__name__", "in", customerIds));
             const customerDetailsSnap = await getDocs(customerDetailsQuery);
             customerDetailsSnap.forEach(doc => {
                 customersMap.set(doc.id, doc.data().name);
             });
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
          toast({ variant: "destructive", title: "Error", description: "Vendor not found." });
          router.push('/admin/vendors');
        }
      } catch (error) {
        console.error("Error fetching vendor data:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch vendor data." });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [db, vendorId, toast, router]);

  const handleToggleStatus = async (checked: boolean) => {
      setIsToggling(true);
      try {
          const result = await toggleVendorStatus({ vendorId, disabled: checked });
          if(result.success) {
              toast({ variant: "success", title: "Success", description: result.message });
              setVendor(prev => prev ? { ...prev, status: checked ? "Inactive" : "Active" } : null);
          } else {
              throw new Error(result.message);
          }
      } catch (error: any) {
           toast({ variant: "destructive", title: "Error", description: `Could not update status: ${error.message}` });
      } finally {
          setIsToggling(false);
      }
  }


  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!vendor) {
    return <p>No vendor data to display.</p>
  }
  
  const isDisabled = vendor.status === 'Inactive';

  return (
    <div className="space-y-6">
        <Card className="max-w-4xl mx-auto">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/vendors">
                        <Button variant="outline" size="icon">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        </Link>
                        <Avatar className="h-16 w-16">
                            <AvatarFallback>{vendor.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                        <CardTitle className="text-2xl">{vendor.name}</CardTitle>
                        <CardDescription>{vendor.email}</CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center space-x-2">
                            <Switch id="account-status" checked={isDisabled} onCheckedChange={handleToggleStatus} disabled={isToggling} />
                            <Label htmlFor="account-status" className="flex flex-col">
                                <span>{isDisabled ? "Disabled" : "Enabled"}</span>
                                <span className="text-xs text-muted-foreground">Account Login</span>
                            </Label>
                        </div>
                        <Link href={`/admin/vendors/edit/${vendorId}`} passHref>
                            <Button variant="outline">Edit Vendor</Button>
                        </Link>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="overview">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="customers">Customers</TabsTrigger>
                        <TabsTrigger value="earnings">Earnings</TabsTrigger>
                    </TabsList>
                    <TabsContent value="overview" className="mt-6">
                         <Card>
                            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><User className="h-5 w-5"/> Vendor Details</CardTitle></CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                <DetailItem icon={Mail} label="Email Address" value={vendor.email} />
                                <DetailItem icon={Phone} label="Mobile Number" value={vendor.mobile} />
                                <DetailItem icon={MapPin} label="Address" value={vendor.address} />
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
                                <CardDescription>A list of all customers added by this vendor.</CardDescription>
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
                                            <TableCell colSpan={3} className="text-center">No customers found for this vendor.</TableCell>
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
                                <CardDescription>A list of all earnings from this vendor's customers.</CardDescription>
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
                                            <TableCell colSpan={4} className="text-center">No earnings recorded for this vendor yet.</TableCell>
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
