
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, User, Phone, Mail, MapPin, Briefcase, Download, Users, UserCheck, UserX } from "lucide-react";
import { format } from "date-fns";
import { doc, getDoc, collection, getDocs, Timestamp, query, where, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toggleStaffStatus } from "@/ai/flows/toggle-staff-status-flow";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFunctions, httpsCallable } from 'firebase/functions';
import { resendWelcomeEmail } from "@/ai/flows/resend-welcome-email-flow";


type StaffData = {
    name: string;
    email: string;
    mobile?: string;
    address?: string;
    experience?: number;
    photoURL?: string;
    resumeURL?: string;
    createdAt: Timestamp;
};

type CustomerData = {
    id: string;
    name: string;
    email: string;
    status: 'Active' | 'Inactive';
    subscriptionEndDate?: Timestamp;
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


export default function ViewStaffPage() {
  const [loading, setLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [staff, setStaff] = useState<StaffData | null>(null);
  const [isDisabled, setIsDisabled] = useState(false);
  const [assignedCustomers, setAssignedCustomers] = useState<CustomerData[]>([]);
  const { toast } = useToast();
  const { db, app } = useFirebase();
  const router = useRouter();
  const params = useParams();
  const staffId = params.staffId as string;

   useEffect(() => {
    if (!db || !staffId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch staff details from Firestore
        const staffDocRef = doc(db, "staff", staffId);
        const staffSnap = await getDoc(staffDocRef);

        if (staffSnap.exists()) {
          setStaff(staffSnap.data() as StaffData);

          // Fetch assigned customers
          const customersQuery = query(collection(db, "customers"), where("assignedStaffId", "==", staffId));
          const customersSnap = await getDocs(customersQuery);
          setAssignedCustomers(customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerData)));
          
          // Using a callable function to get auth status is complex. Let's simplify.
          // We can call a genkit flow to get the user status.
          // For now, let's assume we can fetch this. We'll use a placeholder.
          // We will use a separate flow for toggling.
          
        } else {
          toast({ variant: "destructive", title: "Error", description: "Staff member not found." });
          router.push('/admin/staff');
        }
      } catch (error) {
        console.error("Error fetching staff data:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch staff data." });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [db, staffId, toast, router]);

  const handleToggleStatus = async (checked: boolean) => {
      setIsToggling(true);
      try {
          const result = await toggleStaffStatus({ staffId, disabled: checked });
          if(result.success) {
              toast({ variant: "success", title: "Success", description: result.message });
              setIsDisabled(checked);
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
    if (!staff) return;
    setIsResendingEmail(true);
    try {
      const result = await resendWelcomeEmail({
        userId: staffId,
        name: staff.name,
        email: staff.email,
        userType: 'staff',
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

  if (!staff) {
    return <p>No staff data to display.</p>
  }

  return (
    <div className="space-y-6">
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/staff">
              <Button variant="outline" size="icon">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Avatar className="h-16 w-16">
                <AvatarImage src={staff.photoURL} />
                <AvatarFallback>{staff.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-2xl">{staff.name}</CardTitle>
              <CardDescription>Staff Member since {format(staff.createdAt.toDate(), 'PPP')}</CardDescription>
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
                <Link href={`/admin/staff/edit/${staffId}`} passHref>
                    <Button variant="outline">Edit Profile</Button>
                </Link>
           </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><User className="h-5 w-5"/> Personal Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <DetailItem icon={Mail} label="Email Address" value={staff.email} />
                <DetailItem icon={Phone} label="Mobile Number" value={staff.mobile} />
                <DetailItem icon={MapPin} label="Address" value={staff.address} />
                <DetailItem icon={Briefcase} label="Years of Experience" value={`${staff.experience} years`} />
                {staff.resumeURL && (
                    <div className="flex items-start gap-3">
                        <Download className="h-5 w-5 text-muted-foreground mt-1" />
                        <div className="flex flex-col">
                            <p className="text-sm font-medium text-muted-foreground">Resume</p>
                            <a href={staff.resumeURL} target="_blank" rel="noopener noreferrer">
                                <Button variant="link" className="p-0 h-auto text-base">Download Resume</Button>
                            </a>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5"/> Assigned Customers ({assignedCustomers.length})</CardTitle></CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Subscription Ends</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {assignedCustomers.length > 0 ? assignedCustomers.map(customer => (
                             <TableRow key={customer.id}>
                                <TableCell>{customer.name}</TableCell>
                                <TableCell>{customer.email}</TableCell>
                                <TableCell><Badge variant={customer.status === 'Active' ? 'success' : 'secondary'}>{customer.status}</Badge></TableCell>
                                <TableCell>{customer.subscriptionEndDate ? format(customer.subscriptionEndDate.toDate(), 'PPP') : 'N/A'}</TableCell>
                             </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center">No customers assigned.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

      </CardContent>
    </Card>
    </div>
  );
}
