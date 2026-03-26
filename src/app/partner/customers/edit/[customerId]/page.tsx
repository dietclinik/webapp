
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, Save } from "lucide-react";
import { doc, getDoc, updateDoc, writeBatch, collection, getDocs, where, query, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { onAuthStateChanged } from "firebase/auth";
import { addDays, addMonths, format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
  mobile: z.string().regex(/^\d{10}$/, "Must be a valid 10-digit mobile number."),
  address: z.string().min(5, "Address is required."),
  age: z.coerce.number().min(1, "Age is required."),
  gender: z.string().min(1, "Gender is required."),
  height: z.coerce.number().min(1, "Height is required."),
  weight: z.coerce.number().min(1, "Weight is required."),
});

type FormData = z.infer<typeof formSchema>;

type Plan = {
  id: string;
  name: string;
  durationMonths: number;
  durationDays: number;
};

export default function PartnerEditCustomerPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialData, setInitialData] = useState<any>(null);
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  const { toast } = useToast();
  const { db, auth } = useFirebase();
  const router = useRouter();
  const params = useParams();
  const customerId = params.customerId as string;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (!db || !customerId || !auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/partner/login');
        return;
      }

      const fetchData = async () => {
        setIsLoading(true);
        try {
          const customerDocRef = doc(db, "customers", customerId);
          const profileDocRef = doc(db, "userProfiles", customerId);

          const [customerSnap, profileSnap] = await Promise.all([
            getDoc(customerDocRef),
            getDoc(profileDocRef),
          ]);

          if (customerSnap.exists() && customerSnap.data().vendorId === user.uid) {
            const customer = customerSnap.data();
            const profile = profileSnap.exists() ? profileSnap.data() : {};
            const initial = { ...customer, ...profile };
            setInitialData(initial);

            form.reset({
              name: customer.name || "",
              email: customer.email || "",
              mobile: customer.mobile || "",
              address: customer.address || "",
              age: Number(profile.age) || 0,
              gender: profile.gender || "",
              height: Number(profile.height) || 0,
              weight: Number(profile.weight) || 0,
            });
            setSelectedPlanId(customer.planId);
            
            const plansQuery = query(collection(db, "subscriptionPlans"), where("vendorVisible", "==", true));
            const plansSnapshot = await getDocs(plansQuery);
            const plans = plansSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Plan));
            setAvailablePlans(plans);

          } else {
            toast({ variant: "destructive", title: "Error", description: "Customer not found or you don't have permission to edit." });
            router.push('/partner/customers');
          }
        } catch (error) {
          console.error("Error fetching customer data:", error);
          toast({ variant: "destructive", title: "Error", description: "Could not fetch customer data." });
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    });

    return () => unsubscribe();
  }, [db, customerId, auth, toast, router, form]);

  const onSubmit = async (data: FormData) => {
    if (!db || !customerId) return;
    setIsSubmitting(true);
    
    const customerDocRef = doc(db, "customers", customerId);
    const profileDocRef = doc(db, "userProfiles", customerId);

    try {
      const batch = writeBatch(db);
      
      batch.update(customerDocRef, {
        name: data.name,
        email: data.email,
        mobile: data.mobile,
        address: data.address,
      });
      
      batch.update(profileDocRef, {
        name: data.name,
        email: data.email,
        age: data.age.toString(),
        gender: data.gender,
        height: data.height.toString(),
        weight: data.weight.toString(),
      });
      
      await batch.commit();

      toast({ variant: "success", title: "Success", description: "Customer details updated successfully." });
    } catch (error: any) {
      console.error("Error updating customer:", error);
      toast({ variant: "destructive", title: "Error", description: `Could not update customer: ${error.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSubscription = async () => {
    if (!selectedPlanId || !initialData) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a new plan.' });
      return;
    }
    
    const newPlan = availablePlans.find(p => p.id === selectedPlanId);
    if (!newPlan) {
      toast({ variant: 'destructive', title: 'Error', description: 'Selected plan not found.' });
      return;
    }

    setIsSubmitting(true);
    const customerDocRef = doc(db, "customers", customerId);
    const startDate = new Date();
    let endDate = addMonths(startDate, newPlan.durationMonths || 0);
    endDate = addDays(endDate, newPlan.durationDays || 0);

    try {
      await updateDoc(customerDocRef, {
        planId: selectedPlanId,
        subscriptionStartDate: Timestamp.fromDate(startDate),
        subscriptionEndDate: Timestamp.fromDate(endDate),
        status: 'Active',
        paymentStatus: 'Paid',
      });
      toast({ variant: 'success', title: 'Subscription Updated', description: `${initialData.name}'s plan has been updated to ${newPlan.name}.` });
      setInitialData((prev: any) => ({ ...prev, planId: selectedPlanId, subscriptionEndDate: Timestamp.fromDate(endDate) }));
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
    } finally {
      setIsSubmitting(false);
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
                <Link href="/partner/customers">
                    <Button variant="outline" size="icon">
                    <ChevronLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <CardTitle>Edit Customer: {initialData?.name}</CardTitle>
                    <CardDescription>
                    Update the customer's details and subscription.
                    </CardDescription>
                </div>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-4xl mx-auto">
                <Card>
                    <CardHeader><CardTitle>Subscription Management</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <p>Current Plan: <span className="font-bold">{availablePlans.find(p => p.id === initialData?.planId)?.name || 'N/A'}</span></p>
                        <p>Expires On: <span className="font-bold">{initialData?.subscriptionEndDate ? format(initialData.subscriptionEndDate.toDate(), 'PPP') : 'N/A'}</span></p>
                        <div className="flex items-end gap-2">
                             <div className="flex-1">
                                <Label>New Plan</Label>
                                <Select onValueChange={setSelectedPlanId} value={selectedPlanId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a plan to renew/upgrade" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availablePlans.map(plan => (
                                            <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                             <Button type="button" onClick={handleUpdateSubscription} disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Update Subscription
                            </Button>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Personal Details</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="email" render={({ field }) => (
                            <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="mobile" render={({ field }) => (
                            <FormItem><FormLabel>Mobile</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="md:col-span-2">
                        <FormField control={form.control} name="address" render={({ field }) => (
                            <FormItem><FormLabel>Address</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        </div>
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
                                    <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="male">Male</SelectItem>
                                        <SelectItem value="female">Female</SelectItem>
                                    </SelectContent>
                                </Select><FormMessage /></FormItem>
                         )} />
                          <FormField control={form.control} name="height" render={({ field }) => (
                            <FormItem><FormLabel>Height (cm)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                         )} />
                          <FormField control={form.control} name="weight" render={({ field }) => (
                            <FormItem><FormLabel>Weight (kg)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                         )} />
                    </CardContent>
                </Card>
                <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        Save Personal Details
                    </Button>
                </div>
            </form>
        </Form>
      </CardContent>
    </Card>
  );
}

