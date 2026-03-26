

"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, User, Phone, Mail, MapPin, Users } from "lucide-react";
import { doc, getDoc, collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { resendWelcomeEmail } from "@/ai/flows/resend-welcome-email-flow";
// import { toggleCorporateStatus } from "@/ai/flows/toggle-corporate-status-flow";

type CorporateData = {
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

const DetailItem = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value?: React.ReactNode }) => (
    <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 text-muted-foreground mt-1" />
        <div className="flex flex-col">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-base">{value || 'N/A'}</p>
        </div>
    </div>
);

export default function ViewCorporatePage() {
  const [loading, setLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [corporate, setCorporate] = useState<CorporateData | null>(null);
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const { toast } = useToast();
  const { db } = useFirebase();
  const router = useRouter();
  const params = useParams();
  const corporateId = params.corporateId as string;

  useEffect(() => {
    if (!db || !corporateId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const corporateDocRef = doc(db, "corporates", corporateId);
        const corporateSnap = await getDoc(corporateDocRef);

        if (corporateSnap.exists()) {
          setCorporate(corporateSnap.data() as CorporateData);
          
          const customersQuery = query(collection(db, "customers"), where("corporateId", "==", corporateId));
          const customersSnap = await getDocs(customersQuery);
          const fetchedCustomers = customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerData));
          setCustomers(fetchedCustomers);

        } else {
          toast({ variant: "destructive", title: "Error", description: "Corporate account not found." });
          router.push('/admin/corporates');
        }
      } catch (error) {
        console.error("Error fetching corporate data:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch corporate data." });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [db, corporateId, toast, router]);

  const handleToggleStatus = async (checked: boolean) => {
      setIsToggling(true);
      try {
        //   const result = await toggleCorporateStatus({ corporateId, disabled: checked });
        //   if(result.success) {
        //       toast({ variant: "success", title: "Success", description: result.message });
        //       setCorporate(prev => prev ? { ...prev, status: checked ? "Inactive" : "Active" } : null);
        //   } else {
        //       throw new Error(result.message);
        //   }
          toast({ title: "Coming Soon", description: "Status toggling is under construction."});
      } catch (error: any) {
           toast({ variant: "destructive", title: "Error", description: `Could not update status: ${error.message}` });
      } finally {
          setIsToggling(false);
      }
  }

  const handleResendWelcomeEmail = async () => {
    if (!corporate) return;
    setIsResendingEmail(true);
    try {
      const result = await resendWelcomeEmail({
        userId: corporateId,
        name: corporate.name,
        email: corporate.email,
        userType: 'corporate',
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

  if (!corporate) {
    return <p>No corporate data to display.</p>
  }
  
  const isDisabled = corporate.status === 'Inactive';

  return (
    <div className="space-y-6">
        <Card className="max-w-4xl mx-auto">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/corporates">
                        <Button variant="outline" size="icon">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        </Link>
                        <Avatar className="h-16 w-16">
                            <AvatarFallback>{corporate.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                        <CardTitle className="text-2xl">{corporate.name}</CardTitle>
                        <CardDescription>{corporate.email}</CardDescription>
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
                        <Link href={`/admin/corporates/edit/${corporateId}`} passHref>
                            <Button variant="outline">Edit Corporate</Button>
                        </Link>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                 <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><User className="h-5 w-5"/> Corporate Details</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        <DetailItem icon={Mail} label="Email Address" value={corporate.email} />
                        <DetailItem icon={Phone} label="Mobile Number" value={corporate.mobile} />
                        <DetailItem icon={MapPin} label="Address" value={corporate.address} />
                    </CardContent>
                </Card>
            </CardContent>
        </Card>
        
        <Card className="max-w-4xl mx-auto">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="h-5 w-5"/>
                    Associated Customers ({customers.length})
                </CardTitle>
                <CardDescription>A list of all customers added by this corporate.</CardDescription>
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
                            <TableCell colSpan={3} className="text-center">No customers found for this corporate.</TableCell>
                        </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    </div>
  );
}
