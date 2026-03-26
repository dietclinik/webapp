
"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Loader2,
  Save,
  UserCheck
} from "lucide-react";
import { format } from "date-fns";
import { doc, getDoc, updateDoc, Timestamp, collection, getDocs, writeBatch } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { processNewCustomer } from "@/app/actions";
import { sendCustomerAssignmentEmail } from "@/ai/flows/send-customer-assignment-email-flow";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
  mobile: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(["Active", "Inactive"]),
  paymentStatus: z.enum(["Paid", "Failed", "Pending"]),
  age: z.coerce.number().min(1, "Age is required."),
  gender: z.string().min(1, "Gender is required."),
  height: z.coerce.number().min(1, "Height is required."),
  weight: z.coerce.number().min(1, "Weight is required."),
  healthProblems: z.string().optional(),
  allergies: z.string().optional(),
  assignedStaffId: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;
type Staff = { id: string, name: string, email: string, mobile?: string };

export default function EditCustomerPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [customerData, setCustomerData] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [staffList, setStaffList] = useState<Staff[]>([]);

  const { toast } = useToast();
  const { db } = useFirebase();
  const router = useRouter();
  const params = useParams();
  const customerId = params.customerId as string;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (!db || !customerId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const staffQuery = await getDocs(collection(db, "staff"));
        setStaffList(staffQuery.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          email: doc.data().email,
          mobile: doc.data().mobile
        })));

        const customerDocRef = doc(db, "customers", customerId);
        const profileDocRef = doc(db, "userProfiles", customerId);

        const [customerSnap, profileSnap] = await Promise.all([
          getDoc(customerDocRef),
          getDoc(profileDocRef),
        ]);

        if (customerSnap.exists()) {
          const customer = customerSnap.data();
          const profile = profileSnap.exists() ? profileSnap.data() : {};
          setCustomerData(customer);
          setProfileData(profile);

          form.reset({
            name: customer.name || "",
            email: customer.email || "",
            mobile: customer.mobile || "",
            address: customer.address || "",
            status: customer.status || "Inactive",
            paymentStatus: customer.paymentStatus || "Pending",
            age: Number(profile.age) || 0,
            gender: profile.gender || "",
            height: Number(profile.height) || 0,
            weight: Number(profile.weight) || 0,
            healthProblems: profile.healthProblems || "",
            allergies: profile.allergies || "",
            assignedStaffId: customer.assignedStaffId || "unassigned",
          });
        } else {
          toast({ variant: "destructive", title: "Error", description: "Customer not found." });
          router.push('/admin/customers');
        }
      } catch (error) {
        console.error("Error fetching customer data:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch customer data." });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [db, customerId, toast, router, form]);

  const onSubmit = async (data: FormData) => {
    if (!db || !customerId) return;
    setIsSubmitting(true);

    const customerDocRef = doc(db, "customers", customerId);
    const profileDocRef = doc(db, "userProfiles", customerId);
    const previousStaffId = customerData?.assignedStaffId;
    const newStaffId = data.assignedStaffId === 'unassigned' ? null : data.assignedStaffId;

    try {
      const batch = writeBatch(db);

      batch.update(customerDocRef, {
        name: data.name,
        email: data.email,
        mobile: data.mobile ? data.mobile.replace(/\D/g, '') : "",
        address: data.address,
        status: data.status,
        paymentStatus: data.paymentStatus,
        assignedStaffId: newStaffId,
      });

      batch.update(profileDocRef, {
        name: data.name,
        email: data.email,
        age: data.age.toString(),
        gender: data.gender,
        height: data.height.toString(),
        weight: data.weight.toString(),
        healthProblems: data.healthProblems,
        allergies: data.allergies
      });

      await batch.commit();

      if (newStaffId && newStaffId !== previousStaffId) {
        const staffMember = staffList.find(s => s.id === newStaffId);
        if (staffMember) {
          sendCustomerAssignmentEmail({
            staffId: staffMember.id,
            staffName: staffMember.name,
            staffEmail: staffMember.email,
            staffMobile: staffMember.mobile,
            customerId: customerId,
            customerName: data.name
          }).catch(console.error);
        }
      }

      toast({ variant: "success", title: "Success", description: "Customer details updated successfully." });
      router.push('/admin/customers');
    } catch (error: any) {
      console.error("Error updating customer:", error);
      toast({ variant: "destructive", title: "Error", description: `Could not update customer: ${error.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivateCustomer = async () => {
    if (!customerData || !profileData || !customerId) return;
    setIsActivating(true);

    try {
      await processNewCustomer({
        paymentSuccess: true, // Manually activating
        userId: customerId, // Pass the current doc ID (could be temporary)
        customerData: {
          ...customerData,
          status: 'Active',
          paymentStatus: 'Paid',
          // convert Timestamps back to ISO strings for the flow
          subscriptionStartDate: customerData.subscriptionStartDate.toDate().toISOString(),
          subscriptionEndDate: customerData.subscriptionEndDate.toDate().toISOString(),
        },
        profileData: {
          ...profileData,
          name: customerData.name, // Ensure names are consistent
          email: customerData.email,
        }
      });

      toast({
        variant: "success",
        title: "Customer Activated",
        description: "Welcome email is being sent in the background. Redirecting..."
      });

      setTimeout(() => {
        router.push("/admin/customers");
      }, 2000);

    } catch (error: any) {
      console.error("Activation Error:", error);
      toast({ variant: "destructive", title: "Error", description: `Could not activate customer: ${error.message}` });
    } finally {
      setIsActivating(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/customers">
              <Button variant="outline" size="icon">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <CardTitle>Edit Customer: {form.getValues('name')}</CardTitle>
              <CardDescription>
                Update the customer's details below.
              </CardDescription>
            </div>
          </div>
          {customerData?.paymentStatus === 'Failed' && (
            <Button onClick={handleActivateCustomer} disabled={isActivating}>
              {isActivating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <UserCheck className="mr-2 h-4 w-4" />
              Activate and Send Welcome Email
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Account Information</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="mobile" render={({ field }) => (
                  <FormItem><FormLabel>Mobile</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem><FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="paymentStatus" render={({ field }) => (
                  <FormItem><FormLabel>Payment Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Paid">Paid</SelectItem>
                        <SelectItem value="Failed">Failed</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="assignedStaffId" render={({ field }) => (
                  <FormItem><FormLabel>Assign to Staff</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {staffList.map(staff => (
                          <SelectItem key={staff.id} value={staff.id}>{staff.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem className="lg:col-span-3"><FormLabel>Address</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Health Profile</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <FormField control={form.control} name="age" render={({ field }) => (
                  <FormItem><FormLabel>Age</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem><FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="height" render={({ field }) => (
                  <FormItem><FormLabel>Height (cm)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="weight" render={({ field }) => (
                  <FormItem><FormLabel>Weight (kg)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="healthProblems" render={({ field }) => (
                  <FormItem className="lg:col-span-2"><FormLabel>Health Problems</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="allergies" render={({ field }) => (
                  <FormItem className="lg:col-span-2"><FormLabel>Allergies</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </CardContent>
            </Card>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
